# 预生产验证 - 快速参考

## 🚀 5 分钟快速启动

### 1. 启动所有服务
```bash
cd niuniu_server

# 复制环境配置
cp .env.example .env

# 启动服务（Docker Compose）
docker-compose up -d

# 或使用脚本
./docker-start.sh start all
```

### 2. 验证服务健康
```bash
# 检查容器状态
docker-compose ps

# 检查健康端点
curl http://localhost:3000/health
curl http://localhost:3001/health
curl http://localhost:3002/health
```

### 3. 运行负载测试
```bash
# WRK 基准测试（需要安装 wrk）
wrk -t4 -c100 -d30s http://localhost:3000/health

# Locust Web UI（需要 Python + locust）
locust -f locustfile.py -H http://localhost:3000 --web
# 访问 http://localhost:8089
```

---

## 📊 关键指标查询

### 查看容器日志
```bash
# 所有服务
./docker-start.sh logs all

# 特定服务
./docker-start.sh logs game-server
./docker-start.sh logs mysql
./docker-start.sh logs redis
```

### 容器性能监控
```bash
# 查看实时资源使用
docker stats

# 查看容器进程
docker top <container-name>

# 进入容器调试
./docker-start.sh exec game-server /bin/sh
```

### 数据库检查
```bash
# 进入 MySQL
./docker-start.sh exec mysql mysql -u niuniu -p

# 常用命令
SHOW DATABASES;
SHOW TABLES;
SELECT COUNT(*) FROM users;
```

---

## 🔄 常用操作

### 重启服务
```bash
# 重启所有
./docker-start.sh restart all

# 重启特定服务
./docker-start.sh restart game-server
./docker-start.sh restart mysql
```

### 查看配置
```bash
# 查看环境变量
cat .env

# 查看 Docker Compose 配置
cat docker-compose.yml

# 查看 Dockerfile
cat Dockerfile
```

### 清理和重置
```bash
# 停止服务
./docker-start.sh stop all

# 删除容器和卷（谨慎！）
docker-compose down -v

# 重新启动
./docker-start.sh start all
```

---

## ⚡ 负载测试快速命令

### WRK 命令
```bash
# 基础测试
wrk -t4 -c100 -d30s http://localhost:3000/health

# 高负荷测试
wrk -t8 -c500 -d60s http://localhost:3000/health

# 生成 Lua 脚本测试
wrk -t4 -c100 -d30s -s benchmark.lua http://localhost:3000/health
```

### Locust 命令
```bash
# Web UI（推荐）
locust -f locustfile.py -H http://localhost:3000 --web

# 命令行模式
locust -f locustfile.py -H http://localhost:3000 \
  -u 100 -r 10 --run-time 60s --headless

# 生成报告
locust -f locustfile.py -H http://localhost:3000 \
  -u 100 -r 10 --run-time 60s --headless --html=report.html
```

---

## 🎯 关键指标阈值

| 指标 | 目标值 | 警告值 | 严重值 |
|------|--------|--------|---------|
| 吞吐量 (RPS) | > 1000 | < 500 | < 100 |
| 平均延迟 (ms) | < 100 | 100-200 | > 500 |
| P99 延迟 (ms) | < 200 | 200-500 | > 1000 |
| 错误率 (%) | < 0.1 | 0.1-1 | > 1 |
| CPU 使用率 (%) | < 60 | 60-80 | > 80 |
| 内存使用率 (%) | < 70 | 70-85 | > 85 |
| 连接数 | < 1000 | 1000-2000 | > 2000 |

---

## 📋 故障排查检查清单

### 服务无法启动？
```bash
# 1. 检查端口占用
netstat -tulpn | grep 3000

# 2. 查看容器日志
docker-compose logs game-server

# 3. 检查环境配置
cat .env

# 4. 验证 Dockerfile
docker build -t niuniu-server:latest .
```

### 数据库连接失败？
```bash
# 1. 检查 MySQL 状态
docker-compose ps mysql

# 2. 测试 MySQL 连接
mysql -h localhost -u niuniu -p -D niuniu

# 3. 检查网络
docker network inspect niuniu-network

# 4. 查看 MySQL 日志
./docker-start.sh logs mysql
```

### 性能测试失败？
```bash
# 1. 检查服务器资源
docker stats

# 2. 查看应用日志
./docker-start.sh logs game-server | tail -50

# 3. 检查网络连接
curl -v http://localhost:3000/health

# 4. 测试单个端点
curl http://localhost:3000/api/status
```

---

## 🌐 访问地址

| 服务 | 地址 | 用途 |
|------|------|------|
| 游戏服务器 | http://localhost:3000 | 游戏逻辑处理 |
| 登录服务器 | http://localhost:3001 | 用户认证 |
| 游戏厅服务器 | http://localhost:3002 | 房间管理 |
| Prometheus | http://localhost:9090 | 指标采集 |
| Grafana | http://localhost:3003 | 仪表盘展示 |

---

## 📈 监控面板

### Grafana 登录
- URL: http://localhost:3003
- 用户名: admin
- 密码: admin123

### Prometheus 查询
访问 http://localhost:9090 查询指标：
```
# 请求速率
rate(http_requests_total[1m])

# 错误率
rate(http_requests_total{status=~'5..'}[1m])

# 响应时间
histogram_quantile(0.95, http_request_duration_seconds)
```

---

## 📝 生成测试报告

### 自动化测试
```bash
# 运行完整负载测试套件
./load-test.sh http://localhost:3000 http://localhost:3001 http://localhost:3002

# 查看生成的报告
ls -lh load-test-logs/
```

### 手动收集指标

```bash
# 收集响应时间
for i in {1..1000}; do
  time curl -s http://localhost:3000/health > /dev/null
done

# 收集错误率
wrk -t4 -c100 -d60s http://localhost:3000/health | grep "Requests/sec"

# 收集资源使用
docker stats --no-stream
```

---

## 🔐 安全检查

### 在生产环境前检查

```bash
# 1. 检查密钥是否已更改
grep "REDIS_PASSWORD\|MYSQL_PASSWORD" .env

# 2. 检查日志级别
grep "LOG_LEVEL" .env

# 3. 验证 TLS/SSL 配置
# 生成证书（如需要）
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365

# 4. 检查网络策略
docker network inspect niuniu-network
```

---

## 📚 文件位置

| 文件 | 用途 |
|------|------|
| `Dockerfile` | 容器镜像定义 |
| `docker-compose.yml` | 多容器编排 |
| `.env.example` | 环境变量模板 |
| `.dockerignore` | Docker 构建排除文件 |
| `docker-start.sh` | Docker 管理脚本 |
| `load-test.sh` | 负载测试脚本 |
| `locustfile.py` | Locust 配置文件 |
| `k8s-deployment.yaml` | Kubernetes 部署配置 |

---

## 🆘 获取帮助

### 查看脚本帮助
```bash
# Docker 管理脚本帮助
./docker-start.sh help

# 负载测试脚本帮助
./load-test.sh help
```

### 常见问题
```bash
# Q: 如何进入容器？
./docker-start.sh exec game-server /bin/sh

# Q: 如何查看实时日志？
./docker-start.sh logs game-server

# Q: 如何重启单个服务？
./docker-start.sh restart redis

# Q: 如何完全清理？
docker-compose down -v
docker system prune -a
```

---

## ✅ 预发布检查清单

在推送到生产环境：

- [ ] 所有容器正常启动
- [ ] 健康检查端点可用
- [ ] WRK 基准测试通过
- [ ] Locust 压力测试通过
- [ ] 所有关键指标符合预期
- [ ] 接口收敛验证通过
- [ ] 监控告警配置完成
- [ ] 灰度部署计划制定
- [ ] 回滚方案已准备
- [ ] 团队培训已完成

---

**最后更新**: 2025年11月17日  
**版本**: 1.0  
**维护者**: DevOps Team
