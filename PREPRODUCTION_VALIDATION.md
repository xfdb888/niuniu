# 预生产/灰度环境验证指南

**版本**: 1.0  
**最后更新**: 2025年11月17日  
**状态**: ✅ 完成文档

---

## 📋 目录

1. [环境准备](#环境准备)
2. [容器化部署](#容器化部署)
3. [负载测试](#负载测试)
4. [接口收敛对比](#接口收敛对比)
5. [灰度发布](#灰度发布)
6. [监控和告警](#监控和告警)
7. [故障排查](#故障排查)

---

## 🚀 环境准备

### 系统要求

| 要求 | 最小版本 | 推荐版本 |
|------|---------|---------|
| Docker | 19.03 | 24.0+ |
| Docker Compose | 1.25 | 2.0+ |
| Node.js | 18.0 | 18.20.8 |
| RAM | 4GB | 8GB+ |
| CPU | 2核 | 4核+ |
| 磁盘 | 20GB | 50GB+ |

### 安装依赖

#### Linux/macOS
```bash
# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 安装负载测试工具
sudo apt-get install wrk           # Ubuntu/Debian
brew install wrk                   # macOS

# 安装 Locust (需要 Python 3.6+)
pip install locust
```

#### Windows
```powershell
# 安装 Docker Desktop
# 访问 https://www.docker.com/products/docker-desktop

# 使用 Chocolatey 安装工具
choco install wrk
pip install locust
```

### 验证安装

```bash
# 验证 Docker
docker --version
docker run hello-world

# 验证 Docker Compose
docker-compose --version

# 验证工具
wrk --version
locust --version
```

---

## 🐳 容器化部署

### 第1步：准备项目

```bash
cd niuniu_server

# 复制环境配置
cp .env.example .env

# 根据需要编辑 .env
# 修改数据库密码、Redis 密码等
nano .env
```

### 第2步：构建镜像

```bash
# 构建 Docker 镜像（支持多架构）
docker build -t niuniu-server:latest .

# 查看构建的镜像
docker images | grep niuniu

# 验证镜像大小和内容
docker inspect niuniu-server:latest
```

### 第3步：启动服务

**方式1：使用脚本（推荐）**
```bash
# 启动所有服务
./docker-start.sh start all

# 启动特定服务
./docker-start.sh start redis          # 仅 Redis
./docker-start.sh start mysql          # 仅 MySQL
./docker-start.sh start servers        # 仅应用服务器
./docker-start.sh start monitoring     # 仅监控服务
```

**方式2：使用 Docker Compose**
```bash
# 启动所有服务（后台模式）
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 第4步：验证服务启动

```bash
# 检查容器状态
docker-compose ps

# 应该看到的输出：
# NAME                   STATUS
# niuniu-redis          Up
# niuniu-mysql          Up
# niuniu-login-server   Up
# niuniu-hall-server    Up
# niuniu-game-server    Up

# 健康检查
curl http://localhost:3000/health
curl http://localhost:3001/health
curl http://localhost:3002/health

# 检查日志
./docker-start.sh logs game-server
```

### 第5步：初始化数据库

```bash
# 进入 MySQL 容器
./docker-start.sh exec mysql

# 在容器内执行
mysql -u root -p

# 查看数据库
SHOW DATABASES;
USE niuniu;
SHOW TABLES;
```

---

## ⚡ 负载测试

### 工具选择

| 工具 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| **wrk** | 轻量级、快速、高效 | 不支持复杂场景 | 基准测试、吞吐量测试 |
| **locust** | 支持复杂场景、Python DSL、分布式 | 需要 Python 环境 | 模拟真实用户、压力测试 |
| **Apache JMeter** | 功能完整、支持 GUI | 资源消耗大、学习曲线陡 | 企业级测试 |

### 基准测试（WRK）

#### 单服务器基准测试

```bash
# 测试游戏服务器（/health 端点）
wrk -t4 -c100 -d30s http://localhost:3000/health

# 参数说明：
#   -t4        使用 4 个线程
#   -c100      打开 100 个并发连接
#   -d30s      持续 30 秒
```

**预期结果示例**：
```
Running 30s test @ http://localhost:3000/health
  4 threads and 100 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency    10.20ms   12.30ms 156.43ms   90.23%
    Req/Sec     2.54k    234.32   3.12k    75.32%
  305126 requests in 30.04s, 42.34MB read
Requests/sec:  10159.87
Transfer/sec:    1.41MB
```

**关键指标分析**：
- **Latency Avg (10.20ms)**: ✅ 优秀（< 100ms）
- **Req/Sec (2.54k)**: ✅ 优秀（> 1000/s）
- **成功率 100%**: ✅ 无错误

#### 多服务器基准测试脚本

```bash
#!/bin/bash
# load-test-benchmark.sh

SERVERS=(
  "game:http://localhost:3000"
  "login:http://localhost:3001"
  "hall:http://localhost:3002"
)

for server in "${SERVERS[@]}"; do
  IFS=':' read -r name url <<< "$server"
  echo "测试 $name 服务器..."
  
  wrk -t4 -c100 -d30s "$url/health" \
    --script=benchmark.lua \
    -H "User-Agent: WRK-Benchmark" \
    > "report-${name}.txt"
  
  echo "报告已保存: report-${name}.txt"
done
```

### 压力测试（Locust）

#### 启动 Locust Web UI

```bash
# 进入项目目录
cd niuniu_server

# 启动 Locust Web UI
locust -f locustfile.py -H http://localhost:3000 --web

# 访问 Web UI
# http://localhost:8089
```

#### Web UI 使用步骤

1. **设置并发用户数**: 输入初始用户数（例如 10）
2. **设置生成速率**: 输入每秒生成的用户数（例如 1）
3. **点击 "Start swarming"**: 开始测试
4. **监控实时数据**: 观看响应时间、错误率、吞吐量

#### 命令行模式（无 UI）

```bash
# 基础测试：100 个用户，10 users/s，运行 60 秒
locust -f locustfile.py \
  -H http://localhost:3000 \
  -u 100 \
  -r 10 \
  --run-time 60s \
  --headless \
  --csv=results

# 高压力测试：1000 个用户，50 users/s
locust -f locustfile.py \
  -H http://localhost:3000 \
  -u 1000 \
  -r 50 \
  --run-time 300s \
  --headless \
  --html=report.html

# 分布式测试（多台机器）
# Master 节点
locust -f locustfile.py -H http://localhost:3000 --master

# Worker 节点（不同机器）
locust -f locustfile.py -H http://localhost:3000 --worker --master-host=<master-ip>
```

#### 测试场景定义

已提供的用户类：

1. **GameServerUser**: 模拟游戏玩家
   - 健康检查 (10%)
   - 查询游戏状态 (20%)
   - 获取版本信息 (10%)
   - Ping 测试 (20%)

2. **LoginServerUser**: 模拟登录流程
   - 健康检查 (10%)
   - 用户注册 (20%)
   - 用户登录 (30%)
   - 获取用户信息 (10%)

3. **HallServerUser**: 模拟游戏厅行为
   - 健康检查 (10%)
   - 获取房间列表 (30%)
   - 创建房间 (20%)
   - 加入房间 (20%)
   - 查询排行榜 (10%)

#### 分析 Locust 结果

**关键指标**：

| 指标 | 含义 | 目标值 | 警告值 |
|------|------|--------|---------|
| Type | 请求类型 | - | - |
| Name | 端点路径 | - | - |
| # requests | 总请求数 | 越多越好 | < 100 |
| # fails | 失败次数 | 0 | > 1% |
| Median | 中位数 (ms) | < 100 | > 200 |
| Average | 平均值 (ms) | < 100 | > 200 |
| Min | 最小值 (ms) | - | - |
| Max | 最大值 (ms) | < 1000 | > 5000 |
| Avg size | 平均响应大小 | - | - |
| RPS | 吞吐量 (req/s) | > 1000 | < 500 |

**问题诊断**：

```
问题: P99 响应时间过高 (> 1000ms)
可能原因:
  1. 数据库查询慢
  2. 缓存未命中
  3. 网络延迟
  4. 服务器过载

解决方案:
  1. 检查数据库索引
  2. 优化慢查询
  3. 预热缓存
  4. 增加服务器资源
```

---

## 🔄 接口收敛对比

### 目标

确保所有服务器实现相同的接口契约，避免不一致导致的集成问题。

### 方法 1: 自动化脚本

```bash
# 运行接口收敛对比测试
./load-test.sh http://localhost:3000 http://localhost:3001 http://localhost:3002

# 生成对比报告
# 位置: ./load-test-logs/api-convergence-*.json
```

### 方法 2: 手动对比

```bash
# 收集所有端点的响应

# 游戏服务器
curl -s http://localhost:3000/health | jq .
curl -s http://localhost:3000/api/status | jq .
curl -s http://localhost:3000/api/version | jq .

# 登录服务器
curl -s http://localhost:3001/health | jq .
curl -s http://localhost:3001/api/status | jq .
curl -s http://localhost:3001/api/version | jq .

# 游戏厅服务器
curl -s http://localhost:3002/health | jq .
curl -s http://localhost:3002/api/status | jq .
curl -s http://localhost:3002/api/version | jq .

# 比对响应结构和数据
```

### 方法 3: 使用 API 测试工具

**Postman/Insomnia 集合**:
```json
{
  "info": {
    "name": "牛牛游戏服务器 - API 收敛测试",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "游戏服务器",
      "item": [
        {
          "name": "健康检查",
          "request": {
            "method": "GET",
            "url": "{{game_url}}/health"
          }
        }
      ]
    },
    {
      "name": "登录服务器",
      "item": [
        {
          "name": "健康检查",
          "request": {
            "method": "GET",
            "url": "{{login_url}}/health"
          }
        }
      ]
    }
  ]
}
```

### 对比清单

```markdown
## 接口收敛对比清单

### /health 端点
- [ ] 游戏服务器返回 200 OK
- [ ] 登录服务器返回 200 OK
- [ ] 游戏厅服务器返回 200 OK
- [ ] 响应体结构相同
- [ ] 包含相同的字段

### /api/status 端点
- [ ] 所有服务器实现此端点
- [ ] 返回相同的状态结构
- [ ] 字段类型一致
- [ ] 错误处理方式一致

### /api/version 端点
- [ ] 返回版本号
- [ ] 格式一致 (semantic versioning)
- [ ] 包含构建时间戳

### 错误处理
- [ ] 404 错误响应格式相同
- [ ] 500 错误响应格式相同
- [ ] 错误码定义一致
- [ ] 错误消息格式一致

### 认证和授权
- [ ] 认证方式相同 (token/session)
- [ ] 授权响应一致
- [ ] 过期处理一致

### 速率限制
- [ ] 所有服务器实现相同的速率限制
- [ ] 返回相同的限制头
- [ ] 超限响应一致
```

---

## 🎯 灰度发布

### 灰度策略

#### 1. 金丝雀部署 (Canary Deployment)

```
Phase 1: 10% 流量  -> 监控 1 小时
Phase 2: 25% 流量  -> 监控 2 小时
Phase 3: 50% 流量  -> 监控 2 小时
Phase 4: 100% 流量 -> 完成灰度
```

#### 2. 蓝绿部署 (Blue-Green Deployment)

```
Blue:  旧版本 (当前生产)
Green: 新版本 (预发布)

切换策略:
1. 部署新版本到 Green
2. 运行完整测试套件
3. 切换负载均衡器流量
4. 保留 Blue 作为回滚点
```

### 灰度发布脚本

```bash
#!/bin/bash
# canary-deploy.sh

set -e

VERSION=${1:-latest}
CANARY_PERCENTAGE=${2:-10}
MONITORING_DURATION=${3:-3600}  # 秒

echo "启动灰度部署 (版本: $VERSION, 流量: $CANARY_PERCENTAGE%)"

# 1. 部署新版本到专用环境
docker-compose -f docker-compose.canary.yml up -d

# 2. 配置负载均衡器（canary 权重）
configure_canary_weights $CANARY_PERCENTAGE

# 3. 启动监控
start_monitoring $MONITORING_DURATION

# 4. 收集指标
collect_metrics

# 5. 对比指标（旧 vs 新）
compare_metrics

# 6. 根据结果决策
if check_health_metrics; then
    echo "健康指标通过，继续灰度部署"
    increase_canary_traffic_gradually
else
    echo "检测到问题，回滚到旧版本"
    rollback_deployment
fi
```

### 灰度监控指标

```bash
# 关键指标（需要监控）
METRICS=(
  "error_rate"         # 错误率 (< 0.1%)
  "latency_p99"        # P99 延迟 (< 500ms)
  "cpu_usage"          # CPU 使用率 (< 80%)
  "memory_usage"       # 内存使用率 (< 80%)
  "connections_count"  # 连接数
  "request_rate"       # 请求速率
)

# 告警阈值
ALERT_THRESHOLDS=(
  "error_rate:0.001"
  "latency_p99:500"
  "cpu_usage:0.8"
  "memory_usage:0.8"
)
```

---

## 📊 监控和告警

### 启动监控栈

```bash
# 启动 Prometheus + Grafana
./docker-start.sh start monitoring

# Prometheus: http://localhost:9090
# Grafana:    http://localhost:3003
```

### Prometheus 配置

文件: `monitoring/prometheus.yml`

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'login-server'
    static_configs:
      - targets: ['localhost:3001']
  
  - job_name: 'hall-server'
    static_configs:
      - targets: ['localhost:3002']
  
  - job_name: 'game-server'
    static_configs:
      - targets: ['localhost:3000']
```

### Grafana 仪表盘

#### 1. 创建 Prometheus 数据源

- Name: Prometheus
- URL: http://prometheus:9090
- Access: Server

#### 2. 导入仪表盘

```json
{
  "dashboard": {
    "title": "牛牛游戏服务器监控",
    "panels": [
      {
        "title": "请求吞吐量 (Req/s)",
        "targets": [
          {
            "expr": "rate(http_requests_total[1m])"
          }
        ]
      },
      {
        "title": "平均响应时间 (ms)",
        "targets": [
          {
            "expr": "histogram_quantile(0.5, http_request_duration_seconds)"
          }
        ]
      },
      {
        "title": "错误率 (%)",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~'5..'}[1m]) / rate(http_requests_total[1m]) * 100"
          }
        ]
      }
    ]
  }
}
```

### 告警规则

文件: `monitoring/alert-rules.yml`

```yaml
groups:
  - name: niuniu_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~'5..'}[5m]) > 0.01
        for: 5m
        annotations:
          summary: "错误率过高 (> 1%)"
      
      - alert: HighLatency
        expr: histogram_quantile(0.99, http_request_duration_seconds) > 1
        for: 5m
        annotations:
          summary: "P99 延迟过高 (> 1s)"
      
      - alert: HighCPUUsage
        expr: node_cpu_seconds_total > 0.8
        for: 10m
        annotations:
          summary: "CPU 使用率过高 (> 80%)"
```

---

## 🔍 故障排查

### 常见问题

#### 1. 容器启动失败

```bash
# 查看容器日志
docker-compose logs -f game-server

# 常见原因：
# - 端口已被占用
# - 依赖服务未启动
# - 环境变量配置错误

# 解决方案：
# 1. 检查端口
netstat -tulpn | grep 3000

# 2. 查看容器状态
docker-compose ps

# 3. 检查网络
docker network ls
docker network inspect niuniu-network
```

#### 2. 数据库连接失败

```bash
# 检查 MySQL 状态
docker-compose logs mysql

# 测试连接
mysql -h localhost -u niuniu -p -D niuniu

# 初始化数据库
docker-compose exec mysql mysql -u root -p < backup/niuniu.sql
```

#### 3. Redis 连接失败

```bash
# 测试 Redis
redis-cli -h localhost -p 6379 -a niuniu123 ping

# 查看 Redis 信息
redis-cli -h localhost -p 6379 -a niuniu123 INFO
```

#### 4. 高延迟问题

```bash
# 1. 检查网络
ping localhost
iperf3 -s  # 服务器
iperf3 -c localhost  # 客户端

# 2. 检查磁盘 I/O
iostat -x 1

# 3. 检查系统负载
top
htop

# 4. 检查应用日志
./docker-start.sh logs game-server
```

#### 5. 内存泄漏

```bash
# 监控内存使用
watch -n 1 'docker stats --no-stream'

# 获取堆快照 (Node.js)
docker-compose exec game-server kill -USR2 1

# 分析内存
node --inspect=0.0.0.0:9229 launch.js
# 然后用 Chrome DevTools 分析
```

### 调试模式

```bash
# 启用详细日志
export LOG_LEVEL=debug

# 重启服务
docker-compose restart

# 查看调试日志
./docker-start.sh logs game-server | grep -E "DEBUG|ERROR"
```

### 性能分析

```bash
# 使用 Node.js 内置性能工具
node --prof launch.js
node --prof-process isolate-*.log > profile.txt

# 使用 clinic.js（推荐）
npm install -g clinic
clinic doctor -- node launch.js
clinic bubbleprof -- node launch.js
```

---

## 📈 测试报告模板

### 性能测试报告

```markdown
# 性能测试报告

## 测试信息
- 测试时间: YYYY-MM-DD HH:MM:SS
- 测试环境: 预生产/灰度
- 版本: v1.0.0
- 测试工具: wrk, locust

## 测试结果

### WRK 基准测试

**游戏服务器 (3000)**
- 吞吐量: 10,000+ req/s
- 平均延迟: 10ms
- P99 延迟: 50ms
- 错误率: 0%

**登录服务器 (3001)**
- 吞吐量: 8,000+ req/s
- 平均延迟: 12ms
- P99 延迟: 60ms
- 错误率: 0%

**游戏厅服务器 (3002)**
- 吞吐量: 9,000+ req/s
- 平均延迟: 11ms
- P99 延迟: 55ms
- 错误率: 0%

### Locust 压力测试

- 并发用户: 100-1000
- 用户生成速率: 10-50 users/s
- 测试持续时间: 60-300 秒

**结果汇总**:

| 场景 | 用户数 | 吞吐量 | 平均延迟 | P99延迟 | 错误率 | 结果 |
|------|--------|--------|---------|---------|--------|------|
| 基础 | 100 | 1000+ | 10ms | 50ms | <0.1% | ✅ |
| 中等 | 500 | 800+ | 15ms | 100ms | <0.1% | ✅ |
| 高负荷 | 1000 | 600+ | 30ms | 200ms | <0.1% | ✅ |

## 接口收敛验证

- ✅ /health 端点一致
- ✅ /api/status 端点一致
- ✅ /api/version 端点一致
- ✅ 错误处理一致
- ✅ 认证机制一致

## 结论

✅ **通过验证** - 版本已准备好灰度发布

### 建议

1. 从 10% 流量开始灰度
2. 监控关键指标不低于 4 小时
3. 每 1 小时增加 15-25% 流量
4. 保留回滚方案
```

---

## 📚 参考资源

### 官方文档
- [Docker 官方文档](https://docs.docker.com/)
- [Docker Compose 官方文档](https://docs.docker.com/compose/)
- [Locust 官方文档](https://docs.locust.io/)
- [Prometheus 官方文档](https://prometheus.io/docs/)
- [Grafana 官方文档](https://grafana.com/docs/)

### 最佳实践
- [12 Factor App](https://12factor.net/)
- [Google SRE 手册](https://sre.google/books/)
- [The Phoenix Project](https://itrevolution.com/the-phoenix-project/)

### 工具和库
- [wrk - HTTP 基准测试工具](https://github.com/wg/wrk)
- [locust - 分布式负载测试](https://locust.io/)
- [clinic.js - Node.js 性能分析](https://clinicjs.org/)

---

## ✅ 完成清单

在发布到生产环境前，请确保：

### 容器化验证
- [ ] Dockerfile 构建成功
- [ ] 所有服务容器启动成功
- [ ] 健康检查通过
- [ ] 依赖服务（Redis、MySQL）正常运行

### 负载测试
- [ ] WRK 基准测试完成
- [ ] Locust 压力测试完成
- [ ] 关键指标符合预期
- [ ] 生成测试报告

### 接口收敛验证
- [ ] 所有服务实现相同接口
- [ ] 响应格式一致
- [ ] 错误处理方式一致
- [ ] 认证机制一致

### 灰度准备
- [ ] 灰度部署策略确定
- [ ] 监控告警规则配置
- [ ] 回滚方案制定
- [ ] 团队培训完成

### 生产就绪
- [ ] 容器镜像已推送到镜像仓库
- [ ] 部署文档完成
- [ ] 运维手册完成
- [ ] 故障排查指南完成

---

**生成于**: 2025年11月17日  
**版本**: 1.0  
**状态**: ✅ 文档完成
