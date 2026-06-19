/**
 * 技能注册中心
 * 管理所有可用技能的注册和查找
 */

import { BaseSkill, type SkillContext, type SkillResult } from './base.js';
import type { Message } from '../core/types.js';

/** 技能注册表 */
const skillRegistry = new Map<string, BaseSkill>();

/** 已初始化的技能 */
const initializedSkills = new Set<string>();

/**
 * 注册技能
 */
export function registerSkill(skill: BaseSkill): void {
  if (skillRegistry.has(skill.name)) {
    throw new Error(`Skill "${skill.name}" is already registered`);
  }
  skillRegistry.set(skill.name, skill);
}

/**
 * 批量注册技能
 */
export function registerSkills(skills: BaseSkill[]): void {
  for (const skill of skills) {
    registerSkill(skill);
  }
}

/**
 * 获取技能实例
 */
export function getSkill(name: string): BaseSkill | undefined {
  return skillRegistry.get(name);
}

/**
 * 获取所有已注册技能
 */
export function getAllSkills(): BaseSkill[] {
  return [...skillRegistry.values()];
}

/**
 * 获取所有已注册技能名称
 */
export function getRegisteredSkillNames(): string[] {
  return [...skillRegistry.keys()];
}

/**
 * 查找能处理消息的技能
 */
export function findMatchingSkills(message: Message): BaseSkill[] {
  return [...skillRegistry.values()].filter((skill) => skill.canHandle(message));
}

/**
 * 执行技能
 */
export async function executeSkill(
  name: string,
  context: SkillContext,
): Promise<SkillResult> {
  const skill = skillRegistry.get(name);
  if (!skill) {
    return {
      success: false,
      output: `Skill "${name}" not found. Available skills: ${getRegisteredSkillNames().join(', ')}`,
    };
  }

  // 自动初始化
  if (!initializedSkills.has(name) && skill.initialize) {
    await skill.initialize();
    initializedSkills.add(name);
  }

  try {
    return await skill.execute(context);
  } catch (error) {
    return {
      success: false,
      output: `Skill "${name}" failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * 初始化所有已注册技能
 */
export async function initializeAllSkills(): Promise<void> {
  for (const [name, skill] of skillRegistry) {
    if (!initializedSkills.has(name) && skill.initialize) {
      await skill.initialize();
      initializedSkills.add(name);
    }
  }
}

/**
 * 清理所有已注册技能
 */
export async function cleanupAllSkills(): Promise<void> {
  for (const [name, skill] of skillRegistry) {
    if (initializedSkills.has(name) && skill.cleanup) {
      await skill.cleanup();
      initializedSkills.delete(name);
    }
  }
}

/**
 * 清空注册表（测试用）
 */
export function clearSkillRegistry(): void {
  skillRegistry.clear();
  initializedSkills.clear();
}
