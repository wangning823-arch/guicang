import { describe, it, expect, beforeEach } from 'vitest';
import { CommandHistory } from '../src/history/command-history.js';

describe('CommandHistory', () => {
  let history: CommandHistory;

  beforeEach(() => {
    history = new CommandHistory(10);
  });

  describe('basic operations', () => {
    it('should add history entry', () => {
      const entry = history.add('shell', { command: 'ls' });
      expect(entry.id).toBeDefined();
      expect(entry.command).toBe('shell');
      expect(entry.status).toBe('pending');
    });

    it('should complete entry', () => {
      const entry = history.add('shell', { command: 'ls' });
      history.complete(entry.id, { output: 'file.txt' });

      const entries = history.getHistory();
      expect(entries[0].status).toBe('completed');
      expect(entries[0].result).toEqual({ output: 'file.txt' });
    });

    it('should fail entry', () => {
      const entry = history.add('shell', { command: 'ls' });
      history.fail(entry.id, 'command not found');

      const entries = history.getHistory();
      expect(entries[0].status).toBe('failed');
    });
  });

  describe('undo/redo', () => {
    it('should undo last completed entry', () => {
      const entry = history.add('shell', { command: 'ls' });
      history.complete(entry.id, { output: 'file.txt' });

      const undone = history.undoLast();
      expect(undone).not.toBeNull();
      expect(undone!.status).toBe('undone');
    });

    it('should return null when undoing empty history', () => {
      const undone = history.undoLast();
      expect(undone).toBeNull();
    });

    it('should not undo pending entries', () => {
      history.add('shell', { command: 'ls' });

      const undone = history.undoLast();
      expect(undone).toBeNull();
    });

    it('should redo undone entry', () => {
      const entry = history.add('shell', { command: 'ls' });
      history.complete(entry.id, { output: 'file.txt' });

      history.undoLast();
      const redone = history.redoLast();

      expect(redone).not.toBeNull();
      expect(redone!.status).toBe('completed');
    });

    it('should return null when redoing empty stack', () => {
      const redone = history.redoLast();
      expect(redone).toBeNull();
    });
  });

  describe('querying', () => {
    it('should get history by command', () => {
      history.add('shell', { command: 'ls' });
      history.add('read_file', { path: 'test.txt' });
      history.add('shell', { command: 'pwd' });

      const shellCommands = history.getByCommand('shell');
      expect(shellCommands.length).toBe(2);
    });

    it('should get recent commands', () => {
      history.add('shell', {});
      history.add('read_file', {});
      history.add('shell', {});
      history.add('web_search', {});

      const recent = history.getRecentCommands(2);
      expect(recent).toEqual(['web_search', 'shell']);
    });

    it('should search history', () => {
      history.add('shell', { command: 'ls -la' });
      history.add('read_file', { path: 'test.txt' });

      const results = history.search('ls');
      expect(results.length).toBe(1);
      expect(results[0].command).toBe('shell');
    });
  });

  describe('stats', () => {
    it('should track stats', () => {
      history.add('shell', {});
      history.add('read_file', {});
      history.complete(history.getHistory()[0].id, {});
      history.fail(history.getHistory()[1].id, 'error');

      const stats = history.getStats();
      expect(stats.total).toBe(2);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.uniqueCommands).toBe(2);
    });
  });

  describe('limits', () => {
    it('should respect max history', () => {
      for (let i = 0; i < 15; i++) {
        history.add(`cmd${i}`, {});
      }

      expect(history.getHistory().length).toBe(10);
    });

    it('should limit history results', () => {
      for (let i = 0; i < 10; i++) {
        history.add(`cmd${i}`, {});
      }

      expect(history.getHistory(5).length).toBe(5);
    });
  });

  describe('clear', () => {
    it('should clear all history', () => {
      history.add('shell', {});
      history.clear();

      expect(history.getHistory().length).toBe(0);
    });
  });

  describe('undo data', () => {
    it('should store undo data', () => {
      const entry = history.add('file_write', { path: 'test.txt' }, {
        oldContent: 'original',
      });

      expect(entry.undoData).toEqual({ oldContent: 'original' });
    });
  });
});
