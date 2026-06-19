import { describe, it, expect } from 'vitest';
import { ProcessSandbox } from '../src/sandbox/index.js';
import type { SandboxConfig } from '../src/sandbox/index.js';

describe('ProcessSandbox', () => {
  const defaultConfig: Partial<SandboxConfig> = {
    allowedPermissions: ['file:read', 'file:write', 'shell:execute'],
    blockedPaths: ['/etc', '/proc'],
  };

  it('allows permitted operations', () => {
    const sandbox = new ProcessSandbox(defaultConfig);
    const result = sandbox.checkPermission('file:read', 'src/test.ts');
    expect(result.allowed).toBe(true);
  });

  it('denies non-permitted operations', () => {
    const sandbox = new ProcessSandbox(defaultConfig);
    const result = sandbox.checkPermission('network:outbound');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('not allowed');
  });

  it('blocks restricted paths', () => {
    const sandbox = new ProcessSandbox(defaultConfig);
    const result = sandbox.checkPermission('file:read', '/etc/passwd');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('blocked');
  });

  it('allows non-blocked paths', () => {
    const sandbox = new ProcessSandbox(defaultConfig);
    const result = sandbox.checkPermission('file:read', 'src/index.ts');
    expect(result.allowed).toBe(true);
  });

  it('executes commands', async () => {
    const sandbox = new ProcessSandbox(defaultConfig);
    const result = await sandbox.execute('echo hello');
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello');
  });

  it('handles command failure', async () => {
    const sandbox = new ProcessSandbox(defaultConfig);
    const result = await sandbox.execute('exit 1');
    expect(result.exitCode).toBe(1);
  });

  it('checks domain allowlist', () => {
    const sandbox = new ProcessSandbox({
      ...defaultConfig,
      allowedDomains: ['example.com', 'api.github.com'],
    });

    expect(sandbox.isDomainAllowed('example.com')).toBe(true);
    expect(sandbox.isDomainAllowed('sub.example.com')).toBe(true);
    expect(sandbox.isDomainAllowed('evil.com')).toBe(false);
  });

  it('returns config', () => {
    const sandbox = new ProcessSandbox(defaultConfig);
    const config = sandbox.getConfig();
    expect(config.allowedPermissions).toContain('file:read');
  });

  it('isPathBlocked works', () => {
    const sandbox = new ProcessSandbox(defaultConfig);
    expect(sandbox.isPathBlocked('/etc/passwd')).toBe(true);
    expect(sandbox.isPathBlocked('/proc/1')).toBe(true);
    expect(sandbox.isPathBlocked('src/index.ts')).toBe(false);
  });
});
