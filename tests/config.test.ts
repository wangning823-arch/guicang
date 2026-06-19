import { describe, it, expect } from 'vitest';
import { parseToml } from '../src/config/loader.js';
import { DEFAULT_CONFIG } from '../src/config/schema.js';
import { Logger } from '../src/core/logger.js';

describe('TOML Parser', () => {
  it('parses simple key-value pairs', () => {
    const toml = `
name = "test"
logLevel = "debug"
port = 8080
enabled = true
`;
    const result = parseToml(toml);
    expect(result.name).toBe('test');
    expect(result.logLevel).toBe('debug');
    expect(result.port).toBe(8080);
    expect(result.enabled).toBe(true);
  });

  it('parses nested sections', () => {
    const toml = `
[server]
host = "localhost"
port = 3000

[database]
url = "postgres://localhost/db"
`;
    const result = parseToml(toml);
    expect(result.server).toEqual({ host: 'localhost', port: 3000 });
    expect(result.database).toEqual({ url: 'postgres://localhost/db' });
  });

  it('skips comments and empty lines', () => {
    const toml = `
# This is a comment
name = "test"

# Another comment
port = 8080
`;
    const result = parseToml(toml);
    expect(result.name).toBe('test');
    expect(result.port).toBe(8080);
  });

  it('handles null values', () => {
    const toml = `value = null`;
    const result = parseToml(toml);
    expect(result.value).toBeNull();
  });
});

describe('Default Config', () => {
  it('has sensible defaults', () => {
    expect(DEFAULT_CONFIG.name).toBe('guicang');
    expect(DEFAULT_CONFIG.logLevel).toBe('info');
    expect(DEFAULT_CONFIG.tools.executionTimeout).toBe(30_000);
    expect(DEFAULT_CONFIG.tools.maxConcurrency).toBe(5);
    expect(DEFAULT_CONFIG.memory.shortTermLimit).toBe(100);
  });
});

describe('Logger', () => {
  it('creates logger with module name', () => {
    const log = new Logger('test');
    expect(log).toBeDefined();
  });

  it('creates child logger', () => {
    const parent = new Logger('parent');
    const child = parent.child('child');
    expect(child).toBeDefined();
  });

  it('respects log level filtering', () => {
    const log = new Logger('test', 'error');
    // Should not throw - just filters out lower levels
    log.debug('should be filtered');
    log.info('should be filtered');
    log.warn('should be filtered');
    log.error('should pass');
  });
});
