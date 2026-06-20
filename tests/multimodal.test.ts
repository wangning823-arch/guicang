import { describe, it, expect } from 'vitest';
import {
  text,
  toPlainText,
  hasImages,
  extractImages,
  imageFromUrl,
  type MultimodalContent,
} from '../src/multimodal/index.js';

describe('Multimodal Utils', () => {
  it('creates text content', () => {
    const content = text('Hello');
    expect(content).toEqual({ type: 'text', text: 'Hello' });
  });

  it('converts string to plain text', () => {
    expect(toPlainText('Hello')).toBe('Hello');
  });

  it('converts multimodal to plain text', () => {
    const content: MultimodalContent[] = [
      { type: 'text', text: 'Look at this:' },
      { type: 'image', source: 'url', mediaType: 'image/png', description: 'a cat' },
      { type: 'text', text: 'Cute!' },
    ];

    const plain = toPlainText(content);
    expect(plain).toContain('Look at this:');
    expect(plain).toContain('[Image: a cat]');
    expect(plain).toContain('Cute!');
  });

  it('hasImages detects images', () => {
    expect(hasImages('text')).toBe(false);
    expect(hasImages([{ type: 'text', text: 'hi' }])).toBe(false);
    expect(hasImages([
      { type: 'text', text: 'hi' },
      { type: 'image', source: 'url', mediaType: 'image/png' },
    ])).toBe(true);
  });

  it('extractImages returns only images', () => {
    const content: MultimodalContent[] = [
      { type: 'text', text: 'text' },
      { type: 'image', source: 'img1', mediaType: 'image/png' },
      { type: 'audio', source: 'audio1', mediaType: 'audio/wav' },
      { type: 'image', source: 'img2', mediaType: 'image/jpeg' },
    ];

    const images = extractImages(content);
    expect(images).toHaveLength(2);
    expect(images[0].source).toBe('img1');
    expect(images[1].source).toBe('img2');
  });

  it('imageFromUrl creates image content', () => {
    const img = imageFromUrl('https://example.com/cat.jpg', 'a cat');
    expect(img.type).toBe('image');
    expect(img.source).toBe('https://example.com/cat.jpg');
    expect(img.isBase64).toBe(false);
    expect(img.description).toBe('a cat');
  });

  it('extractImages returns empty for string content', () => {
    expect(extractImages('text')).toEqual([]);
  });
});
