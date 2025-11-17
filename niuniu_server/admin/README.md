# 牛牛游戏管理后台系统 - 完整技术文档

## 目录
1. [架构概述](#架构概述)
2. [认证与授权](#认证与授权)
3. [核心功能模块](#核心功能模块)
4. [部署与配置](#部署与配置)
5. [前端开发指南](#前端开发指南)
6. [安全最佳实践](#安全最佳实践)
7. [故障排查](#故障排查)

---

## 架构概述

后台管理系统采用 **分离式微服务架构**，包含以下核心模块：

```
┌─────────────────┐
│  前端控制台     │  (React + Ant Design)
│  (Web Browser)  │
└────────┬────────┘
         │ HTTPS
┌────────▼──────────────────────┐
│   Admin API Server            │  (Node.js Express)
│   Port 7011                   │
├───────────────────────────────┤
│ • 认证与 MFA                  │
│ • 权限控制 (RBAC)             │
│ • 审计日志                    │
│ • 用户/房间/财务管理 API      │
│ • 风控规则配置                │
└────────┬──────────────────────┘
         │
    ┌────┴──────────────┬───────────────┐
    │                   │               │
┌───▼──────┐    ┌──────▼─────┐  ┌──────▼──┐
│  MySQL   │    │   Redis    │  │ Logs   │
│ 核心DB   │    │ (缓存/队列)│  │ (审计) │
└──────────┘    └────────────┘  └────────┘
```

### 部署拓扑
- **独立管理员服务**：运行在专属端口 (7011) 与游戏服务隔离
- **独立数据库表**：管理员数据、审计日志与游戏数据完全分离
- **强认证**：JWT + TOTP MFA，支持 Google Authenticator
- **审计链**：SHA256 哈希链式审计日志，防篡改

---

## 认证与授权

### JWT 令牌结构
```json
{
  "adminId": "admin_001",
  "adminName": "Super Admin",
  "roles": ["super_admin"],
  "mfaVerified": true,
  "iat": 1700000000,
  "exp": 1700028800
}
```

### 角色定义

| 角色 | 权限范围 | 适用场景 |
|------|---------|---------|
| `super_admin` | 全部权限 | 最高管理员 |
| `admin` | 用户/房间/风控 | 普通管理员 |
| `finance` | 财务/账户 | 财务人员 |
| `support` | 用户黑名单/封禁 | 客服 |
| `operator` | 发布/回滚/配置 | 运维 |

### 权限矩阵

| 权限 | SUPER_ADMIN | ADMIN | FINANCE | SUPPORT | OPERATOR |
|------|-------------|-------|---------|---------|----------|
| user:view | ✓ | ✓ | ✓ | ✓ | ✗ |
| user:ban | ✓ | ✓ | ✗ | ✓ | ✗ |
| room:kick | ✓ | ✓ | ✗ | ✗ | ✗ |
| finance:recharge | ✓ | ✗ | ✓ | ✗ | ✗ |
| ops:publish | ✓ | ✗ | ✗ | ✗ | ✓ |

### MFA (多因素认证) 流程

```
1. 管理员输入 account + password
   ↓
2. 服务器验证并返回 mfaToken (5分钟有效期)
   ↓
3. 管理员使用 Google Authenticator 获取 TOTP 码
   ↓
4. 管理员输入 TOTP 码 + mfaToken
   ↓
5. 服务器验证 TOTP，返回完整 JWT token (8小时有效期)
```

#### 初次 MFA 设置
```bash
# 1. GET /admin/setup-mfa
# 返回：secret + QR Code URI

# 2. 管理员使用 Google Authenticator 扫描 QR 码

# 3. POST /admin/confirm-mfa
# 请求体：{ secret, totpCode }
# 返回：确认成功
```

---

## 核心功能模块

### 1. 用户管理

#### 获取用户列表
```bash
GET /admin/users?page=1&pageSize=50&keyword=alice&status=0

# 响应
{
  "code": 0,
  "data": {
    "users": [
      {
        "userId": "user_123",
        "account": "alice",
        "registerTime": "2025-11-17T10:00:00Z",
        "status": 0,  // 0=active, 1=banned
        "balance": 1000.50
      }
    ],
    "page": 1,
    "pageSize": 50
  }
}
```

#### 封禁用户
```bash
POST /admin/users/{userId}/ban
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "reason": "违反游戏规则",
  "duration": 30  # 30天，0表示永久
}

# 响应
{
  "code": 0,
  "message": "User banned successfully"
}
```

#### 添加黑名单
```bash
POST /admin/users/{userId}/blacklist
{
  "reason": "疑似机器人"
}
```

### 2. 房间管理

#### 获取房间列表
```bash
GET /admin/rooms?page=1&pageSize=50&status=1

# 响应
{
  "code": 0,
  "data": {
    "rooms": [
      {
        "roomId": "room_456",
        "gameType": "wd_nn",  // 五道牛牛
        "playerCount": 4,
        "createdAt": "2025-11-17T10:30:00Z",
        "status": 1
      }
    ]
  }
}
```

#### 踢出玩家
```bash
POST /admin/rooms/{roomId}/kick
{
  "userId": "user_123",
  "reason": "异常行为"
}
```

### 3. 财务管理

#### 获取用户账户余额
```bash
GET /admin/finance/balance?userId=user_123&page=1

# 响应
{
  "code": 0,
  "data": {
    "user": {
      "userId": "user_123",
      "account": "alice",
      "balance": 5000.00
    },
    "transactions": [
      {
        "id": 1,
        "type": "RECHARGE",
        "amount": 100.00,
        "description": "充值",
        "createdAt": "2025-11-17T10:00:00Z"
      }
    ]
  }
}
```

#### 充值操作
```bash
POST /admin/finance/recharge
{
  "userId": "user_123",
  "amount": 1000.00,
  "note": "人工充值"
}
```

### 4. 风控管理

#### 获取风控规则
```bash
GET /admin/risk/rules

# 响应
{
  "code": 0,
  "data": {
    "rules": [
      {
        "id": 1,
        "ruleName": "异常胜率检测",
        "ruleType": "unusual_win_rate",
        "threshold": 0.95,
        "action": "WARN",
        "description": "连胜率超过95%"
      }
    ]
  }
}
```

#### 创建/更新风控规则
```bash
POST /admin/risk/rules
{
  "ruleName": "异常充值检测",
  "ruleType": "rapid_recharge",
  "threshold": 10000,
  "action": "BAN",
  "description": "1小时内充值超过10000"
}
```

### 5. 审计日志

#### 获取审计日志
```bash
GET /admin/audit-logs?page=1&pageSize=50&action=USER_BAN&adminId=admin_001&startTime=1700000000&endTime=1700086400

# 响应
{
  "code": 0,
  "data": {
    "logs": [
      {
        "id": 1,
        "adminId": "admin_001",
        "adminName": "Super Admin",
        "action": "USER_BAN",
        "resourceType": "user",
        "resourceId": "user_123",
        "success": true,
        "ip": "192.168.1.1",
        "timestamp": 1700000000000,
        "createdAt": "2025-11-17T10:00:00Z"
      }
    ],
    "page": 1,
    "pageSize": 50
  }
}
```

#### 验证审计日志完整性
```bash
GET /admin/audit-logs/verify?startId=1&endId=1000

# 响应 - 检查日志链哈希是否被篡改
{
  "isValid": true,
  "invalidIds": [],
  "totalRecords": 1000
}
```

---

## 部署与配置

### 1. 数据库初始化
```bash
# 在 MySQL 中执行
mysql -u root -p niuniu < admin/init.sql
```

这将创建以下表：
- `admin_users` - 管理员账户
- `admin_audit_log` - 审计日志（不可篡改）
- `user_blacklist` - 用户黑名单
- `room_operations_log` - 房间操作日志
- `risk_rules` - 风控规则配置
- `transactions` - 财务交易记录

### 2. 环境变量配置
```bash
# .env (niuniu_server/)
JWT_SECRET=your-super-secret-key-min-32-chars
ADMIN_PORT=7011
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=niuniu
MYSQL_PASSWORD=password
MYSQL_DB=niuniu
```

### 3. 启动管理服务
```bash
cd niuniu_server
node adminServer.js

# 或使用 PM2
pm2 start adminServer.js --name "admin-server"
```

### 4. 前端部署
```bash
# 创建 React 项目
npx create-react-app admin-dashboard
cd admin-dashboard
npm install antd axios react-router-dom

# 复制前端代码
cp ../admin/frontend_app.jsx src/App.jsx

# 开发
npm start

# 生产构建
npm run build
```

---

## 前端开发指南

### 项目结构
```
admin-dashboard/
├── src/
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   ├── UserManagement.jsx
│   │   ├── RoomManagement.jsx
│   │   ├── FinanceManagement.jsx
│   │   ├── RiskControl.jsx
│   │   └── AuditLog.jsx
│   ├── services/
│   │   ├── api.ts          # API 客户端
│   │   └── auth.ts         # 认证逻辑
│   ├── components/
│   │   ├── NavBar.jsx
│   │   ├── Table.jsx
│   │   └── Modal.jsx
│   ├── App.jsx
│   └── index.jsx
└── package.json
```

### API 客户端示例
```typescript
// src/services/api.ts
import axios from 'axios';
import type { AdminApiService } from '../types';

const API_BASE = 'http://localhost:7011';

export const apiClient: AdminApiService = {
  async login(request) {
    const res = await axios.post(`${API_BASE}/admin/login`, request);
    return res.data;
  },

  async getUsers(page, pageSize, keyword, status) {
    const res = await axios.get(`${API_BASE}/admin/users`, {
      params: { page, pageSize, keyword, status },
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return res.data;
  },

  async banUser(userId, request) {
    const res = await axios.post(`${API_BASE}/admin/users/${userId}/ban`, request, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return res.data;
  },

  // ... 其他方法
};

function getToken() {
  return localStorage.getItem('token') || '';
}
```

### 权限检查组件
```jsx
// src/components/PermissionGuard.jsx
import { useAuth } from '../context/AuthContext';

export function RequirePermission({ permission, children, fallback }) {
  const { hasPermission } = useAuth();
  
  return hasPermission(permission) ? children : (fallback || <div>无权限</div>);
}

// 使用
<RequirePermission permission="user:ban">
  <button onClick={() => banUser(userId)}>封禁用户</button>
</RequirePermission>
```

---

## 安全最佳实践

### 1. 密码管理
```javascript
// ❌ 不安全
db.query('INSERT INTO admin_users VALUES (?, ?, ?)', [adminId, account, password]);

// ✓ 安全
const bcrypt = require('bcryptjs');
const hashedPassword = await bcrypt.hash(password, 10);
db.query('INSERT INTO admin_users VALUES (?, ?, ?)', [adminId, account, hashedPassword]);
```

### 2. JWT 密钥
- 使用至少 32 个字符的随机密钥
- 存储在环境变量，不提交到版本控制
- 定期轮换密钥（可保留旧密钥用于验证已签发的令牌）

### 3. MFA 恢复码
- 为每个启用 MFA 的管理员生成备份码
- 存储在安全位置（密码管理器、保险箱等）
- 若丢失 MFA 设备，可用备份码登录后重新设置

### 4. 审计日志备份
```bash
# 定期备份审计日志
mysqldump -u root -p niuniu admin_audit_log > audit_backup_$(date +%Y%m%d).sql

# 验证备份完整性
mysql -u root -p niuniu < audit_backup_20251117.sql --dry-run
```

### 5. HTTPS/TLS
```nginx
# Nginx 配置示例
upstream admin_backend {
  server localhost:7011;
}

server {
  listen 443 ssl;
  server_name admin.niuniu.game;

  ssl_certificate /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;

  location / {
    proxy_pass http://admin_backend;
    proxy_set_header Authorization $http_authorization;
  }
}
```

### 6. IP 白名单
```javascript
// admin/routes.js 中间件
function ipWhitelist(req, res, next) {
  const whitelist = process.env.ADMIN_IP_WHITELIST?.split(',') || [];
  const clientIP = getClientIP(req);
  
  if (whitelist.length > 0 && !whitelist.includes(clientIP)) {
    return res.status(403).json({ code: 403, message: 'IP not whitelisted' });
  }
  next();
}

router.use(ipWhitelist);
```

### 7. 速率限制
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 分钟
  max: 100,                   // 最多 100 个请求
  message: 'Too many requests'
});

app.post('/admin/login', limiter, (req, res) => {
  // ...
});
```

---

## 故障排查

### 问题 1：无法登录 - "Invalid credentials"
**原因**：账户不存在或密码错误
**解决**：
```sql
-- 查看管理员列表
SELECT adminId, account, status FROM admin_users;

-- 重置密码（使用 bcrypt 哈希）
UPDATE admin_users SET passwordHash = 'new_hash' WHERE adminId = 'admin_001';
```

### 问题 2：MFA 验证失败
**原因**：TOTP 码过期、时钟不同步、密钥错误
**解决**：
- 确保服务器与客户端时间同步（使用 NTP）
- 在 TOTP 验证时允许 ±1 个时间窗口的容差（已在代码中实现）
- 清除本地缓存的 TOTP 密钥，重新设置

### 问题 3：权限拒绝 - "Forbidden"
**原因**：管理员没有所需权限
**解决**：
```sql
-- 检查管理员角色
SELECT adminId, roles FROM admin_users WHERE adminId = 'admin_001';

-- 升级管理员权限
UPDATE admin_users SET roles = 'admin,finance' WHERE adminId = 'admin_001';
```

### 问题 4：审计日志记录失败
**原因**：数据库连接错误、磁盘空间不足
**解决**：
```bash
# 检查 MySQL 连接
mysql -h localhost -u niuniu -p -e "SELECT 1;"

# 检查磁盘空间
df -h

# 检查表大小
SELECT table_name, ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb
FROM information_schema.TABLES
WHERE table_schema = 'niuniu'
ORDER BY size_mb DESC;
```

### 问题 5：性能缓慢
**原因**：查询未优化、缺少索引、数据库资源紧张
**解决**：
```sql
-- 添加缺失的索引
CREATE INDEX idx_audit_log_timestamp ON admin_audit_log(timestamp DESC);
CREATE INDEX idx_audit_log_admin ON admin_audit_log(adminId, createdAt DESC);

-- 定期清理历史日志
DELETE FROM admin_audit_log WHERE timestamp < DATE_SUB(NOW(), INTERVAL 90 DAY);
```

---

## 总结与下一步

✅ **已实现**：
- JWT 认证 + RBAC 权限系统
- TOTP MFA 多因素认证
- 审计日志（不可篡改）
- 核心管理 API（用户/房间/财务/风控）
- React 前端骨架
- OpenAPI 文档 + TypeScript 类型

🔄 **推荐下一步**：
1. 实现密码哈希（bcrypt）与速率限制
2. 添加完整的前端组件与集成测试
3. 部署到生产环境并配置 HTTPS
4. 实现更多风控规则（机器人检测、异常充值监控等）
5. 集成日志监控与告警（Prometheus + Grafana）
6. 建立审计日志定期备份与加密归档流程

---

**最后更新**：2025-11-17  
**维护者**：NiuNiu Admin Team
