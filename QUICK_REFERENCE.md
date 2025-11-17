# 快速参考 - Node 版本管理和 CI 设置

## 🚀 快速开始（5 分钟）

```bash
# 1. 切换 Node 版本
nvm use

# 2. 安装依赖
npm run install-all

# 3. 验证环境
node check-compatibility.js

# 4. 启动服务
cd niuniu_server && npm start
```

---

## 📋 关键命令速查

### Node 版本管理
```bash
nvm --version           # 检查 nvm 版本
nvm list               # 列出已安装的 Node 版本
nvm install 18         # 安装 Node 18
nvm use 18             # 使用 Node 18
nvm use                # 自动读取 .nvmrc 切换
node --version         # 检查当前 Node 版本
```

### NPM 依赖管理
```bash
npm install            # 安装依赖（开发模式）
npm ci                 # 安装依赖（生产模式，使用 lock 文件）
npm update             # 更新依赖
npm list --depth=0     # 列出顶层依赖
npm audit              # 检查安全漏洞
npm audit fix          # 修复安全漏洞
```

### 项目特定命令
```bash
npm run install-all    # 安装所有项目依赖（包括子项目）
npm run ci-all         # CI 模式安装（锁定版本）
npm start              # 启动项目（见 package.json）

# 从项目根目录
node check-compatibility.js    # 兼容性检测
node test-ci.js                # CI 环境模拟测试
```

---

## 📁 关键文件一览

| 文件 | 目的 | 位置 |
|------|------|------|
| `.nvmrc` | Node 版本配置 | 项目根目录 |
| `package.json` | 项目配置和脚本 | 项目根目录 |
| `package-lock.json` | 依赖版本锁定 | 项目根目录 |
| `niuniu_server/package.json` | 服务器依赖 | 服务器目录 |
| `niuniu_server/package-lock.json` | 服务器依赖锁定 | 服务器目录 |
| `check-compatibility.js` | 兼容性检测脚本 | 项目根目录 |
| `.github/workflows/ci.yml` | CI/CD 配置 | GitHub Actions |

---

## 🔍 检测和验证

### 完整验证流程
```bash
cd niuniu
node check-compatibility.js
```

### 期望输出
```
========== 牛牛棋牌项目兼容性检测 ==========

1. Node 版本检查: ✓ Node 版本检查通过
2. npm 版本检查: ✓ npm 版本检查通过
3. 项目结构检查: ✓
4. 依赖安装检查: ✓ niuniu_server 依赖已安装
5. 关键依赖检查: ✓

========== 兼容性检测完成 ✓ ==========
```

---

## ⚙️ 版本要求

| 工具 | 版本 | 配置位置 |
|------|------|---------|
| Node.js | 18.x | `.nvmrc` 和 `package.json` |
| npm | 10.x | `package.json` engines 字段 |
| nvm | 任意 | - |

---

## 🐛 常见问题排查

### Q: 提示 "Cannot find module 'express'"
```bash
# 解决方案
cd niuniu_server
npm install
```

### Q: nvm 不识别 Node 18
```bash
# 解决方案
nvm install 18
nvm use 18
```

### Q: npm install 超时
```bash
# 解决方案
npm cache clean --force
npm install --no-audit
```

### Q: 依赖版本不一致
```bash
# 解决方案（使用 npm ci 而不是 npm install）
npm ci
cd niuniu_server && npm ci
```

---

## 📊 目前安装的关键依赖版本

```
niuniu_server@1.0.0
├── async@2.6.4           # 异步流程控制
├── express@4.21.2        # Web 框架
├── lodash@4.17.21        # 工具库
├── log4js@1.1.1          # 日志记录
├── mysql@2.18.1          # MySQL 驱动
├── nodemailer@4.7.0      # 邮件服务
├── redis@2.8.0           # Redis 客户端
├── request@2.88.2        # HTTP 请求
└── ws@3.3.3              # WebSocket
```

---

## 🔄 本地开发流程

```
1. 克隆项目
   git clone <repo>
   cd niuniu

2. 初始化环境
   nvm use
   npm run install-all
   node check-compatibility.js

3. 日常开发
   cd niuniu_server
   npm start

4. 推送更改
   git add .
   git commit -m "your changes"
   git push origin master
```

---

## 🚀 CI/CD 流程（GitHub Actions）

```
Push to GitHub
    ↓
Trigger GitHub Actions
    ↓
1. 设置 Node 18.x
2. 运行 npm ci (锁定依赖)
3. 运行兼容性检测
4. 检查代码语法
5. 生成测试报告
    ↓
✅ 通过 → 部署
❌ 失败 → 报告错误
```

---

## 📖 详细文档

- **开发指南**: 见 `SETUP.md`
- **完成总结**: 见 `COMPATIBILITY_SETUP_SUMMARY.md`
- **项目说明**: 见 `README.md`

---

## 💡 最佳实践

1. **始终使用 `nvm use`** - 确保正确的 Node 版本
2. **提交 `package-lock.json`** - 锁定依赖版本
3. **使用 `npm ci` 部署** - 而不是 `npm install`
4. **定期运行兼容性检测** - 发现环境问题
5. **监控安全更新** - 运行 `npm audit`

---

## 🆘 获得帮助

```bash
# 查看本项目的详细设置
cat SETUP.md

# 查看 Node.js 版本管理
cat .nvmrc

# 查看项目配置
cat package.json

# 查看服务器配置
cat niuniu_server/package.json
```

---

**最后更新**: 2025年11月17日  
**Node 版本**: 18.20.8  
**npm 版本**: 10.8.2  
**状态**: ✅ 生产就绪
