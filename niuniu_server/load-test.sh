#!/bin/bash

# ============================================================================
# 牛牛棋牌游戏服务器 - 负载测试脚本
# ============================================================================
# 功能: 使用 wrk 和 locust 进行负载测试和性能基准测试
# ============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置参数
GAME_SERVER_URL="${1:-http://localhost:3000}"
LOGIN_SERVER_URL="${2:-http://localhost:3001}"
HALL_SERVER_URL="${3:-http://localhost:3002}"

# 测试参数
WRK_THREADS=4
WRK_CONNECTIONS=100
WRK_DURATION=30s
LOCUST_USERS=100
LOCUST_SPAWN_RATE=10
LOCUST_DURATION=60

# 日志目录
LOGS_DIR="./load-test-logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 创建日志目录
mkdir -p "$LOGS_DIR"

# ============================================================================
# 函数定义
# ============================================================================

print_header() {
    echo -e "${BLUE}"
    echo "============================================================================"
    echo "$1"
    echo "============================================================================"
    echo -e "${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

check_server_health() {
    local url=$1
    local name=$2
    
    print_header "检查 $name 健康状态"
    
    if curl -s -f "$url/health" > /dev/null 2>&1; then
        print_success "$name 正常运行 ($url)"
        return 0
    else
        print_error "$name 无法连接 ($url)"
        return 1
    fi
}

# ============================================================================
# 1. 健康检查
# ============================================================================
run_health_checks() {
    print_header "阶段 1: 服务器健康检查"
    
    local all_healthy=true
    
    check_server_health "$GAME_SERVER_URL" "游戏服务器" || all_healthy=false
    check_server_health "$LOGIN_SERVER_URL" "登录服务器" || all_healthy=false
    check_server_health "$HALL_SERVER_URL" "游戏厅服务器" || all_healthy=false
    
    if [ "$all_healthy" = true ]; then
        print_success "所有服务器健康检查通过"
        return 0
    else
        print_error "部分服务器检查失败，请先修复后再进行负载测试"
        return 1
    fi
}

# ============================================================================
# 2. 接口收敛对比 (API Consistency Check)
# ============================================================================
run_api_convergence_test() {
    print_header "阶段 2: 接口收敛对比测试"
    
    local report_file="$LOGS_DIR/api-convergence-${TIMESTAMP}.json"
    local endpoints=(
        "/health"
        "/api/version"
        "/api/status"
        "/api/ping"
    )
    
    echo "测试端点: ${endpoints[@]}"
    echo "生成报告: $report_file"
    echo ""
    
    # 创建测试报告
    local report="{
  \"timestamp\": \"$(date -Iseconds)\",
  \"test_results\": {
    \"login_server\": {},
    \"hall_server\": {},
    \"game_server\": {}
  }
}"
    
    # 测试登录服务器
    echo "测试登录服务器端点..."
    for endpoint in "${endpoints[@]}"; do
        local response=$(curl -s -w "\n%{http_code}" "$LOGIN_SERVER_URL$endpoint" 2>/dev/null || echo "000")
        local http_code=$(echo "$response" | tail -n1)
        echo "  $endpoint: HTTP $http_code"
    done
    
    # 测试游戏厅服务器
    echo "测试游戏厅服务器端点..."
    for endpoint in "${endpoints[@]}"; do
        local response=$(curl -s -w "\n%{http_code}" "$HALL_SERVER_URL$endpoint" 2>/dev/null || echo "000")
        local http_code=$(echo "$response" | tail -n1)
        echo "  $endpoint: HTTP $http_code"
    done
    
    # 测试游戏服务器
    echo "测试游戏服务器端点..."
    for endpoint in "${endpoints[@]}"; do
        local response=$(curl -s -w "\n%{http_code}" "$GAME_SERVER_URL$endpoint" 2>/dev/null || echo "000")
        local http_code=$(echo "$response" | tail -n1)
        echo "  $endpoint: HTTP $http_code"
    done
    
    echo "$report" > "$report_file"
    print_success "接口收敛对比测试完成，报告已保存到 $report_file"
}

# ============================================================================
# 3. WRK 基准测试
# ============================================================================
run_wrk_benchmark() {
    print_header "阶段 3: WRK 基准性能测试"
    
    if ! command -v wrk &> /dev/null; then
        print_warning "未安装 wrk，跳过 WRK 测试"
        print_warning "安装 wrk: brew install wrk (macOS) 或 apt-get install wrk (Linux)"
        return 1
    fi
    
    local targets=(
        "game:$GAME_SERVER_URL"
        "login:$LOGIN_SERVER_URL"
        "hall:$HALL_SERVER_URL"
    )
    
    for target in "${targets[@]}"; do
        IFS=':' read -r name url <<< "$target"
        
        echo ""
        echo "测试 $name 服务器: $url"
        local report_file="$LOGS_DIR/wrk-${name}-${TIMESTAMP}.txt"
        
        wrk -t $WRK_THREADS \
            -c $WRK_CONNECTIONS \
            -d $WRK_DURATION \
            "$url/health" \
            > "$report_file" 2>&1 || true
        
        echo "报告已保存: $report_file"
        echo ""
        tail -20 "$report_file"
    done
    
    print_success "WRK 基准测试完成"
}

# ============================================================================
# 4. Locust 负载测试（需要 Python）
# ============================================================================
run_locust_test() {
    print_header "阶段 4: Locust 分布式负载测试"
    
    if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
        print_warning "未安装 Python，跳过 Locust 测试"
        print_warning "安装 Python: 访问 https://www.python.org/downloads/"
        return 1
    fi
    
    if ! python3 -m pip show locust > /dev/null 2>&1 && ! python -m pip show locust > /dev/null 2>&1; then
        print_warning "未安装 locust，跳过 Locust 测试"
        print_warning "安装 locust: pip install locust"
        return 1
    fi
    
    # 创建 locustfile.py
    cat > ./locustfile.py << 'LOCUST_EOF'
from locust import HttpUser, task, between
import random

class GameServerUser(HttpUser):
    """游戏服务器用户行为模拟"""
    wait_time = between(1, 3)
    
    @task(1)
    def health_check(self):
        self.client.get("/health")
    
    @task(2)
    def api_status(self):
        self.client.get("/api/status")
    
    @task(1)
    def api_version(self):
        self.client.get("/api/version")

class LoginServerUser(HttpUser):
    """登录服务器用户行为模拟"""
    wait_time = between(2, 5)
    
    @task(1)
    def health_check(self):
        self.client.get("/health")
    
    @task(3)
    def login(self):
        self.client.post("/login", json={
            "username": f"user_{random.randint(1, 10000)}",
            "password": "test123"
        })

class HallServerUser(HttpUser):
    """游戏厅服务器用户行为模拟"""
    wait_time = between(1, 2)
    
    @task(1)
    def health_check(self):
        self.client.get("/health")
    
    @task(2)
    def get_rooms(self):
        self.client.get("/api/rooms")
    
    @task(1)
    def create_room(self):
        self.client.post("/api/rooms", json={
            "name": f"room_{random.randint(1, 1000)}",
            "max_players": random.choice([2, 3, 4])
        })
LOCUST_EOF
    
    print_warning "创建 locustfile.py 后，手动运行:"
    echo ""
    echo "  # 命令行模式"
    echo "  locust -f locustfile.py -H $GAME_SERVER_URL -u $LOCUST_USERS -r $LOCUST_SPAWN_RATE --run-time ${LOCUST_DURATION}s --headless"
    echo ""
    echo "  # Web UI 模式"
    echo "  locust -f locustfile.py -H $GAME_SERVER_URL --web"
    echo ""
}

# ============================================================================
# 5. 性能分析和报告生成
# ============================================================================
generate_performance_report() {
    print_header "阶段 5: 性能分析报告"
    
    local report_file="$LOGS_DIR/performance-report-${TIMESTAMP}.md"
    
    cat > "$report_file" << EOF
# 负载测试性能报告

**测试时间**: $(date)
**游戏服务器**: $GAME_SERVER_URL
**登录服务器**: $LOGIN_SERVER_URL
**游戏厅服务器**: $HALL_SERVER_URL

## 测试配置

### WRK 配置
- 线程数: $WRK_THREADS
- 连接数: $WRK_CONNECTIONS
- 持续时间: $WRK_DURATION

### Locust 配置
- 用户数: $LOCUST_USERS
- 生成速率: $LOCUST_SPAWN_RATE users/s
- 测试持续时间: ${LOCUST_DURATION}s

## 测试结果汇总

### 关键性能指标 (KPI)

| 指标 | 目标 | 状态 |
|------|------|------|
| 平均响应时间 | < 100ms | ⏳ |
| P95 响应时间 | < 200ms | ⏳ |
| P99 响应时间 | < 500ms | ⏳ |
| 吞吐量 | > 1000 req/s | ⏳ |
| 错误率 | < 0.1% | ⏳ |
| 可用性 | > 99.9% | ⏳ |

## 详细报告

### WRK 测试结果

详见各服务器的 wrk-*.txt 文件

### Locust 测试结果

详见 Locust 生成的 HTML 报告

### 接口收敛对比

详见 api-convergence-*.json 文件

## 问题分析

### 发现的问题

1. 待添加...

### 优化建议

1. 待添加...

## 下一步行动

- [ ] 分析性能瓶颈
- [ ] 实施优化措施
- [ ] 重新测试验证
- [ ] 生成最终报告

---
**生成于**: $(date -Iseconds)
**测试工具**: wrk, locust, curl
EOF
    
    print_success "性能报告已生成: $report_file"
    cat "$report_file"
}

# ============================================================================
# 6. 生成测试总结
# ============================================================================
generate_test_summary() {
    print_header "测试总结"
    
    echo ""
    echo "📊 测试日志位置: $LOGS_DIR"
    echo ""
    ls -lh "$LOGS_DIR"
    echo ""
    
    print_success "所有测试已完成"
    echo ""
    echo "关键日志文件:"
    echo "  - api-convergence-*.json          接口收敛对比报告"
    echo "  - wrk-*.txt                       WRK 性能基准报告"
    echo "  - performance-report-*.md         综合性能分析报告"
    echo ""
}

# ============================================================================
# 主程序入口
# ============================================================================
main() {
    print_header "牛牛棋牌游戏服务器 - 完整负载测试套件"
    
    echo "测试目标:"
    echo "  游戏服务器: $GAME_SERVER_URL"
    echo "  登录服务器: $LOGIN_SERVER_URL"
    echo "  游戏厅服务器: $HALL_SERVER_URL"
    echo ""
    
    # 执行测试流程
    if run_health_checks; then
        run_api_convergence_test
        run_wrk_benchmark || true
        run_locust_test || true
        generate_performance_report
        generate_test_summary
    fi
}

# 运行主程序
main
