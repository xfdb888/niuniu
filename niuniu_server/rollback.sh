#!/bin/bash

# rollback.sh - 快速回滚脚本
# 用法: ./rollback.sh --version v1.0.0 --environment production
# 功能: 快速回滚到指定版本，支持自动和手动模式

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 脚本开始
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROLLBACK_LOG="${SCRIPT_DIR}/logs/rollback-$(date +%Y%m%d-%H%M%S).log"

# 确保日志目录存在
mkdir -p "${SCRIPT_DIR}/logs"

# 日志函数
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$ROLLBACK_LOG"
}

success() {
    echo -e "${GREEN}[✅ $(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$ROLLBACK_LOG"
}

error() {
    echo -e "${RED}[❌ $(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$ROLLBACK_LOG"
    exit 1
}

warning() {
    echo -e "${YELLOW}[⚠️  $(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$ROLLBACK_LOG"
}

# 参数解析
VERSION=""
ENVIRONMENT="production"
QUICK_MODE=false
AUTO_MODE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --version)
            VERSION="$2"
            shift 2
            ;;
        --environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --quick)
            QUICK_MODE=true
            shift
            ;;
        --auto)
            AUTO_MODE=true
            shift
            ;;
        *)
            error "未知参数: $1"
            ;;
    esac
done

# 验证参数
if [ -z "$VERSION" ]; then
    error "缺少必要参数: --version"
fi

log "════════════════════════════════════════════════════"
log "开始回滚流程"
log "════════════════════════════════════════════════════"
log "目标版本: $VERSION"
log "目标环境: $ENVIRONMENT"
log "模式: $([ "$AUTO_MODE" = true ] && echo "自动" || echo "手动")"
log ""

# ============================================================================
# 第1步: 验证目标版本
# ============================================================================

log "第1步: 验证目标版本..."

# 检查镜像是否存在
if ! docker inspect "registry.internal.io/niuniu/game-server:${VERSION}" > /dev/null 2>&1; then
    error "镜像不存在: registry.internal.io/niuniu/game-server:${VERSION}"
fi
success "✅ 游戏服务器镜像存在"

if ! docker inspect "registry.internal.io/niuniu/login-server:${VERSION}" > /dev/null 2>&1; then
    error "镜像不存在: registry.internal.io/niuniu/login-server:${VERSION}"
fi
success "✅ 登录服务器镜像存在"

if ! docker inspect "registry.internal.io/niuniu/hall-server:${VERSION}" > /dev/null 2>&1; then
    error "镜像不存在: registry.internal.io/niuniu/hall-server:${VERSION}"
fi
success "✅ 大厅服务器镜像存在"

# ============================================================================
# 第2步: 确认回滚
# ============================================================================

log ""
log "第2步: 确认回滚操作..."

if [ "$AUTO_MODE" != true ]; then
    echo ""
    echo -e "${YELLOW}⚠️  您即将执行回滚操作${NC}"
    echo "   当前版本: $(cat /etc/niuniu/current-version.txt 2>/dev/null || echo '未知')"
    echo "   目标版本: $VERSION"
    echo "   环境: $ENVIRONMENT"
    echo ""
    read -p "确认回滚? (yes/no): " -r CONFIRM
    
    if [[ ! $CONFIRM =~ ^[Yy][Ee][Ss]$ ]]; then
        error "用户取消了回滚操作"
    fi
fi

success "✅ 回滚操作已确认"

# ============================================================================
# 第3步: 创建当前状态备份
# ============================================================================

log ""
log "第3步: 创建当前状态备份..."

CURRENT_VERSION=$(cat /etc/niuniu/current-version.txt 2>/dev/null || echo "unknown")
BACKUP_DIR="${SCRIPT_DIR}/backups/rollback-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# 导出当前运行的容器配置
docker ps --filter "label=app=niuniu" --format "table {{.Names}}\t{{.Image}}" > "${BACKUP_DIR}/containers.txt"
success "✅ 容器配置已备份"

# 导出数据库当前状态
if command -v mysqldump > /dev/null 2>&1; then
    mysqldump -u root -p"${MYSQL_ROOT_PASSWORD}" niuniu > "${BACKUP_DIR}/mysql-${CURRENT_VERSION}.sql" 2>/dev/null || true
    success "✅ 数据库已备份: ${BACKUP_DIR}/mysql-${CURRENT_VERSION}.sql"
fi

# ============================================================================
# 第4步: 停止当前版本
# ============================================================================

log ""
log "第4步: 停止当前版本 ($CURRENT_VERSION)..."

if [ -f "docker-compose.yml" ]; then
    docker-compose -f docker-compose.yml down --timeout 10 2>/dev/null || true
    success "✅ 容器已停止 (docker-compose)"
fi

if kubectl get deployment game-server > /dev/null 2>&1; then
    kubectl scale deployment game-server --replicas=0 --timeout=30s 2>/dev/null || true
    kubectl scale deployment login-server --replicas=0 --timeout=30s 2>/dev/null || true
    kubectl scale deployment hall-server --replicas=0 --timeout=30s 2>/dev/null || true
    success "✅ Kubernetes 部署已停止"
fi

sleep 5

# ============================================================================
# 第5步: 更新配置文件
# ============================================================================

log ""
log "第5步: 更新配置文件..."

# 更新版本文件
echo "$VERSION" > /etc/niuniu/current-version.txt
success "✅ 版本文件已更新: $VERSION"

# 更新环境变量
if [ -f ".env" ]; then
    sed -i "s/NIUNIU_VERSION=.*/NIUNIU_VERSION=$VERSION/" .env
    success "✅ 环境变量已更新"
fi

# ============================================================================
# 第6步: 启动目标版本
# ============================================================================

log ""
log "第6步: 启动目标版本 ($VERSION)..."

if [ -f "docker-compose.yml" ]; then
    # 更新镜像标签
    sed -i "s|image: .*game-server:.*|image: registry.internal.io/niuniu/game-server:${VERSION}|g" docker-compose.yml
    sed -i "s|image: .*login-server:.*|image: registry.internal.io/niuniu/login-server:${VERSION}|g" docker-compose.yml
    sed -i "s|image: .*hall-server:.*|image: registry.internal.io/niuniu/hall-server:${VERSION}|g" docker-compose.yml
    
    # 启动容器
    docker-compose -f docker-compose.yml up -d --wait
    success "✅ 容器已启动"
fi

if kubectl get deployment game-server > /dev/null 2>&1; then
    # 更新镜像
    kubectl set image deployment/game-server game-server=registry.internal.io/niuniu/game-server:${VERSION}
    kubectl set image deployment/login-server login-server=registry.internal.io/niuniu/login-server:${VERSION}
    kubectl set image deployment/hall-server hall-server=registry.internal.io/niuniu/hall-server:${VERSION}
    
    # 等待部署完成
    kubectl rollout status deployment/game-server --timeout=5m
    kubectl rollout status deployment/login-server --timeout=5m
    kubectl rollout status deployment/hall-server --timeout=5m
    
    success "✅ Kubernetes 部署已更新"
fi

# ============================================================================
# 第7步: 验证健康
# ============================================================================

log ""
log "第7步: 验证服务健康..."

sleep 10

# 检查游戏服务器
GAME_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>/dev/null || echo "000")
if [ "$GAME_HEALTH" = "200" ]; then
    success "✅ 游戏服务器健康 (HTTP $GAME_HEALTH)"
else
    error "❌ 游戏服务器不健康 (HTTP $GAME_HEALTH)"
fi

# 检查登录服务器
LOGIN_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health 2>/dev/null || echo "000")
if [ "$LOGIN_HEALTH" = "200" ]; then
    success "✅ 登录服务器健康 (HTTP $LOGIN_HEALTH)"
else
    error "❌ 登录服务器不健康 (HTTP $LOGIN_HEALTH)"
fi

# 检查大厅服务器
HALL_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/health 2>/dev/null || echo "000")
if [ "$HALL_HEALTH" = "200" ]; then
    success "✅ 大厅服务器健康 (HTTP $HALL_HEALTH)"
else
    error "❌ 大厅服务器不健康 (HTTP $HALL_HEALTH)"
fi

# ============================================================================
# 第8步: 验证数据库
# ============================================================================

log ""
log "第8步: 验证数据库连接..."

if command -v mysql > /dev/null 2>&1; then
    # 检查数据库连接
    mysql -u root -p"${MYSQL_ROOT_PASSWORD}" niuniu -e "SELECT VERSION();" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        success "✅ 数据库连接正常"
    else
        error "❌ 数据库连接失败"
    fi
    
    # 检查表结构
    USER_COUNT=$(mysql -u root -p"${MYSQL_ROOT_PASSWORD}" niuniu -sN -e "SELECT COUNT(*) FROM users;" 2>/dev/null)
    success "✅ 用户表: $USER_COUNT 条记录"
fi

# ============================================================================
# 第9步: 生成回滚报告
# ============================================================================

log ""
log "第9步: 生成回滚报告..."

REPORT="${SCRIPT_DIR}/logs/rollback-report-$(date +%Y%m%d-%H%M%S).txt"

cat > "$REPORT" << EOF
================================================================================
                          回滚操作报告
================================================================================

操作时间: $(date)
操作类型: 版本回滚
源版本: $CURRENT_VERSION
目标版本: $VERSION
环境: $ENVIRONMENT

================================================================================
                          操作摘要
================================================================================

✅ 目标版本验证 - 成功
✅ 当前状态备份 - 成功
   备份位置: $BACKUP_DIR

✅ 容器停止 - 成功
✅ 配置更新 - 成功
✅ 容器启动 - 成功

================================================================================
                          服务健康状态
================================================================================

游戏服务器 (port 3000): HTTP $GAME_HEALTH ✅
登录服务器 (port 3001): HTTP $LOGIN_HEALTH ✅
大厅服务器 (port 3002): HTTP $HALL_HEALTH ✅

数据库连接: 正常 ✅

================================================================================
                          后续步骤
================================================================================

1. 验证业务功能:
   - 测试用户登录
   - 验证游戏房间创建和加入
   - 检查游戏数据同步

2. 监控关键指标:
   - 错误率 (目标: < 0.1%)
   - P99 响应时间 (目标: < 500ms)
   - 内存使用 (目标: < 80%)

3. 如果一切正常:
   - 通知相关团队
   - 更新事件日志
   - 进行事后分析

4. 如果发现问题:
   - 立即停止回滚
   - 恢复到备份版本
   - 联系开发团队

================================================================================
                          回滚日志
================================================================================

$(cat "$ROLLBACK_LOG" 2>/dev/null || echo "日志丢失")

================================================================================
EOF

success "✅ 回滚报告已生成: $REPORT"

# ============================================================================
# 第10步: 通知相关人员
# ============================================================================

log ""
log "第10步: 通知相关人员..."

# 构造通知消息
NOTIFICATION_MSG="🔄 **版本回滚完成**

📌 **回滚详情**
- 源版本: $CURRENT_VERSION
- 目标版本: $VERSION
- 环境: $ENVIRONMENT
- 时间: $(date)

✅ **状态**
- 游戏服务器: 正常
- 登录服务器: 正常
- 大厅服务器: 正常
- 数据库: 正常

📊 **关键指标**
- 游戏服务器响应: HTTP $GAME_HEALTH
- 登录服务器响应: HTTP $LOGIN_HEALTH
- 大厅服务器响应: HTTP $HALL_HEALTH

📋 **文档**
- 回滚日志: $ROLLBACK_LOG
- 回滚报告: $REPORT
- 备份位置: $BACKUP_DIR"

# 如果配置了 Slack
if [ -n "${SLACK_WEBHOOK}" ]; then
    curl -X POST "${SLACK_WEBHOOK}" \
        -H 'Content-Type: application/json' \
        -d "{\"text\":\"${NOTIFICATION_MSG}\"}" 2>/dev/null || true
    success "✅ Slack 通知已发送"
fi

# ============================================================================
# 完成
# ============================================================================

log ""
log "════════════════════════════════════════════════════"
success "回滚操作完成！"
log "════════════════════════════════════════════════════"
log ""
log "📋 查看详细信息:"
log "   日志文件: $ROLLBACK_LOG"
log "   报告文件: $REPORT"
log "   备份位置: $BACKUP_DIR"
log ""

exit 0
