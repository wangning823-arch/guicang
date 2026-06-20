/**
 * CLI 渠道
 * 通过标准输入/输出与用户交互
 * 支持交互式终端和管道输入两种模式
 */

import * as readline from 'node:readline';
import { BaseChannel, type ChannelMessage } from './base.js';
import { Logger } from '../core/logger.js';

export class CLIChannel extends BaseChannel {
  readonly type = 'cli';
  private rl: readline.Interface | null = null;
  private logger = new Logger('channel:cli');
  private isInteractive = process.stdin.isTTY;

  async start(): Promise<void> {
    this.running = true;

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '你> ',
    });

    this.logger.info('CLI channel started', { interactive: this.isInteractive });

    // 显示欢迎消息
    console.log('\n🌊 归藏 (Guicang) — 万物归藏，一念即达');
    if (this.isInteractive) {
      console.log('   输入消息与 Agent 对话，输入 /quit 退出\n');
    } else {
      console.log('   非交互模式：从 stdin 读取输入\n');
    }

    this.rl.prompt();

    this.rl.on('line', async (line) => {
      const input = line.trim();

      // 退出命令
      if (input === '/quit' || input === '/exit') {
        await this.stop();
        return;
      }

      // 空输入忽略
      if (!input) {
        if (this.isInteractive) {
          this.rl?.prompt();
        }
        return;
      }

      const message: ChannelMessage = {
        id: this.generateMessageId(),
        sender: 'user',
        content: input,
        timestamp: new Date(),
      };

      try {
        const result = await this.handleMessage(message);
        if (result) {
          // 找到 assistant 的最终回复
          const lastAssistant = result.messages
            .filter((m) => m.role === 'assistant')
            .pop();

          if (lastAssistant) {
            console.log(`\n🤖 ${lastAssistant.content}\n`);
          }

          // 显示工具调用信息
          if (result.toolCalls.length > 0) {
            console.log(`   📎 使用了 ${result.toolCalls.length} 个工具`);
          }
        }
      } catch (error) {
        console.error('\n❌ Error:', error instanceof Error ? error.message : error);
      }

      if (this.isInteractive) {
        this.rl?.prompt();
      }
    });

    this.rl.on('close', () => {
      this.running = false;
      this.logger.info('CLI channel closed');
    });
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
    this.logger.info('CLI channel stopped');
    process.exit(0);
  }

  async send(message: string): Promise<void> {
    console.log(message);
  }
}
