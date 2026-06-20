#!/usr/bin/env node
/**
 * 归藏 (Guicang) 持续改进循环
 * 独立运行的后台任务，每 30 分钟执行一次改进
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const PROJECT_ROOT = process.cwd();
const TODO_PATH = join(PROJECT_ROOT, 'TODO.md');

/** 执行 shell 命令 */
function run(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', cwd: PROJECT_ROOT }).trim();
  } catch (error) {
    console.error(`[ERROR] Command failed: ${cmd}`);
    return '';
  }
}

/** 检查类型和 lint */
function checkQuality(): boolean {
  console.log('🔍 Running type check...');
  const tsc = run('npx tsc --noEmit');
  if (tsc) {
    console.log('❌ Type check failed');
    return false;
  }

  console.log('🔍 Running lint...');
  const lint = run('npx eslint src/ --quiet');
  if (lint) {
    console.log('❌ Lint failed');
    return false;
  }

  return true;
}

/** 运行测试 */
function runTests(): boolean {
  console.log('🧪 Running tests...');
  const result = run('npx vitest run 2>&1 | tail -5');
  console.log(result);
  return result.includes('passed');
}

/** Git commit */
function gitCommit(message: string): void {
  run('git add -A');
  run(`git commit -m "${message}"`);
}

/** 主循环 */
async function main() {
  console.log('🌊 归藏持续改进循环启动');
  console.log(`⏰ 每 30 分钟执行一次`);
  console.log(`📁 项目路径: ${PROJECT_ROOT}`);
  console.log('');

  // 立即执行一次
  await runImprovementCycle();

  // 设置定时器
  setInterval(async () => {
    await runImprovementCycle();
  }, 30 * 60 * 1000); // 30 分钟
}

/** 执行一次改进循环 */
async function runImprovementCycle() {
  const startTime = Date.now();
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🕐 开始改进循环 - ${new Date().toLocaleString()}`);
  console.log('='.repeat(50));

  // 1. 检查代码质量
  if (!checkQuality()) {
    console.log('⏸️  跳过：代码质量问题');
    return;
  }

  // 2. 运行测试
  if (!runTests()) {
    console.log('⏸️  跳过：测试失败');
    return;
  }

  // 3. 获取当前 git 状态
  const status = run('git status --short');
  if (status) {
    console.log('📝 有未提交的更改，先提交...');
    gitCommit('chore: save progress before improvement cycle');
  }

  // 4. 记录本次循环
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ 改进循环完成 (${duration}s)`);
  console.log(`📊 测试: ${run('npx vitest run 2>&1 | grep "Tests" | tail -1')}`);
}

main().catch(console.error);
