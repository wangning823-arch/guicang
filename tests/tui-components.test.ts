/**
 * TUI 组件测试
 */

import { describe, it, expect } from 'vitest';
import { MarkdownRenderer } from '../src/tui/components/markdown.js';
import { CodeBlock } from '../src/tui/components/codeblock.js';

describe('MarkdownRenderer', () => {
  it('should render headings', () => {
    const renderer = new MarkdownRenderer({ maxWidth: 80 });
    const result = renderer.render('# Title');
    expect(result).toContain('Title');
  });

  it('should render code blocks', () => {
    const renderer = new MarkdownRenderer({ maxWidth: 80 });
    const result = renderer.render('```\nconst x = 1;\n```');
    expect(result).toContain('const x = 1;');
  });

  it('should render code blocks with language', () => {
    const renderer = new MarkdownRenderer({ maxWidth: 80 });
    const result = renderer.render('```typescript\nconst x = 1;\n```');
    expect(result).toContain('typescript');
    expect(result).toContain('const x = 1;');
  });

  it('should render lists', () => {
    const renderer = new MarkdownRenderer({ maxWidth: 80 });
    const result = renderer.render('- Item 1\n- Item 2');
    expect(result).toContain('Item 1');
    expect(result).toContain('Item 2');
  });

  it('should render ordered lists', () => {
    const renderer = new MarkdownRenderer({ maxWidth: 80 });
    const result = renderer.render('1. First\n2. Second');
    expect(result).toContain('1.');
    expect(result).toContain('2.');
  });

  it('should render blockquotes', () => {
    const renderer = new MarkdownRenderer({ maxWidth: 80 });
    const result = renderer.render('> Quote text');
    expect(result).toContain('Quote text');
  });

  it('should render horizontal rules', () => {
    const renderer = new MarkdownRenderer({ maxWidth: 80 });
    const result = renderer.render('---');
    expect(result).toContain('─');
  });

  it('should render inline code', () => {
    const renderer = new MarkdownRenderer({ maxWidth: 80 });
    const result = renderer.render('Use `code` here');
    expect(result).toContain('code');
  });

  it('should render bold text', () => {
    const renderer = new MarkdownRenderer({ maxWidth: 80 });
    const result = renderer.render('**bold**');
    expect(result).toContain('bold');
  });

  it('should render italic text', () => {
    const renderer = new MarkdownRenderer({ maxWidth: 80 });
    const result = renderer.render('*italic*');
    expect(result).toContain('italic');
  });

  it('should render links', () => {
    const renderer = new MarkdownRenderer({ maxWidth: 80 });
    const result = renderer.render('[link](http://example.com)');
    expect(result).toContain('link');
    expect(result).toContain('http://example.com');
  });
});

describe('CodeBlock', () => {
  it('should render code without language', () => {
    const codeBlock = new CodeBlock({ maxWidth: 80 });
    const result = codeBlock.render('const x = 1;');
    expect(result).toContain('const x = 1;');
  });

  it('should render code with line numbers', () => {
    const codeBlock = new CodeBlock({ maxWidth: 80, showLineNumbers: true });
    const result = codeBlock.render('line1\nline2\nline3');
    expect(result).toContain('1');
    expect(result).toContain('2');
    expect(result).toContain('3');
  });

  it('should render TypeScript with syntax highlighting', () => {
    const codeBlock = new CodeBlock({ maxWidth: 80 });
    const result = codeBlock.render('const x: string = "hello";', 'typescript');
    expect(result).toContain('typescript');
    expect(result).toContain('const');
    expect(result).toContain('string');
  });

  it('should render Python with syntax highlighting', () => {
    const codeBlock = new CodeBlock({ maxWidth: 80 });
    const result = codeBlock.render('def hello():\n    print("world")', 'python');
    expect(result).toContain('python');
    expect(result).toContain('def');
  });

  it('should render JavaScript with syntax highlighting', () => {
    const codeBlock = new CodeBlock({ maxWidth: 80 });
    const result = codeBlock.render('function hello() {\n  return "world";\n}', 'javascript');
    expect(result).toContain('javascript');
    expect(result).toContain('function');
  });

  it('should render Go with syntax highlighting', () => {
    const codeBlock = new CodeBlock({ maxWidth: 80 });
    const result = codeBlock.render('func hello() {\n    fmt.Println("world")\n}', 'go');
    expect(result).toContain('go');
    expect(result).toContain('func');
  });

  it('should render Rust with syntax highlighting', () => {
    const codeBlock = new CodeBlock({ maxWidth: 80 });
    const result = codeBlock.render('fn hello() {\n    println!("world");\n}', 'rust');
    expect(result).toContain('rust');
    expect(result).toContain('fn');
  });

  it('should render JSON with syntax highlighting', () => {
    const codeBlock = new CodeBlock({ maxWidth: 80 });
    const result = codeBlock.render('{"key": "value"}', 'json');
    expect(result).toContain('json');
    expect(result).toContain('key');
  });

  it('should truncate long lines', () => {
    const codeBlock = new CodeBlock({ maxWidth: 30 });
    const result = codeBlock.render('a'.repeat(100));
    expect(result.length).toBeLessThan(200);
  });
});
