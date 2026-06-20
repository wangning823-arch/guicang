#!/bin/bash
# 归藏 (Guicang) 持续改进脚本
# 由 crontab 每 30 分钟调用一次

cd /root/users/admin/projects/guicang

LOG_FILE="loop.log"
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

log "🚀 开始改进循环"

# 1. 检查代码质量
if ! npx tsc --noEmit 2>/dev/null; then
    log "❌ TypeScript 类型检查失败"
    exit 1
fi

if ! npx eslint src/ --quiet 2>/dev/null; then
    log "❌ ESLint 检查失败"
    exit 1
fi

# 2. 运行测试
TESTS=$(npx vitest run 2>&1 | tail -1)
log "测试: $TESTS"

# 3. 提交未保存的更改
if [ -n "$(git status --short)" ]; then
    git add -A
    git commit -m "chore: auto-save $(date '+%Y-%m-%d %H:%M')" --quiet
    log "📝 已提交"
fi

log "✅ 完成"
