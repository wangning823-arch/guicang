import { describe, it, expect } from 'vitest';
import {
  TextEmbedder,
  DocumentChunker,
  VectorStore,
} from '../src/knowledge/embedding.js';

describe('TextEmbedder', () => {
  const embedder = new TextEmbedder();

  describe('tokenize', () => {
    it('should tokenize English text', () => {
      const tokens = embedder.tokenize('Hello world');
      expect(tokens).toEqual(['hello', 'world']);
    });

    it('should tokenize Chinese text', () => {
      const tokens = embedder.tokenize('你好 世界');
      expect(tokens).toEqual(['你好', '世界']);
    });

    it('should handle punctuation', () => {
      const tokens = embedder.tokenize('Hello, world!');
      expect(tokens).toEqual(['hello', 'world']);
    });
  });

  describe('embed', () => {
    it('should generate embedding vector', () => {
      const vector = embedder.embed('Hello world');
      expect(Array.isArray(vector)).toBe(true);
      expect(vector.length).toBeGreaterThan(0);
    });

    it('should generate normalized vectors', () => {
      const vector = embedder.embed('Hello world');
      const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
      expect(norm).toBeCloseTo(1, 1);
    });

    it('should generate different vectors for different texts', () => {
      const v1 = embedder.embed('Hello world');
      const v2 = embedder.embed('Goodbye world');
      expect(v1).not.toEqual(v2);
    });
  });

  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const similarity = embedder.cosineSimilarity([1, 0, 0], [1, 0, 0]);
      expect(similarity).toBeCloseTo(1);
    });

    it('should return 0 for orthogonal vectors', () => {
      const similarity = embedder.cosineSimilarity([1, 0], [0, 1]);
      expect(similarity).toBeCloseTo(0);
    });

    it('should return -1 for opposite vectors', () => {
      const similarity = embedder.cosineSimilarity([1, 0], [-1, 0]);
      expect(similarity).toBeCloseTo(-1);
    });
  });
});

describe('DocumentChunker', () => {
  it('should chunk document', () => {
    const chunker = new DocumentChunker(100, 10);
    const content = '这是一段测试文本。包含多个句子。用于测试分块功能。';
    const chunks = chunker.chunk(content, { source: 'test.txt' });

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].metadata.source).toBe('test.txt');
    expect(chunks[0].metadata.chunkIndex).toBe(0);
  });

  it('should handle short documents', () => {
    const chunker = new DocumentChunker(1000);
    const chunks = chunker.chunk('Short doc', { source: 'short.txt' });

    expect(chunks.length).toBe(1);
    expect(chunks[0].content).toBe('Short doc');
  });

  it('should update totalChunks', () => {
    const chunker = new DocumentChunker(50);
    const content = 'Sentence one. Sentence two. Sentence three. Sentence four.';
    const chunks = chunker.chunk(content, { source: 'multi.txt' });

    for (const chunk of chunks) {
      expect(chunk.metadata.totalChunks).toBe(chunks.length);
    }
  });
});

describe('VectorStore', () => {
  it('should add document', () => {
    const store = new VectorStore();
    const count = store.addDocument('Hello world test', { source: 'test.txt' });

    expect(count).toBeGreaterThan(0);
    expect(store.size).toBeGreaterThan(0);
  });

  it('should search similar documents', () => {
    const store = new VectorStore();
    store.addDocument('The quick brown fox jumps over the lazy dog', { source: 'fox.txt' });
    store.addDocument('Python is a programming language', { source: 'python.txt' });

    const results = store.search('fox');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].chunk.content).toContain('fox');
  });

  it('should return top K results', () => {
    const store = new VectorStore();
    store.addDocument('Document one about cats', { source: 'd1.txt' });
    store.addDocument('Document two about dogs', { source: 'd2.txt' });
    store.addDocument('Document three about birds', { source: 'd3.txt' });

    const results = store.search('animals', 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('should clear store', () => {
    const store = new VectorStore();
    store.addDocument('Test', { source: 'test.txt' });
    store.clear();
    expect(store.size).toBe(0);
  });

  it('should remove by source', () => {
    const store = new VectorStore();
    store.addDocument('Doc one', { source: 'a.txt' });
    store.addDocument('Doc two', { source: 'b.txt' });

    const removed = store.removeBySource('a.txt');
    expect(removed).toBe(1);
    expect(store.getSources()).toEqual(['b.txt']);
  });

  it('should get sources', () => {
    const store = new VectorStore();
    store.addDocument('Doc one', { source: 'a.txt' });
    store.addDocument('Doc two', { source: 'b.txt' });

    const sources = store.getSources();
    expect(sources).toContain('a.txt');
    expect(sources).toContain('b.txt');
  });

  it('should handle empty search', () => {
    const store = new VectorStore();
    const results = store.search('anything');
    expect(results).toEqual([]);
  });
});
