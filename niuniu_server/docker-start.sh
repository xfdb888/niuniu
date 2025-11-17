#!/bin/bash

# ============================================================================
# 牛牛棋牌游戏服务器 - Docker Compose 快速启动脚本
# ============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# ============================================================================
# 检查环境
# ============================================================================
check_environment() {
    print_header "检查环境"
    
    # 检查 Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker 未安装"
        echo "请访问 https://docs.docker.com/get-docker/ 安装 Docker"
        exit 1
    fi
    print_success "Docker 已安装: $(docker --version)"
    
    # 检查 Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        print_warning "docker-compose 未安装，尝试使用 docker compose"
        DOCKER_COMPOSE="docker compose"
    else
        DOCKER_COMPOSE="docker-compose"
    fi
    print_success "Docker Compose 可用: $DOCKER_COMPOSE"
}

# ============================================================================
# 创建 .env 文件
# ============================================================================
create_env_file() {
    if [ ! -f .env ]; then
        print_header "创建环境配置文件"
        
        if [ -f .env.example ]; then
            cp .env.example .env
            print_success ".env 文件已创建（基于 .env.example）"
        else
            print_warning "找不到 .env.example，使用默认配置"
            cat > .env << EOF
REDIS_PASSWORD=niuniu123
MYSQL_ROOT_PASSWORD=root123
MYSQL_USER=niuniu
MYSQL_PASSWORD=niuniu123
MYSQL_DATABASE=niuniu
NODE_ENV=production
LOG_LEVEL=info
GRAFANA_PASSWORD=admin123
EOF
        fi
    else
        print_success ".env 文件已存在"
    fi
}

# ============================================================================
# 启动容器
# ============================================================================
start_containers() {
    print_header "启动容器服务"
    
    case "${1:-all}" in
        all)
            print_warning "启动所有服务..."
            $DOCKER_COMPOSE up -d
            ;;
        redis)
            print_warning "启动 Redis..."
            $DOCKER_COMPOSE up -d redis
            ;;
        mysql)
            print_warning "启动 MySQL..."
            $DOCKER_COMPOSE up -d mysql
            ;;
        servers)
            print_warning "启动应用服务器..."
            $DOCKER_COMPOSE up -d login-server hall-server game-server
            ;;
        monitoring)
            print_warning "启动监控服务..."
            $DOCKER_COMPOSE up -d prometheus grafana
            ;;
        *)
            print_error "未知的服务: $1"
            echo "用法: ./docker-start.sh [all|redis|mysql|servers|monitoring]"
            exit 1
            ;;
    esac
    
    print_success "容器启动完成"
}

# ============================================================================
# 停止容器
# ============================================================================
stop_containers() {
    print_header "停止容器服务"
    
    case "${1:-all}" in
        all)
            print_warning "停止所有服务..."
            $DOCKER_COMPOSE down
            ;;
        redis)
            print_warning "停止 Redis..."
            $DOCKER_COMPOSE stop redis
            ;;
        mysql)
            print_warning "停止 MySQL..."
            $DOCKER_COMPOSE stop mysql
            ;;
        servers)
            print_warning "停止应用服务器..."
            $DOCKER_COMPOSE stop login-server hall-server game-server
            ;;
        monitoring)
            print_warning "停止监控服务..."
            $DOCKER_COMPOSE stop prometheus grafana
            ;;
        *)
            print_error "未知的服务: $1"
            exit 1
            ;;
    esac
    
    print_success "容器停止完成"
}

# ============================================================================
# 重启容器
# ============================================================================
restart_containers() {
    stop_containers "${1:-all}"
    sleep 2
    start_containers "${1:-all}"
}

# ============================================================================
# 查看日志
# ============================================================================
view_logs() {
    print_header "容器日志"
    
    case "${1:-all}" in
        all)
            $DOCKER_COMPOSE logs -f
            ;;
        redis)
            $DOCKER_COMPOSE logs -f redis
            ;;
        mysql)
            $DOCKER_COMPOSE logs -f mysql
            ;;
        login)
            $DOCKER_COMPOSE logs -f login-server
            ;;
        hall)
            $DOCKER_COMPOSE logs -f hall-server
            ;;
        game)
            $DOCKER_COMPOSE logs -f game-server
            ;;
        prometheus)
            $DOCKER_COMPOSE logs -f prometheus
            ;;
        grafana)
            $DOCKER_COMPOSE logs -f grafana
            ;;
        *)
            print_error "未知的服务: $1"
            exit 1
            ;;
    esac
}

# ============================================================================
# 查看容器状态
# ============================================================================
view_status() {
    print_header "容器状态"
    
    $DOCKER_COMPOSE ps
}

# ============================================================================
# 进入容器 Shell
# ============================================================================
exec_container() {
    if [ -z "$1" ]; then
        print_error "请指定容器名称"
        echo "用法: ./docker-start.sh exec <container-name> [command]"
        echo "容器列表: redis, mysql, login-server, hall-server, game-server"
        exit 1
    fi
    
    if [ -z "$2" ]; then
        # 默认进入 /bin/sh
        $DOCKER_COMPOSE exec -it "$1" /bin/sh
    else
        # 执行指定命令
        $DOCKER_COMPOSE exec "$1" "$2"
    fi
}

# ============================================================================
# 清理容器和卷
# ============================================================================
cleanup() {
    print_header "清理资源"
    
    read -p "确实要删除所有容器和卷吗? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_warning "删除所有容器和卷..."
        $DOCKER_COMPOSE down -v
        print_success "清理完成"
    else
        print_warning "操作已取消"
    fi
}

# ============================================================================
# 显示使用帮助
# ============================================================================
show_help() {
    cat << EOF
${BLUE}牛牛棋牌游戏服务器 - Docker 管理脚本${NC}

${GREEN}用法:${NC}
    ./docker-start.sh [命令] [参数]

${GREEN}命令:${NC}
    start [service]       启动容器服务
    stop [service]        停止容器服务
    restart [service]     重启容器服务
    status                查看容器状态
    logs [service]        查看容器日志
    exec <container> [cmd] 进入容器或执行命令
    cleanup               删除所有容器和卷（谨慎使用）
    help                  显示此帮助信息

${GREEN}可用的服务:${NC}
    all                   所有服务（默认）
    redis                 Redis 缓存服务
    mysql                 MySQL 数据库服务
    servers               应用服务器（登录、大厅、游戏）
    monitoring            监控服务（Prometheus、Grafana）

${GREEN}示例:${NC}
    # 启动所有服务
    ./docker-start.sh start all

    # 启动只 Redis
    ./docker-start.sh start redis

    # 查看游戏服务器日志
    ./docker-start.sh logs game-server

    # 进入 MySQL 容器
    ./docker-start.sh exec mysql

    # 在 MySQL 容器中执行命令
    ./docker-start.sh exec mysql mysql -u root -p

${GREEN}访问地址:${NC}
    游戏服务器:  http://localhost:3000
    登录服务器:  http://localhost:3001
    游戏厅服务器: http://localhost:3002
    Prometheus:  http://localhost:9090
    Grafana:    http://localhost:3003

${GREEN}数据库访问:${NC}
    Host:     localhost
    Port:     3306
    User:     niuniu
    Password: niuniu123
    Database: niuniu

EOF
}

# ============================================================================
# 主程序
# ============================================================================

# 如果没有参数，显示帮助
if [ $# -eq 0 ]; then
    show_help
    exit 0
fi

# 检查环境
check_environment

# 创建 .env 文件
create_env_file

# 处理命令
case "$1" in
    start)
        start_containers "${2:-all}"
        ;;
    stop)
        stop_containers "${2:-all}"
        ;;
    restart)
        restart_containers "${2:-all}"
        ;;
    status)
        view_status
        ;;
    logs)
        view_logs "${2:-all}"
        ;;
    exec)
        exec_container "$2" "$3"
        ;;
    cleanup)
        cleanup
        ;;
    help)
        show_help
        ;;
    *)
        print_error "未知的命令: $1"
        echo "运行 './docker-start.sh help' 查看帮助"
        exit 1
        ;;
esac
