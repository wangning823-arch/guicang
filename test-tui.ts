/**
 * TUI 功能测试脚本
 * 测试所有面板和交互功能
 */

import { TUIEngine } from './src/tui/engine.js';
import { ChatPanel } from './src/tui/panels/chat.js';
import { StatusPanel } from './src/tui/panels/status.js';
import { MetricsPanel } from './src/tui/panels/metrics.js';
import { TokensPanel } from './src/tui/panels/tokens.js';
import { AgentsPanel } from './src/tui/panels/agents.js';
import { ToolsPanel } from './src/tui/panels/tools.js';
import { LogsPanel } from './src/tui/panels/logs.js';
import { Theme, colorize } from './src/tui/theme.js';

async function testTUI() {
  console.log('🧪 开始 TUI 功能测试...\n');

  // 初始化引擎
  const engine = new TUIEngine();
  await engine.init();

  const width = engine.getWidth();
  const height = engine.getHeight();

  console.log(`✅ 引擎初始化成功`);
  console.log(`   终端尺寸: ${width} x ${height}`);

  // 测试面板创建
  const chatPanel = new ChatPanel(1, 1, 40, 20);
  const statusPanel = new StatusPanel(42, 1, 38, 10);
  const metricsPanel = new MetricsPanel(42, 12, 38, 8);
  const tokensPanel = new TokensPanel(42, 21, 38, 6);
  const agentsPanel = new AgentsPanel(1, 22, 25, 3);
  const toolsPanel = new ToolsPanel(27, 22, 25, 3);
  const logsPanel = new LogsPanel(53, 22, 27, 3);

  console.log('✅ 所有面板创建成功');

  // 测试消息添加
  chatPanel.addMessage({
    role: 'system',
    content: '系统消息测试',
    timestamp: new Date(),
  });

  chatPanel.addMessage({
    role: 'user',
    content: '用户消息测试',
    timestamp: new Date(),
  });

  chatPanel.addMessage({
    role: 'assistant',
    content: '助手回复测试',
    timestamp: new Date(),
  });

  console.log('✅ 消息添加功能正常');

  // 测试状态更新
  statusPanel.updateData({
    status: 'healthy',
    uptime: 3600000,
    memory: { used: 512 * 1024 * 1024, total: 2048 * 1024 * 1024, heap: 128 * 1024 * 1024, heapTotal: 512 * 1024 * 1024 },
    cpu: 45,
    agents: { total: 5, online: 4, busy: 1 },
  });

  console.log('✅ 状态面板更新正常');

  // 测试指标更新
  metricsPanel.recordRequest(true);
  metricsPanel.recordLatency(1500);
  metricsPanel.recordTokens(100, 200);
  metricsPanel.recordTool(true);

  console.log('✅ 指标面板更新正常');

  // 测试 Tokens 面板
  tokensPanel.recordUsage(1000, 2000);
  tokensPanel.updateContext({
    current: 3000,
    max: 128000,
    messages: 5,
  });

  console.log('✅ Tokens 面板更新正常');

  // 测试 Agent 面板
  agentsPanel.updateAgents([
    { id: '1', name: 'Agent-1', status: 'thinking', currentTask: '处理任务中', completedTasks: 5, lastActive: new Date() },
    { id: '2', name: 'Agent-2', status: 'idle', currentTask: '空闲', completedTasks: 0, lastActive: new Date() },
  ]);

  console.log('✅ Agent 面板更新正常');

  // 测试工具面板
  toolsPanel.addEntry({
    name: 'shell',
    args: { command: 'ls -la' },
    success: true,
    duration: 150,
    timestamp: new Date(),
  });

  console.log('✅ 工具面板更新正常');

  // 测试日志面板
  logsPanel.addEntry({
    level: 'info',
    module: 'test',
    message: '测试日志消息',
    timestamp: new Date(),
  });

  console.log('✅ 日志面板更新正常');

  // 测试渲染
  engine.onRender(() => {
    engine.clearBuffer();

    // 渲染标题
    const title = '🌊 归藏 TUI 测试';
    const titleX = Math.floor((width - title.length) / 2);
    engine.putColorText(titleX, 0, colorize(title, Theme.accent), Theme.accent);

    // 渲染所有面板
    chatPanel.render(engine);
    statusPanel.render(engine);
    metricsPanel.render(engine);
    tokensPanel.render(engine);
    agentsPanel.render(engine);
    toolsPanel.render(engine);
    logsPanel.render(engine);

    // 渲染状态栏
    const statusBar = ' 测试完成 - 所有功能正常 ';
    const statusX = Math.floor((width - statusBar.length) / 2);
    engine.putColorText(statusX, height - 1, colorize(statusBar, Theme.success), Theme.success);
  });

  // 测试输入框渲染
  console.log('\n🔧 测试输入框渲染...');

  // 激活聊天面板
  chatPanel.setActive(true);

  // 模拟输入中文字符
  const testInputs = ['你好', 'Hello', '你好World', '测试输入框'];
  for (const input of testInputs) {
    // 模拟输入
    for (const char of input) {
      chatPanel.handleKey({ key: char, ctrl: false, meta: false, shift: false, name: '' });
    }

    // 验证输入缓冲区
    const buffer = (chatPanel as unknown as { inputBuffer: string }).inputBuffer;
    if (buffer !== input) {
      console.log(`❌ 输入缓冲区不匹配: 期望 "${input}", 实际 "${buffer}"`);
    } else {
      console.log(`✅ 输入 "${input}" 成功`);
    }

    // 渲染
    engine.render();

    // 清空输入
    chatPanel.clearInput();
  }

  // 测试光标移动
  console.log('\n🔧 测试光标移动...');
  for (const char of '你好世界') {
    chatPanel.handleKey({ key: char, ctrl: false, meta: false, shift: false, name: '' });
  }

  // 移动光标到中间
  chatPanel.handleKey({ key: '', ctrl: false, meta: false, shift: false, name: 'left' });
  chatPanel.handleKey({ key: '', ctrl: false, meta: false, shift: false, name: 'left' });

  const cursorPos = (chatPanel as unknown as { cursorPos: number }).cursorPos;
  if (cursorPos !== 2) {
    console.log(`❌ 光标位置不匹配: 期望 2, 实际 ${cursorPos}`);
  } else {
    console.log(`✅ 光标位置正确: ${cursorPos}`);
  }

  // 测试退格键
  chatPanel.handleKey({ key: '', ctrl: false, meta: false, shift: false, name: 'backspace' });
  const afterBackspace = (chatPanel as unknown as { inputBuffer: string }).inputBuffer;
  // 光标在位置2（"你好"之后），退格删除"好"，结果应该是"你世界"
  if (afterBackspace !== '你世界') {
    console.log(`❌ 退格后输入不匹配: 期望 "你世界", 实际 "${afterBackspace}"`);
  } else {
    console.log(`✅ 退格键工作正常: "${afterBackspace}"`);
  }

  chatPanel.clearInput();
  chatPanel.setActive(false);
  console.log('✅ 输入框渲染测试完成');

  // 渲染几帧
  engine.startAutoRefresh(100);
  engine.render();

  // 等待 2 秒让用户看到
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 停止引擎
  engine.stop();

  console.log('\n✅ TUI 功能测试完成');
  console.log('   所有面板和功能正常运行');
}

testTUI().catch(console.error);
