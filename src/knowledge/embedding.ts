/**
 * 文档向量化
 * 支持文本嵌入和相似度搜索
 */

/** 文档块 */
export interface DocumentChunk {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    source: string;
    chunkIndex: number;
    totalChunks: number;
    [key: string]: unknown;
  };
}

/** 搜索结果 */
export interface SearchResult {
  chunk: DocumentChunk;
  score: number;
}

/**
 * 简单的文本向量化器
 * 使用 TF-IDF 风格的特征提取
 */
export class TextEmbedder {
  private vocabulary = new Map<string, number>();
  private idf = new Map<string, number>();
  private documentCount = 0;

  /**
   * 分词（简单实现）
   */
  tokenize(text: string): string[] {
    // 简单分词：按空格和标点分割，转小写
    return text
      .toLowerCase()
      .split(/[\s,.;:!?，。；：！？、\n\r]+/)
      .filter((t) => t.length > 0);
  }

  /**
   * 计算词频
   */
  private termFrequency(tokens: string[]): Map<string, number> {
    const tf = new Map<string, number>();
    for (const token of tokens) {
      tf.set(token, (tf.get(token) ?? 0) + 1);
    }
    // 归一化
    for (const [key, value] of tf) {
      tf.set(key, value / tokens.length);
    }
    return tf;
  }

  /**
   * 更新 IDF
   */
  updateIDF(documents: string[]): void {
    this.documentCount = documents.length;
    const docFreq = new Map<string, number>();

    for (const doc of documents) {
      const tokens = new Set(this.tokenize(doc));
      for (const token of tokens) {
        docFreq.set(token, (docFreq.get(token) ?? 0) + 1);
      }
    }

    for (const [term, freq] of docFreq) {
      this.idf.set(term, Math.log((this.documentCount + 1) / (freq + 1)) + 1);
    }
  }

  /**
   * 生成嵌入向量
   */
  embed(text: string): number[] {
    const tokens = this.tokenize(text);
    const tf = this.termFrequency(tokens);

    // 构建词汇表索引
    const allTerms = new Set([...this.vocabulary.keys(), ...tokens]);
    this.vocabulary.clear();
    let idx = 0;
    for (const term of allTerms) {
      this.vocabulary.set(term, idx++);
    }

    // 生成 TF-IDF 向量
    const vector = new Array(this.vocabulary.size).fill(0);
    for (const [term, tfValue] of tf) {
      const idfValue = this.idf.get(term) ?? 1;
      const idx = this.vocabulary.get(term);
      if (idx !== undefined) {
        vector[idx] = tfValue * idfValue;
      }
    }

    // L2 归一化
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= norm;
      }
    }

    return vector;
  }

  /**
   * 计算余弦相似度
   */
  cosineSimilarity(a: number[], b: number[]): number {
    const minLen = Math.min(a.length, b.length);
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < minLen; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const norm = Math.sqrt(normA) * Math.sqrt(normB);
    return norm > 0 ? dotProduct / norm : 0;
  }
}

/**
 * 文档分块器
 */
export class DocumentChunker {
  private chunkSize: number;
  private overlap: number;

  constructor(chunkSize = 500, overlap = 50) {
    this.chunkSize = chunkSize;
    this.overlap = overlap;
  }

  /**
   * 将文档分块
   */
  chunk(
    content: string,
    metadata: { source: string; [key: string]: unknown },
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const sentences = content.split(/(?<=[。！？.!?])\s*/);

    let currentChunk = '';
    let chunkIndex = 0;

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > this.chunkSize && currentChunk.length > 0) {
        chunks.push({
          id: `${metadata.source}-${chunkIndex}`,
          content: currentChunk.trim(),
          embedding: [],
          metadata: {
            ...metadata,
            chunkIndex,
            totalChunks: 0, // will update later
          },
        });
        chunkIndex++;

        // 保留重叠部分
        const words = currentChunk.split(/\s+/);
        const overlapWords = words.slice(-Math.ceil(this.overlap / 5));
        currentChunk = overlapWords.join(' ') + ' ' + sentence;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      }
    }

    // 最后一块
    if (currentChunk.trim()) {
      chunks.push({
        id: `${metadata.source}-${chunkIndex}`,
        content: currentChunk.trim(),
        embedding: [],
        metadata: {
          ...metadata,
          chunkIndex,
          totalChunks: 0,
        },
      });
    }

    // 更新 totalChunks
    for (const chunk of chunks) {
      chunk.metadata.totalChunks = chunks.length;
    }

    return chunks;
  }
}

/**
 * 向量存储
 */
export class VectorStore {
  private chunks: DocumentChunk[] = [];
  private embedder = new TextEmbedder();

  /**
   * 添加文档
   */
  addDocument(content: string, metadata: { source: string; [key: string]: unknown }): number {
    const chunker = new DocumentChunker();
    const chunks = chunker.chunk(content, metadata);

    // 为所有文档生成 IDF
    const allDocs = [...this.chunks.map((c) => c.content), content];
    this.embedder.updateIDF(allDocs);

    // 生成嵌入
    for (const chunk of chunks) {
      chunk.embedding = this.embedder.embed(chunk.content);
    }

    this.chunks.push(...chunks);
    return chunks.length;
  }

  /**
   * 搜索相似文档
   */
  search(query: string, topK = 5): SearchResult[] {
    const queryEmbedding = this.embedder.embed(query);

    const results: SearchResult[] = [];
    for (const chunk of this.chunks) {
      if (chunk.embedding.length === 0) continue;

      const score = this.embedder.cosineSimilarity(queryEmbedding, chunk.embedding);
      results.push({ chunk, score });
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * 获取文档数量
   */
  get size(): number {
    return this.chunks.length;
  }

  /**
   * 清空存储
   */
  clear(): void {
    this.chunks = [];
  }

  /**
   * 按来源删除
   */
  removeBySource(source: string): number {
    const before = this.chunks.length;
    this.chunks = this.chunks.filter((c) => c.metadata.source !== source);
    return before - this.chunks.length;
  }

  /**
   * 获取所有来源
   */
  getSources(): string[] {
    return [...new Set(this.chunks.map((c) => c.metadata.source))];
  }
}

/** 全局向量存储 */
export const vectorStore = new VectorStore();
