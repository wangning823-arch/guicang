import { describe, it, expect, beforeEach } from 'vitest';
import { SmartPrompt } from '../src/prompt/suggestions.js';

describe('SmartPrompt', () => {
  let prompt: SmartPrompt;

  beforeEach(() => {
    prompt = new SmartPrompt();
  });

  describe('getSuggestions', () => {
    it('should return suggestions when empty input', () => {
      const suggestions = prompt.getSuggestions({
        currentInput: '',
        recentCommands: [],
        activeTools: [],
      });
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should filter by input', () => {
      const suggestions = prompt.getSuggestions({
        currentInput: '文件',
        recentCommands: [],
        activeTools: [],
      });

      const fileSuggestion = suggestions.find((s) => s.label.includes('文件'));
      expect(fileSuggestion).toBeDefined();
    });

    it('should filter by command', () => {
      const suggestions = prompt.getSuggestions({
        currentInput: 'shell',
        recentCommands: [],
        activeTools: [],
      });

      const shellSuggestion = suggestions.find((s) => s.command === 'shell');
      expect(shellSuggestion).toBeDefined();
    });

    it('should limit results', () => {
      const suggestions = prompt.getSuggestions({
        currentInput: '',
        recentCommands: [],
        activeTools: [],
      });
      expect(suggestions.length).toBeLessThanOrEqual(10);
    });

    it('should sort by priority', () => {
      const suggestions = prompt.getSuggestions({
        currentInput: '',
        recentCommands: [],
        activeTools: [],
      });

      for (let i = 1; i < suggestions.length; i++) {
        expect(suggestions[i].priority).toBeLessThanOrEqual(
          suggestions[i - 1].priority,
        );
      }
    });
  });

  describe('command history', () => {
    it('should add to history', () => {
      prompt.addToHistory('read_file test.txt');
      const history = prompt.getHistory();
      expect(history).toContain('read_file test.txt');
    });

    it('should limit history', () => {
      for (let i = 0; i < 50; i++) {
        prompt.addToHistory(`cmd${i}`);
      }
      const history = prompt.getHistory(10);
      expect(history.length).toBe(10);
      expect(history[0]).toBe('cmd40');
    });

    it('should get popular commands', () => {
      prompt.addToHistory('cmd1');
      prompt.addToHistory('cmd1');
      prompt.addToHistory('cmd1');
      prompt.addToHistory('cmd2');
      prompt.addToHistory('cmd2');

      const popular = prompt.getPopularCommands(5);
      expect(popular.length).toBe(2);
      expect(popular[0].command).toBe('cmd1');
      expect(popular[0].count).toBe(3);
    });
  });

  describe('custom suggestions', () => {
    it('should add custom suggestion', () => {
      prompt.addSuggestion({
        id: 'custom-1',
        type: 'command',
        label: '自定义命令',
        description: '这是一个自定义命令',
        icon: '🔧',
        priority: 10,
      });

      const suggestions = prompt.getSuggestions({
        currentInput: '自定义',
        recentCommands: [],
        activeTools: [],
      });

      expect(suggestions.find((s) => s.id === 'custom-1')).toBeDefined();
    });

    it('should remove suggestion', () => {
      const result = prompt.removeSuggestion('tool-file-read');
      expect(result).toBe(true);

      const suggestions = prompt.getSuggestions({
        currentInput: '读取文件',
        recentCommands: [],
        activeTools: [],
      });

      expect(suggestions.find((s) => s.id === 'tool-file-read')).toBeUndefined();
    });

    it('should return false when removing non-existent', () => {
      const result = prompt.removeSuggestion('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('context boosting', () => {
    it('should boost suggestions based on recent commands', () => {
      const suggestions = prompt.getSuggestions({
        currentInput: '',
        recentCommands: ['shell'],
        activeTools: [],
      });

      const shellSuggestion = suggestions.find((s) => s.command === 'shell');
      expect(shellSuggestion).toBeDefined();
      // Shell should be boosted because it's in recent commands
    });
  });

  describe('default suggestions', () => {
    it('should have tool suggestions', () => {
      const suggestions = prompt.getSuggestions({
        currentInput: '',
        recentCommands: [],
        activeTools: [],
      });

      const toolSuggestions = suggestions.filter((s) => s.type === 'tool');
      expect(toolSuggestions.length).toBeGreaterThan(0);
    });

    it('should have config suggestions', () => {
      const suggestions = prompt.getSuggestions({
        currentInput: '',
        recentCommands: [],
        activeTools: [],
      });

      const configSuggestions = suggestions.filter((s) => s.type === 'config');
      expect(configSuggestions.length).toBeGreaterThan(0);
    });

    it('should have workflow suggestions', () => {
      const suggestions = prompt.getSuggestions({
        currentInput: '',
        recentCommands: [],
        activeTools: [],
      });

      const workflowSuggestions = suggestions.filter((s) => s.type === 'workflow');
      expect(workflowSuggestions.length).toBeGreaterThan(0);
    });

    it('should have help suggestions', () => {
      const suggestions = prompt.getSuggestions({
        currentInput: '',
        recentCommands: [],
        activeTools: [],
      });

      const helpSuggestions = suggestions.filter((s) => s.type === 'help');
      expect(helpSuggestions.length).toBeGreaterThan(0);
    });
  });
});
