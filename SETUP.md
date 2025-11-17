# 本地开发环境设置指南

## 环境要求

- **Node.js**: 18.x
- **npm**: 10.x
- **nvm/nvs** (Node 版本管理工具)

## 快速开始

### 1. 安装 Node 版本管理工具

#### Windows 用户 (使用 nvm-windows)
```powershell
# 如果已安装 nvm，检查版本
nvm --version

# 安装 Node 18
nvm install 18

# 切换到 Node 18
nvm use 18

# 验证
node --version  # 应该显示 v18.x.x
npm --version   # 应该显示 10.x.x
```

#### macOS/Linux 用户 (使用 nvm)
```bash
# 如果已安装 nvm，检查版本
nvm --version

# 安装 Node 18
nvm install 18

# 切换到 Node 18
nvm use 18

# 验证
node --version  # 应该显示 v18.x.x
npm --version   # 应该显示 10.x.x
```

### 2. 安装项目依赖

```bash
# 在项目根目录执行
npm run install-all

# 或者分别安装
npm install
cd niuniu_server
npm install
```

### 3. 验证环境

```bash
# 在项目根目录执行兼容性检测
node check-compatibility.js
```

应该看到：
```
========== 牛牛棋牌项目兼容性检测 ==========

1. Node 版本检查: ✓ Node 版本检查通过
2. npm 版本检查: ✓ npm 版本检查通过
3. 项目结构检查: ✓
4. 依赖安装检查: ✓ niuniu_server 依赖已安装
5. 关键依赖检查: ✓

========== 兼容性检测完成 ✓ ==========
```

### 4. 启动开发服务

```bash
# 启动游戏服务器
cd niuniu_server
npm start
# 或者
node launch.js
```

服务器启动后，会监听以下端口：
- 7001: 中心服务器
- 7002: 登录服务器
- 7003: 大厅服务器
- 7004: 游戏服务器

## 代码结构

```
niuniu/
├── .nvmrc                      # Node 版本配置文件 (nvm 自动读取)
├── package.json                # 项目根目录配置
├── check-compatibility.js      # 兼容性检测脚本
├── .github/
│   └── workflows/
│       └── ci.yml              # GitHub Actions CI 配置
├── niuniu_client/              # Cocos Creator 游戏客户端
└── niuniu_server/              # Node.js 游戏服务器
    ├── package.json            # 服务器依赖配置
    ├── launch.js               # 服务器启动文件
    ├── center_server/          # 中心服务
    ├── login_server/           # 登录服务
    ├── hall_server/            # 大厅服务
    ├── majiang_server/         # 麻将游戏服务 (牛牛)
    ├── common/                 # 公共配置和工具
    ├── utils/                  # 工具函数
    └── logs/                   # 日志目录
```

## CI/CD 流程

GitHub Actions 自动执行以下步骤：
1. ✓ 设置指定的 Node 版本 (18.x)
2. ✓ 验证 Node 和 npm 版本
3. ✓ 验证 .nvmrc 配置
4. ✓ 安装项目依赖 (npm ci)
5. ✓ 安装服务器依赖 (npm ci)
6. ✓ 运行兼容性检测 (check-compatibility.js)
7. ✓ 检查代码语法
8. ✓ 显示依赖版本

## 常见问题

### Q: nvm 不识别 18？
A: 确保已安装 Node 18。运行 `nvm list` 查看可用版本，或 `nvm install 18` 安装。

### Q: npm install 报错？
A: 尝试以下步骤：
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install --no-audit
```

### Q: 如何切换回其他 Node 版本？
A: 使用 `nvm use <version>` 切换，或在项目目录执行 `nvm use` (自动读取 .nvmrc)

### Q: CI 环境如何保证版本一致性？
A: 
- 项目配置 `.nvmrc` 文件指定 Node 18
- `package.json` 配置 `engines` 字段要求 Node 18.x 和 npm 10.x
- GitHub Actions 使用 `npm ci` 而不是 `npm install` 确保依赖版本锁定

## 版本锁定文件

- `.nvmrc`: 指定 Node 版本 (nvm 会自动读取)
- `package-lock.json`: npm 依赖版本锁定文件 (npm ci 会使用)
- `niuniu_server/package-lock.json`: 服务器依赖版本锁定

## 更新依赖

```bash
# 更新项目依赖
npm update

# 更新服务器依赖
cd niuniu_server
npm update

# 仅更新某个特定包
npm update package-name
```

## 生产环境部署

```bash
# 使用 npm ci 而不是 npm install (生产环境推荐)
npm ci
cd niuniu_server
npm ci

# 验证环境
node check-compatibility.js

# 启动服务
cd niuniu_server
npm start
```

## 参考资源

- [nvm 官方仓库](https://github.com/nvm-sh/nvm)
- [nvm-windows](https://github.com/coreybutler/nvm-windows)
- [npm ci vs npm install](https://docs.npmjs.com/cli/ci)
- [Node.js 官方下载](https://nodejs.org/)
