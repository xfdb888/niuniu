#!/bin/bash

# dependency-manager.sh - 依赖管理脚本
# 用法: ./dependency-manager.sh [audit|update|check|upgrade]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 脚本位置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${SCRIPT_DIR}"
REPORT_DIR="${PROJECT_DIR}/logs/dependency-reports"

mkdir -p "$REPORT_DIR"

# 日志函数
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[✅]${NC} $1"
}

error() {
    echo -e "${RED}[❌]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[⚠️ ]${NC} $1"
}

# ============================================================================
# 命令 1: npm audit - 安全审计
# ============================================================================

cmd_audit() {
    log "════════════════════════════════════════════════════"
    log "npm audit - 安全漏洞扫描"
    log "════════════════════════════════════════════════════"
    log ""
    
    cd "$PROJECT_DIR"
    
    # 运行 npm audit
    AUDIT_REPORT="${REPORT_DIR}/audit-$(date +%Y%m%d-%H%M%S).json"
    npm audit --production --json > "$AUDIT_REPORT" 2>&1 || true
    
    # 解析结果
    METADATA=$(jq '.metadata' "$AUDIT_REPORT")
    VULNERABILITIES=$(jq '.metadata.vulnerabilities' "$AUDIT_REPORT")
    CRITICAL=$(echo "$VULNERABILITIES" | jq '.critical // 0')
    HIGH=$(echo "$VULNERABILITIES" | jq '.high // 0')
    MODERATE=$(echo "$VULNERABILITIES" | jq '.moderate // 0')
    LOW=$(echo "$VULNERABILITIES" | jq '.low // 0')
    
    log ""
    log "漏洞统计:"
    log "  🔴 Critical:  $CRITICAL"
    log "  🟠 High:      $HIGH"
    log "  🟡 Moderate:  $MODERATE"
    log "  🔵 Low:       $LOW"
    log ""
    
    if [ "$CRITICAL" -gt 0 ]; then
        error "发现 $CRITICAL 个严重漏洞！"
        log ""
        log "显示关键漏洞:"
        jq '.vulnerabilities | to_entries[] | select(.value.severity=="critical") | .value' "$AUDIT_REPORT" | head -20
        log ""
        return 1
    fi
    
    if [ "$HIGH" -gt 0 ]; then
        warning "发现 $HIGH 个高危漏洞"
        log ""
        log "显示高危漏洞:"
        jq '.vulnerabilities | to_entries[] | select(.value.severity=="high") | .value' "$AUDIT_REPORT" | head -20
        log ""
    fi
    
    success "扫描完成，报告已保存: $AUDIT_REPORT"
    log ""
    
    # 生成可读的报告
    READABLE_REPORT="${REPORT_DIR}/audit-$(date +%Y%m%d-%H%M%S).txt"
    {
        echo "============================================="
        echo "NPM Audit Report"
        echo "生成时间: $(date)"
        echo "============================================="
        echo ""
        echo "漏洞统计:"
        echo "  Critical: $CRITICAL"
        echo "  High: $HIGH"
        echo "  Moderate: $MODERATE"
        echo "  Low: $LOW"
        echo ""
        echo "受影响的包:"
        jq '.vulnerabilities | keys[]' "$AUDIT_REPORT" | sort | uniq
        echo ""
    } > "$READABLE_REPORT"
    
    log "详细报告: $READABLE_REPORT"
    return 0
}

# ============================================================================
# 命令 2: outdated - 检查过时的包
# ============================================================================

cmd_check() {
    log "════════════════════════════════════════════════════"
    log "检查过时的包"
    log "════════════════════════════════════════════════════"
    log ""
    
    cd "$PROJECT_DIR"
    
    # 获取过时包列表
    OUTDATED_REPORT="${REPORT_DIR}/outdated-$(date +%Y%m%d-%H%M%S).json"
    npm outdated --json > "$OUTDATED_REPORT" 2>&1 || true
    
    # 统计
    OUTDATED_COUNT=$(jq 'keys | length' "$OUTDATED_REPORT")
    
    log "过时的包数量: $OUTDATED_COUNT"
    log ""
    
    if [ "$OUTDATED_COUNT" -gt 0 ]; then
        log "过时的包列表:"
        log ""
        
        jq -r 'to_entries[] | 
            "  \(.key): \(.value.current) → \(.value.wanted) (latest: \(.value.latest))"' \
            "$OUTDATED_REPORT" | while IFS= read -r line; do
            echo "$line"
        done
        
        log ""
        log "分类:"
        
        # Patch 更新
        PATCH_COUNT=$(jq 'to_entries[] | select((.value.current | split(".")[0:2] | join(".")) == (.value.wanted | split(".")[0:2] | join("."))) | 1' "$OUTDATED_REPORT" | wc -l)
        log "  📦 Patch 更新: $PATCH_COUNT 个"
        
        # Minor 更新
        MINOR_COUNT=$(jq 'to_entries[] | select((.value.current | split(".")[0] | tonumber) == (.value.wanted | split(".")[0] | tonumber)) | 1' "$OUTDATED_REPORT" | wc -l)
        log "  📦 Minor 更新: $MINOR_COUNT 个"
        
        # Major 更新
        MAJOR_COUNT=$(jq 'to_entries[] | select((.value.current | split(".")[0] | tonumber) != (.value.wanted | split(".")[0] | tonumber)) | 1' "$OUTDATED_REPORT" | wc -l)
        log "  📦 Major 更新: $MAJOR_COUNT 个"
    else
        success "所有包都是最新版本"
    fi
    
    log ""
    success "报告已保存: $OUTDATED_REPORT"
}

# ============================================================================
# 命令 3: upgrade - 升级指定的包
# ============================================================================

cmd_upgrade() {
    local PACKAGE=$1
    local VERSION=${2:-"latest"}
    
    if [ -z "$PACKAGE" ]; then
        error "缺少参数: 包名"
        echo ""
        echo "用法: $0 upgrade <package> [version]"
        echo ""
        echo "示例:"
        echo "  $0 upgrade lodash                # 升级到最新版本"
        echo "  $0 upgrade express latest        # 升级 express 到最新"
        echo "  $0 upgrade mysql2 ^2.3.0         # 升级 mysql2 到指定版本"
        return 1
    fi
    
    log "════════════════════════════════════════════════════"
    log "升级包: $PACKAGE@$VERSION"
    log "════════════════════════════════════════════════════"
    log ""
    
    cd "$PROJECT_DIR"
    
    # 获取当前版本
    CURRENT_VERSION=$(jq -r ".dependencies.$PACKAGE // .devDependencies.$PACKAGE // \"not-found\"" package.json)
    
    if [ "$CURRENT_VERSION" = "not-found" ]; then
        error "包 $PACKAGE 未安装"
        return 1
    fi
    
    log "当前版本: $CURRENT_VERSION"
    log "目标版本: $VERSION"
    log ""
    
    # 查看包信息
    log "包信息:"
    npm view "$PACKAGE@$VERSION" --json | jq '{version, description, license, homepage}' 2>/dev/null || true
    log ""
    
    # 确认升级
    read -p "确认升级? (yes/no): " -r CONFIRM
    if [[ ! $CONFIRM =~ ^[Yy][Ee][Ss]$ ]]; then
        log "取消升级"
        return 0
    fi
    
    # 执行升级
    log ""
    log "第1步: 安装新版本..."
    npm install "$PACKAGE@$VERSION" --save
    success "安装完成"
    
    log ""
    log "第2步: 运行测试..."
    npm test 2>/dev/null || warning "测试失败，请手动验证"
    
    log ""
    log "第3步: 运行 Lint..."
    npm run lint 2>/dev/null || warning "Lint 失败"
    
    log ""
    log "第4步: 构建 Docker 镜像..."
    docker build -t niuniu-test:upgrade . --build-arg VERSION="upgrade-test" \
        || warning "Docker 构建失败，请检查 Dockerfile"
    
    success "升级完成: $PACKAGE@$VERSION"
    log ""
    log "后续步骤:"
    log "  1. git add package*.json"
    log "  2. git commit -m 'chore: upgrade $PACKAGE to $VERSION'"
    log "  3. 提交 PR 进行代码审查"
}

# ============================================================================
# 命令 4: audit fix - 自动修复
# ============================================================================

cmd_fix() {
    log "════════════════════════════════════════════════════"
    log "自动修复安全漏洞"
    log "════════════════════════════════════════════════════"
    log ""
    
    cd "$PROJECT_DIR"
    
    # 备份当前的 package-lock.json
    if [ -f "package-lock.json" ]; then
        cp package-lock.json "package-lock.json.backup.$(date +%s)"
        success "备份 package-lock.json"
    fi
    
    log ""
    log "运行 npm audit fix..."
    npm audit fix
    
    success "修复完成"
    log ""
    log "后续步骤:"
    log "  1. 运行测试: npm test"
    log "  2. git add package*.json"
    log "  3. git commit -m 'security: fix npm audit vulnerabilities'"
}

# ============================================================================
# 命令 5: engines - 验证 engines 字段
# ============================================================================

cmd_engines() {
    log "════════════════════════════════════════════════════"
    log "验证 engines 字段"
    log "════════════════════════════════════════════════════"
    log ""
    
    cd "$PROJECT_DIR"
    
    # 检查 engines 字段
    NODE_VERSION=$(jq -r '.engines.node // "not-set"' package.json)
    NPM_VERSION=$(jq -r '.engines.npm // "not-set"' package.json)
    
    log "当前配置:"
    log "  Node.js: $NODE_VERSION"
    log "  npm: $NPM_VERSION"
    log ""
    
    # 验证当前环境
    CURRENT_NODE=$(node --version | cut -d'v' -f2)
    CURRENT_NPM=$(npm --version)
    
    log "当前环境:"
    log "  Node.js: $CURRENT_NODE"
    log "  npm: $CURRENT_NPM"
    log ""
    
    # 验证兼容性
    if npm ls --engines > /dev/null 2>&1; then
        success "当前环境满足 engines 要求"
    else
        warning "当前环境可能不满足 engines 要求"
        npm ls --engines 2>&1 || true
    fi
}

# ============================================================================
# 命令 6: report - 生成完整报告
# ============================================================================

cmd_report() {
    log "════════════════════════════════════════════════════"
    log "生成依赖管理报告"
    log "════════════════════════════════════════════════════"
    log ""
    
    cd "$PROJECT_DIR"
    
    REPORT_FILE="${REPORT_DIR}/dependency-report-$(date +%Y%m%d-%H%M%S).txt"
    
    {
        echo "============================================="
        echo "依赖管理报告"
        echo "生成时间: $(date)"
        echo "============================================="
        echo ""
        
        echo "=== 1. NPM 信息 ==="
        echo "npm 版本: $(npm --version)"
        echo "Node.js 版本: $(node --version)"
        echo ""
        
        echo "=== 2. Engines 配置 ==="
        jq '.engines' package.json
        echo ""
        
        echo "=== 3. Dependencies ==="
        echo "生产依赖数量: $(jq '.dependencies | keys | length' package.json)"
        echo "开发依赖数量: $(jq '.devDependencies | keys | length' package.json)"
        echo ""
        
        echo "=== 4. 安全扫描 ==="
        npm audit --json 2>/dev/null | jq '.metadata.vulnerabilities' || echo "无法获取审计信息"
        echo ""
        
        echo "=== 5. 过时的包 ==="
        npm outdated --json 2>/dev/null | jq 'keys | length' || echo "0"
        echo ""
        
        echo "=== 6. Lock 文件信息 ==="
        echo "package-lock.json 大小: $(ls -lh package-lock.json 2>/dev/null | awk '{print $5}')"
        echo "Lock 文件版本: $(jq '.lockfileVersion' package-lock.json 2>/dev/null)"
        echo ""
        
    } > "$REPORT_FILE"
    
    success "报告已生成: $REPORT_FILE"
    cat "$REPORT_FILE"
}

# ============================================================================
# 主函数
# ============================================================================

main() {
    local CMD=${1:-help}
    
    case "$CMD" in
        audit)
            cmd_audit
            ;;
        check|outdated)
            cmd_check
            ;;
        upgrade)
            cmd_upgrade "$2" "$3"
            ;;
        fix)
            cmd_fix
            ;;
        engines)
            cmd_engines
            ;;
        report)
            cmd_report
            ;;
        help|*)
            cat << EOF

📦 依赖管理脚本

用法: $0 <command> [options]

命令:
  audit                    运行 npm audit 安全扫描
  check|outdated           检查过时的包
  upgrade <pkg> [ver]      升级指定的包
  fix                      自动修复安全漏洞
  engines                  验证 engines 字段
  report                   生成完整依赖报告
  help                     显示此帮助信息

示例:
  $0 audit                 # 运行安全审计
  $0 check                 # 检查过时的包
  $0 upgrade express       # 升级 express
  $0 fix                   # 自动修复漏洞
  $0 report                # 生成报告

EOF
            ;;
    esac
}

main "$@"
