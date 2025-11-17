# 回滚计划和依赖管理策略

**文档版本**: 1.0  
**生成日期**: 2025年11月17日  
**状态**: 🟢 Active  

---

## 📋 目录

1. [概述](#概述)
2. [回滚策略](#回滚策略)
3. [镜像管理](#镜像管理)
4. [依赖管理](#依赖管理)
5. [数据库迁移](#数据库迁移)
6. [CI/CD 安全扫描](#cicd-安全扫描)
7. [执行清单](#执行清单)

---

## 📌 概述

### 目的
确保任何版本升级或功能部署都可以**安全、快速地回滚**，同时维持系统的**可用性和数据完整性**。

### 核心原则
- ✅ **保留旧环境** - 生产环境不删除旧服务和配置
- ✅ **多版本镜像** - 保留所有生产过的镜像标记
- ✅ **向后兼容** - 新代码必须兼容旧数据结构
- ✅ **自动化回滚** - 定义明确的回滚触发条件
- ✅ **安全扫描** - 每次依赖变更都进行安全审查

---

## 🔄 回滚策略

### 1. 多环境部署模型

```
┌─────────────────────────────────────────────────────┐
│ 生产环境 (Production)                              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────┐    ┌──────────────────┐      │
│  │  当前版本 (v2)   │    │  前一版本 (v1)   │      │
│  │  ============    │    │  ============    │      │
│  │ - 容器运行       │    │ - 容器待命       │      │
│  │ - 负载均衡 100%  │    │ - 镜像已准备     │      │
│  │ - 数据库 v2      │    │ - 数据库 v1兼容  │      │
│  │                  │    │                  │      │
│  └──────────────────┘    └──────────────────┘      │
│         ↓                        ↑                  │
│    问题监控          快速回滚（< 5分钟）           │
└─────────────────────────────────────────────────────┘
```

### 2. 金丝雀部署 + 回滚机制

#### 阶段 1: 灰度部署 (10% 流量)
```
监控指标 (1 小时)
├─ 错误率: 是否 > 1%？
├─ P99 延迟: 是否 > 1000ms？
├─ CPU 使用: 是否 > 80%？
└─ 内存使用: 是否 > 85%？

结果:
├─ ✅ 全部通过 → 进入阶段 2
└─ ❌ 任何指标超标 → 自动回滚
```

#### 阶段 2: 扩展到 25% 流量
```
监控指标 (2 小时)
├─ 错误率: 是否 > 0.5%？
├─ P99 延迟: 是否 > 800ms？
├─ 业务指标: 转化率变化 > 5%？
└─ 数据库: 查询耗时增加 > 20%？

结果:
├─ ✅ 全部通过 → 进入阶段 3
└─ ❌ 任何指标超标 → 自动回滚
```

#### 阶段 3: 扩展到 50% 流量
```
监控指标 (4 小时)
├─ 错误率: 是否 > 0.3%？
├─ P99 延迟: 是否 > 500ms？
├─ 业务连续性: 是否正常？
└─ 数据一致性: 是否通过验证？

结果:
├─ ✅ 全部通过 → 进入阶段 4
└─ ❌ 任何指标超标 → 自动回滚
```

#### 阶段 4: 100% 流量切换
```
最终确认:
├─ 监控数据: 2 天内稳定
├─ 客户反馈: 0 个关键问题
├─ 业务指标: 符合预期
└─ 性能基线: 达到目标

结果:
├─ ✅ 全部确认 → 正式发布
└─ ❌ 发现问题 → 全量回滚
```

### 3. 快速回滚流程

#### 3.1 自动回滚 (< 1 分钟)

**触发条件**:
```yaml
自动回滚触发:
  错误率:
    条件: error_rate > 2% for 5 分钟
    动作: 立即停止灰度，100% 流量回到旧版本
    通知: 发送 Slack + 钉钉 + 邮件告警
  
  响应时间:
    条件: P99_latency > 2000ms for 3 分钟
    动作: 立即停止灰度，100% 流量回到旧版本
    通知: 发送告警信息
  
  内存泄漏:
    条件: 内存占用 > 90% for 1 分钟
    动作: 立即停止灰度，100% 流量回到旧版本
    通知: 发送告警信息
  
  数据库连接:
    条件: 连接池耗尽 for 1 分钟
    动作: 立即停止灰度，100% 流量回到旧版本
    通知: 发送告警信息
```

#### 3.2 手动回滚 (< 5 分钟)

**触发条件**:
```bash
# 1. 发现业务问题
# 2. 用户报告功能故障
# 3. 数据不一致
# 4. 性能严重下降

# 执行命令:
./rollback.sh --version v1.0.0 --environment production
```

**回滚步骤**:
```
第1步 (30秒): 停止新版本容器
第2步 (30秒): 更新负载均衡配置
第3步 (30秒): 启动旧版本容器
第4步 (30秒): 验证服务健康
第5步 (30秒): 确认流量切换
```

### 4. 灰度部署脚本示例

```bash
#!/bin/bash

# deploy-canary.sh - 金丝雀部署脚本

set -e

VERSION=${1:-v2.0.0}
ENVIRONMENT=${2:-production}
INITIAL_TRAFFIC=${3:-10}

echo "🚀 开始金丝雀部署: $VERSION"
echo "📊 初始流量: $INITIAL_TRAFFIC%"
echo "🌍 目标环境: $ENVIRONMENT"
echo ""

# 检查镜像是否存在
if ! docker inspect $REGISTRY/$IMAGE:$VERSION > /dev/null 2>&1; then
    echo "❌ 镜像不存在: $VERSION"
    exit 1
fi

# 保存当前版本
CURRENT_VERSION=$(cat /etc/niuniu/current-version.txt)
echo "✅ 当前版本: $CURRENT_VERSION"
echo "✅ 目标版本: $VERSION"

# 启动新版本（小规模）
echo ""
echo "第1步: 启动新版本的容器..."
docker-compose -f docker-compose.canary.yml up -d \
  --scale game-server-canary=1 \
  --scale login-server-canary=1 \
  --scale hall-server-canary=1

sleep 10

# 验证健康
echo "第2步: 验证新版本健康..."
curl -f http://game-server-canary:3000/health || {
    echo "❌ 新版本健康检查失败"
    docker-compose -f docker-compose.canary.yml down
    exit 1
}

# 配置负载均衡（分流）
echo "第3步: 配置负载均衡..."
kubectl patch service game-server -p \
  '{"spec":{"selector":{"version":"'$VERSION'"}}}' \
  --type merge

# 监控指标
echo "第4步: 开始监控 (5 分钟)..."
for i in {1..5}; do
    echo "  监控中... $i/5 分钟"
    
    # 获取关键指标
    ERROR_RATE=$(prometheus_query 'rate(http_requests_total{job="game-server-canary",status=~"5.."}[1m])')
    P99_LATENCY=$(prometheus_query 'histogram_quantile(0.99, http_request_duration_seconds{job="game-server-canary"})')
    
    echo "  - 错误率: $ERROR_RATE"
    echo "  - P99 延迟: $P99_LATENCY"
    
    # 如果错误率过高，立即回滚
    if (( $(echo "$ERROR_RATE > 0.01" | bc -l) )); then
        echo "⚠️  错误率过高，触发自动回滚！"
        ./rollback.sh --version $CURRENT_VERSION --environment $ENVIRONMENT
        exit 1
    fi
    
    sleep 60
done

# 流量逐步增加
echo "第5步: 逐步增加流量..."
for TRAFFIC in 25 50 100; do
    echo "  设置流量到: $TRAFFIC%"
    
    # 使用 Istio 或 Nginx 进行流量分割
    kubectl patch virtualservice game-server -p \
      '{"spec":{"hosts":[{"name":"game-server","http":[
          {"match":[{"uri":{"prefix":"/"}}],"route":[
              {"destination":{"host":"game-server-v'$TRAFFIC'"},"weight":0},
              {"destination":{"host":"game-server-v'$(( 100-TRAFFIC ))'"},"weight":100}
          ]}
      ]}]}}' \
      --type merge
    
    # 监控更长时间
    MONITOR_TIME=$((10 * TRAFFIC / 50))  # 5-50分钟
    for j in $(seq 1 $MONITOR_TIME); do
        echo "  监控中... $j/$MONITOR_TIME"
        
        ERROR_RATE=$(prometheus_query 'rate(http_requests_total{job="game-server",status=~"5.."}[1m])')
        if (( $(echo "$ERROR_RATE > 0.005" | bc -l) )); then
            echo "❌ 错误率过高，执行回滚"
            ./rollback.sh --version $CURRENT_VERSION --environment $ENVIRONMENT
            exit 1
        fi
        
        sleep 60
    done
done

echo ""
echo "✅ 金丝雀部署完成！"
echo "✅ 新版本 $VERSION 已全量上线"
```

---

## 🏷️ 镜像管理

### 1. 镜像标记策略

```yaml
镜像标记规范:
  生产镜像:
    - registry.internal.io/niuniu/game-server:v1.0.0
    - registry.internal.io/niuniu/game-server:v1.0.0-release
    - registry.internal.io/niuniu/game-server:stable
    - registry.internal.io/niuniu/game-server:latest-prod
  
  灰度镜像:
    - registry.internal.io/niuniu/game-server:v2.0.0-canary
    - registry.internal.io/niuniu/game-server:canary
  
  开发镜像:
    - registry.internal.io/niuniu/game-server:dev
    - registry.internal.io/niuniu/game-server:dev-2025-11-17
    - registry.internal.io/niuniu/game-server:main
```

### 2. 镜像保留策略

```bash
# 保留规则:
# - 生产环境: 所有 release 版本 + 最新 5 个版本
# - 灰度环境: 当前灰度版本 + 上一个灰度版本
# - 开发环境: 最新 3 个开发版本

# 自动清理策略:
# - 每周执行一次清理
# - 删除超过 6 个月未使用的镜像
# - 保留关键版本（v1.0.0, v2.0.0 等）

docker image prune -a --filter "until=4320h" --force
```

### 3. 镜像构建和推送

```bash
#!/bin/bash
# build-and-push.sh

VERSION=$1
BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
GIT_COMMIT=$(git rev-parse --short HEAD)

echo "构建镜像: v$VERSION"

# 构建镜像
docker build \
  --build-arg VERSION=$VERSION \
  --build-arg BUILD_DATE=$BUILD_DATE \
  --build-arg GIT_COMMIT=$GIT_COMMIT \
  -t registry.internal.io/niuniu/game-server:$VERSION \
  -t registry.internal.io/niuniu/game-server:latest-dev \
  .

# 标记为生产镜像（仅限发布版本）
if [[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    docker tag \
      registry.internal.io/niuniu/game-server:$VERSION \
      registry.internal.io/niuniu/game-server:stable
fi

# 推送镜像
docker push registry.internal.io/niuniu/game-server:$VERSION
docker push registry.internal.io/niuniu/game-server:latest-dev

if [[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    docker push registry.internal.io/niuniu/game-server:stable
fi

echo "✅ 镜像推送完成"
```

### 4. 镜像库存检查

```bash
#!/bin/bash
# check-image-inventory.sh

echo "=== 镜像库存检查 ==="
echo ""

REGISTRY="registry.internal.io"
REPO="niuniu/game-server"

# 获取所有标记
echo "📦 已发布的镜像标记:"
curl -s https://$REGISTRY/v2/$REPO/tags/list | jq '.tags[] | select(test("^v[0-9]"))' | sort -V

echo ""
echo "🔄 正在使用的镜像:"
kubectl get pods -l app=game-server -o jsonpath='{.items[*].spec.containers[*].image}' | tr ' ' '\n' | sort | uniq

echo ""
echo "🗑️  可删除的镜像（> 6 个月，未在用）:"
# 实现逻辑：查询镜像最后使用时间，对比当前时间
```

---

## 📦 依赖管理

### 1. package.json engines 字段

当前已配置:

```json
{
  "name": "niuniu_server",
  "version": "1.0.0",
  "engines": {
    "node": "18.x",
    "npm": "10.x"
  },
  ...
}
```

**验证 engines 字段**:
```bash
# 在构建阶段验证
if ! npm ls --engines > /dev/null 2>&1; then
    echo "❌ 环境不满足 engines 要求"
    exit 1
fi
```

### 2. 分阶段依赖升级计划

#### 第 1 阶段: 核心依赖 (1-2 周)

```yaml
优先级1 - 必须升级:
  express:
    当前: ^4.21.2
    目标: ^4.21.3 (patch 更新)
    原因: 安全更新
    兼容性: 100% 向后兼容
  
  ws (WebSocket):
    当前: ^8.18.0
    目标: ^8.18.1 (patch 更新)
    原因: 安全更新，性能改进
    兼容性: 100% 向后兼容
  
  redis:
    当前: ^4.7.0
    目标: ^4.7.0 (保持)
    原因: 已是稳定版本
    兼容性: 100% 兼容

升级步骤:
  1. 在开发分支升级单个依赖
  2. 运行完整测试套件 (npm test)
  3. 运行 npm audit 检查安全性
  4. Lint 检查 (npm run lint)
  5. 容器构建测试
  6. 提交 PR，进行代码审查
  7. Merge 到 main 分支
```

#### 第 2 阶段: 数据库驱动 (2-3 周)

```yaml
优先级2 - 次要升级:
  mysql:
    当前: ^2.18.1
    目标: ^2.18.1 (保持，或迁移到 mysql2)
    原因: mysql 官方不再维护，考虑迁移到 mysql2 (现代维护版本)
    迁移成本: 中等（需要修改连接代码）
    计划: 
      - 创建 migration 分支
      - 实现 mysql2 兼容层
      - 充分测试
      - 灰度切换
  
  async (异步工具库):
    当前: ^3.2.5
    目标: ^3.2.5 (保持)
    原因: 已是最新稳定版
    替代方案: Promise/async-await（逐步迁移）

升级步骤:
  1. 为 mysql2 创建功能分支
  2. 创建兼容层，支持新旧两种驱动
  3. 修改 config.js，支持驱动选择
  4. 完整回归测试（所有游戏逻辑）
  5. 本地压力测试验证
  6. 提交 PR，等待多轮审查
  7. 灰度部署（10% → 100%）
```

#### 第 3 阶段: 工具库 (3-4 周)

```yaml
优先级3 - 可选升级:
  lodash:
    当前: ^4.17.21
    目标: ^4.17.21 (保持)
    替代: 考虑使用 ES6 原生方法，逐步删除依赖
  
  nodemailer:
    当前: ^6.9.13
    目标: ^6.9.13 (保持)
    说明: 邮件非核心功能，低优先级
  
  request (已弃用):
    当前: ^2.88.2
    状态: ⚠️  官方已弃用
    替代: axios 或 node-fetch
    计划: 在 2025 年底前迁移
  
  log4js:
    当前: ^1.1.1 (☠️  极旧)
    目标: ^6.x (重大版本升级)
    风险: 高（日志系统影响全局）
    计划: 独立项目升级，充分测试

升级步骤 (request → axios):
  1. 安装 axios: npm install axios@^1.6.0
  2. 创建 migration 分支: git checkout -b migrate/request-to-axios
  3. 查找所有 request 使用: grep -r "require('request')" .
  4. 逐个替换为 axios
  5. 完整测试 (npm test)
  6. 删除 request 依赖: npm uninstall request
  7. 提交 PR
```

### 3. 依赖升级检查清单

```bash
#!/bin/bash
# upgrade-dependency.sh

PACKAGE=$1
VERSION=$2

echo "📋 依赖升级检查清单"
echo "======================"
echo ""
echo "1️⃣  查看当前版本信息"
npm view $PACKAGE@$VERSION

echo ""
echo "2️⃣  检查破坏性变更"
npm view $PACKAGE versions | grep $VERSION
npm info $PACKAGE | grep -A 10 "breaking"

echo ""
echo "3️⃣  安装新版本"
npm install $PACKAGE@$VERSION

echo ""
echo "4️⃣  运行 npm audit（安全扫描）"
npm audit

echo ""
echo "5️⃣  运行单元测试"
npm test

echo ""
echo "6️⃣  运行 Lint 检查"
npm run lint

echo ""
echo "7️⃣  构建 Docker 镜像"
docker build -t niuniu-test:local .

echo ""
echo "8️⃣  本地集成测试"
docker-compose -f docker-compose.test.yml up --abort-on-container-exit

echo ""
echo "9️⃣  清理未使用的依赖"
npm prune

echo ""
echo "✅ 升级检查完成，可以提交 PR"
```

### 4. 核心依赖清单

```yaml
核心依赖版本锁定:
  
  网络通信层:
    - express: ^4.21.2  # HTTP 框架，必须稳定
    - ws: ^8.18.0       # WebSocket，必须稳定
    - request: ^2.88.2  # HTTP 客户端（计划迁移到 axios）
  
  数据存储层:
    - mysql: ^2.18.1    # 数据库驱动（计划迁移到 mysql2）
    - redis: ^4.7.0     # 缓存驱动，已是最新
  
  异步处理:
    - async: ^3.2.5     # 异步工具库，已稳定
  
  工具库:
    - lodash: ^4.17.21  # 工具函数库，已稳定
    - nodemailer: ^6.9.13  # 邮件发送，已稳定
  
  日志系统:
    - log4js: ^1.1.1    # ⚠️  需要升级（极旧）
  
  开发工具:
    - eslint: ^9.0.0    # 代码质量
    - mocha: ^10.8.2    # 测试框架
    - chai: ^4.5.0      # 断言库
```

### 5. 安全更新流程

```bash
#!/bin/bash
# security-update.sh

echo "🔒 安全更新流程"
echo "================"
echo ""

# 1. 检查安全漏洞
echo "1️⃣  扫描漏洞..."
npm audit

echo ""
echo "2️⃣  自动修复"
npm audit fix

echo ""
echo "3️⃣  手动审查"
npm audit --json | jq '.vulnerabilities[] | select(.severity=="high" or .severity=="critical")'

echo ""
echo "4️⃣  特定包修复"
# 对于无法自动修复的包
npm update lodash --depth 3

echo ""
echo "5️⃣  测试验证"
npm test
npm run lint
docker build -t test:security .

echo ""
echo "6️⃣  提交安全更新"
git add package*.json
git commit -m "security: 修复 npm audit 发现的漏洞"
```

---

## 🗄️ 数据库迁移

### 1. 向后兼容性要求

```yaml
迁移原则:
  
  版本1 → 版本2 时:
    - ✅ 新代码必须兼容旧数据库结构
    - ✅ 允许新增字段（带默认值）
    - ✅ 允许新增表
    - ❌ 禁止删除字段（需 2+ 版本后）
    - ❌ 禁止删除表（需 2+ 版本后）
    - ❌ 禁止改变字段类型（需 2+ 版本后）
    - ❌ 禁止改变字段长度（可能截断数据）

数据库迁移时间表:
  v2.0.0 部署时:
    - 旧数据库 v1 → 临时保留（用于回滚）
    - 新数据库 v2 → 创建为主库
    - 双写模式（写入 v1 和 v2，读取 v2）
  
  v2.0.0 稳定运行 7 天后:
    - 保持双写继续
    - 数据验证（对比 v1 和 v2 的数据）
    - 性能确认（无额外开销）
  
  v2.0.0 稳定运行 14 天后:
    - 停止对 v1 的写入
    - 保留 v1 作为只读备份（用于回滚）
  
  v3.0.0 部署时:
    - 可以安全删除 v1 数据库（因为 v2 已稳定 30+ 天）
```

### 2. 数据库迁移脚本

```sql
-- migration-v1-to-v2.sql
-- 迁移时间: 2025-12-01
-- 迁移原则: 新增字段，保留兼容性

-- 1. 新增可选字段（带默认值）
ALTER TABLE `users` ADD COLUMN `vip_level` INT DEFAULT 0 COMMENT 'VIP等级';
ALTER TABLE `users` ADD COLUMN `last_login_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '最后登录时间';

-- 2. 新增可选表（用于新功能）
CREATE TABLE IF NOT EXISTS `user_achievements` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `achievement_code` VARCHAR(64) NOT NULL,
  `achieved_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_user_id` (`user_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. 新增索引（性能优化）
CREATE INDEX `idx_users_created_at` ON `users`(`created_at`);
CREATE INDEX `idx_games_updated_at` ON `games`(`updated_at`);

-- 4. 验证迁移
SELECT COUNT(*) FROM `users`;
SELECT COUNT(*) FROM `user_achievements`;
SHOW COLUMNS FROM `users` LIKE 'vip_level';
```

### 3. 双写验证

```javascript
// utils/dual-write.js
// 用于验证 v1 和 v2 数据一致性

const mysql_v1 = require('./db-v1');
const mysql_v2 = require('./db-v2');

async function validateDataConsistency() {
    const errors = [];
    
    // 检查用户表
    const users_v1 = await mysql_v1.query('SELECT * FROM users');
    const users_v2 = await mysql_v2.query('SELECT * FROM users');
    
    if (users_v1.length !== users_v2.length) {
        errors.push(`用户数量不一致: v1=${users_v1.length}, v2=${users_v2.length}`);
    }
    
    // 检查游戏表
    const games_v1 = await mysql_v1.query('SELECT * FROM games');
    const games_v2 = await mysql_v2.query('SELECT * FROM games');
    
    if (games_v1.length !== games_v2.length) {
        errors.push(`游戏数量不一致: v1=${games_v1.length}, v2=${games_v2.length}`);
    }
    
    // 详细对比
    for (let user of users_v1) {
        const user_v2 = users_v2.find(u => u.id === user.id);
        if (!user_v2) {
            errors.push(`用户不存在于 v2: ${user.id}`);
        } else {
            // 对比关键字段
            if (user.username !== user_v2.username) {
                errors.push(`用户名不一致: ${user.id}`);
            }
        }
    }
    
    return {
        success: errors.length === 0,
        errors,
        timestamp: new Date().toISOString()
    };
}

module.exports = { validateDataConsistency };
```

### 4. 回滚数据库

```bash
#!/bin/bash
# rollback-database.sh

VERSION=${1:-v1.0.0}

echo "🔄 数据库回滚: $VERSION"
echo ""

# 1. 检查备份
if [ ! -f "backups/mysql-${VERSION}.sql.gz" ]; then
    echo "❌ 备份不存在: backups/mysql-${VERSION}.sql.gz"
    exit 1
fi

echo "✅ 备份存在，可以继续回滚"
echo ""

# 2. 停止应用
echo "第1步: 停止应用..."
docker-compose stop game-server login-server hall-server
sleep 5

# 3. 创建当前备份（以防万一）
echo "第2步: 创建当前版本备份..."
mysqldump -u root -p$MYSQL_ROOT_PASSWORD niuniu > backups/mysql-backup-$(date +%s).sql

# 4. 恢复旧版本
echo "第3步: 恢复数据库到 $VERSION..."
gunzip < backups/mysql-${VERSION}.sql.gz | mysql -u root -p$MYSQL_ROOT_PASSWORD niuniu

# 5. 验证恢复
echo "第4步: 验证恢复..."
mysql -u root -p$MYSQL_ROOT_PASSWORD niuniu -e "SELECT VERSION();"

# 6. 启动应用（旧版本）
echo "第5步: 启动应用..."
docker-compose up -d

# 7. 验证健康
echo "第6步: 验证健康..."
sleep 10
curl -f http://localhost:3000/health || {
    echo "❌ 应用启动失败"
    exit 1
}

echo ""
echo "✅ 数据库回滚完成！"
```

---

## 🔐 CI/CD 安全扫描

### 1. npm audit 集成

```yaml
# .github/workflows/security-scan.yml

name: Security Scan

on:
  push:
    branches: [ main, develop ]
    paths:
      - 'package.json'
      - 'package-lock.json'
      - 'niuniu_server/**'
  pull_request:
    branches: [ main ]
  schedule:
    - cron: '0 2 * * *'  # 每天凌晨 2 点运行

jobs:
  npm-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18.x'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run npm audit
        run: |
          npm audit --production > audit-report.txt 2>&1 || true
          cat audit-report.txt
      
      - name: Upload audit report
        uses: actions/upload-artifact@v3
        with:
          name: npm-audit-report
          path: audit-report.txt
      
      - name: Check critical vulnerabilities
        run: |
          CRITICAL=$(npm audit --json | jq '.vulnerabilities | to_entries[] | select(.value.severity=="critical") | length')
          if [ "$CRITICAL" -gt 0 ]; then
              echo "❌ 发现 $CRITICAL 个严重漏洞"
              exit 1
          fi
          echo "✅ 没有严重漏洞"

  snyk-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18.x'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run Snyk
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high
      
      - name: Upload Snyk report
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: snyk.sarif
```

### 2. 本地安全扫描

```bash
#!/bin/bash
# scripts/security-check.sh

echo "🔒 本地安全扫描"
echo "==============="
echo ""

cd niuniu_server

# 1. npm audit
echo "1️⃣  npm audit 扫描..."
echo ""
npm audit --production
AUDIT_STATUS=$?

echo ""
echo "2️⃣  检查 package-lock.json 完整性..."
npm ci --audit --dry-run > /dev/null 2>&1
LOCK_STATUS=$?

if [ $AUDIT_STATUS -ne 0 ] || [ $LOCK_STATUS -ne 0 ]; then
    echo ""
    echo "⚠️  发现安全问题"
    echo ""
    echo "修复建议:"
    echo "  npm audit fix                    # 自动修复"
    echo "  npm update lodash --depth 3      # 深度更新特定包"
    exit 1
fi

echo ""
echo "✅ 安全扫描通过"
```

### 3. 依赖更新检查

```bash
#!/bin/bash
# scripts/check-updates.sh

echo "📦 依赖更新检查"
echo "=============="
echo ""

cd niuniu_server

# 列出可用更新
npm outdated

echo ""
echo "更新说明:"
echo "  npm update [package]              # 更新到符合 semver 的最新版本"
echo "  npm install [package]@latest      # 更新到最新版本（可能破坏兼容性）"
echo ""

# 生成更新建议
npm outdated --json | jq '.[] | select(.latest != .current)' | while read -r line; do
    PACKAGE=$(echo $line | jq -r '.name // empty')
    CURRENT=$(echo $line | jq -r '.current // empty')
    LATEST=$(echo $line | jq -r '.latest // empty')
    
    if [ -n "$PACKAGE" ]; then
        echo "  $PACKAGE: $CURRENT → $LATEST"
    fi
done
```

### 4. Docker 镜像扫描

```yaml
# .github/workflows/docker-scan.yml

name: Docker Image Scan

on:
  push:
    branches: [ main ]
    paths:
      - 'niuniu_server/Dockerfile'
      - 'niuniu_server/package*.json'
  pull_request:
    paths:
      - 'niuniu_server/Dockerfile'

jobs:
  build-and-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker image
        run: |
          docker build -t niuniu:scan -f niuniu_server/Dockerfile ./niuniu_server
      
      - name: Scan with Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: niuniu:scan
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL,HIGH'
      
      - name: Upload Trivy results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'
```

---

## ✅ 执行清单

### 阶段 1: 准备 (Week 1)

- [ ] 更新所有 package.json 的 engines 字段
- [ ] 创建 DEPENDENCY_MANAGEMENT.md 文档
- [ ] 设置 npm audit 自动扫描
- [ ] 配置 Snyk 账户和集成
- [ ] 创建回滚脚本 (rollback.sh, rollback-database.sh)
- [ ] 编写灰度部署脚本 (deploy-canary.sh)
- [ ] 配置 GitHub Actions 工作流

### 阶段 2: 核心依赖升级 (Week 2-3)

- [ ] 升级 express 到最新 patch 版本
- [ ] 升级 ws 到最新 patch 版本
- [ ] 升级 redis 到最新稳定版本
- [ ] 运行完整测试套件 (npm test)
- [ ] 提交 PR，进行代码审查
- [ ] 灰度部署到 10% 环境

### 阶段 3: 数据库驱动迁移 (Week 4-6)

- [ ] 评估 mysql2 迁移成本
- [ ] 创建 mysql2 兼容层
- [ ] 修改数据库连接代码
- [ ] 完整回归测试
- [ ] 本地压力测试
- [ ] 灰度部署 (10% → 50% → 100%)

### 阶段 4: 工具库更新 (Week 7+)

- [ ] 计划 request → axios 迁移
- [ ] 计划 log4js 大版本升级
- [ ] 定期运行 npm audit
- [ ] 监控已知漏洞库

### 持续维护

- [ ] 每周检查 npm audit 报告
- [ ] 每月检查 npm outdated
- [ ] 每季度评估主要版本升级
- [ ] 及时应用安全补丁

---

## 📞 支持

**关键联系方式**:
- 回滚问题: DevOps 团队
- 依赖问题: 后端团队主程
- 安全漏洞: 信息安全团队

**文档维护**:
- 作者: DevOps Team
- 最后更新: 2025年11月17日
- 下次评审: 2025年12月17日

---

**状态**: ✅ 完成  
**版本**: 1.0  
**最后编辑**: 2025年11月17日
