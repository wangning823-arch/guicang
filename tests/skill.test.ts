import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerSkill,
  getSkill,
  getAllSkills,
  getRegisteredSkillNames,
  findMatchingSkills,
  executeSkill,
  clearSkillRegistry,
  CodeReviewSkill,
  SummarizeSkill,
} from '../src/skill/index.js';
import type { SkillContext } from '../src/skill/index.js';
import type { Message } from '../src/core/types.js';

describe('Skill Registry', () => {
  beforeEach(() => {
    clearSkillRegistry();
  });

  it('registers and retrieves skills', () => {
    const skill = new CodeReviewSkill();
    registerSkill(skill);

    expect(getSkill('code-review')).toBe(skill);
    expect(getRegisteredSkillNames()).toContain('code-review');
  });

  it('throws on duplicate registration', () => {
    registerSkill(new CodeReviewSkill());
    expect(() => registerSkill(new CodeReviewSkill())).toThrow('already registered');
  });

  it('returns all registered skills', () => {
    registerSkill(new CodeReviewSkill());
    registerSkill(new SummarizeSkill());

    expect(getAllSkills()).toHaveLength(2);
    expect(getRegisteredSkillNames()).toContain('code-review');
    expect(getRegisteredSkillNames()).toContain('summarize');
  });

  it('finds matching skills', () => {
    registerSkill(new CodeReviewSkill());
    registerSkill(new SummarizeSkill());

    // 短文本 - 两个都能处理
    const shortMsg: Message = { role: 'user', content: 'short' };
    const shortMatches = findMatchingSkills(shortMsg);
    expect(shortMatches.length).toBeGreaterThanOrEqual(1);

    // 长文本 - 两个都能处理
    const longMsg: Message = { role: 'user', content: 'x'.repeat(300) };
    const longMatches = findMatchingSkills(longMsg);
    expect(longMatches).toHaveLength(2);
  });
});

describe('CodeReviewSkill', () => {
  it('has correct config', () => {
    const skill = new CodeReviewSkill();
    expect(skill.name).toBe('code-review');
    expect(skill.config.tags).toContain('code');
  });

  it('detects console.log', async () => {
    const skill = new CodeReviewSkill();
    const context: SkillContext = {
      message: { role: 'user', content: 'console.log("hello")' },
      params: {},
      state: new Map(),
    };

    const result = await skill.execute(context);
    expect(result.success).toBe(true);
    expect(result.output).toContain('console.log');
  });

  it('detects security issues', async () => {
    const skill = new CodeReviewSkill();
    const context: SkillContext = {
      message: { role: 'user', content: 'eval(userInput)' },
      params: {},
      state: new Map(),
    };

    const result = await skill.execute(context);
    expect(result.output).toContain('eval()');
  });

  it('reports clean code', async () => {
    const skill = new CodeReviewSkill();
    const context: SkillContext = {
      message: { role: 'user', content: 'function add(a, b) { return a + b; }' },
      params: {},
      state: new Map(),
    };

    const result = await skill.execute(context);
    expect(result.output).toContain('No obvious issues');
  });
});

describe('SummarizeSkill', () => {
  it('has correct config', () => {
    const skill = new SummarizeSkill();
    expect(skill.name).toBe('summarize');
  });

  it('canHandle checks text length', () => {
    const skill = new SummarizeSkill();
    expect(skill.canHandle({ role: 'user', content: 'short' })).toBe(false);
    expect(skill.canHandle({ role: 'user', content: 'x'.repeat(300) })).toBe(true);
  });

  it('generates summary', async () => {
    const skill = new SummarizeSkill();
    const longText = 'First sentence. Second sentence. Third sentence. Fourth sentence.';
    const context: SkillContext = {
      message: { role: 'user', content: longText },
      params: {},
      state: new Map(),
    };

    const result = await skill.execute(context);
    expect(result.success).toBe(true);
    expect(result.output).toContain('摘要');
  });
});

describe('Skill Execution', () => {
  beforeEach(() => {
    clearSkillRegistry();
  });

  it('executes registered skill', async () => {
    registerSkill(new CodeReviewSkill());

    const context: SkillContext = {
      message: { role: 'user', content: 'const x = 1;' },
      params: {},
      state: new Map(),
    };

    const result = await executeSkill('code-review', context);
    expect(result.success).toBe(true);
  });

  it('returns error for unknown skill', async () => {
    const context: SkillContext = {
      message: { role: 'user', content: 'test' },
      params: {},
      state: new Map(),
    };

    const result = await executeSkill('unknown-skill', context);
    expect(result.success).toBe(false);
    expect(result.output).toContain('not found');
  });
});
