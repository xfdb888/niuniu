# ============================================================================
# 构建阶段 (Build Stage)
# ============================================================================
FROM node:18.20.8-alpine AS builder

WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装依赖（包含 devDependencies）
RUN npm ci --no-audit

# 复制源代码
COPY . .

# 运行 lint 检查
RUN npm run lint

# 运行单元测试
RUN npm test || true

# ============================================================================
# 生产阶段 (Production Stage)
# ============================================================================
FROM node:18.20.8-alpine

WORKDIR /app

# 安装 dumb-init 来处理信号转发
RUN apk add --no-cache dumb-init

# 创建非 root 用户
RUN addgroup -g 1000 niuniu && \
    adduser -D -u 1000 -G niuniu niuniu

# 复制 package 文件
COPY --from=builder --chown=niuniu:niuniu /app/package*.json ./

# 仅安装生产依赖
RUN npm ci --no-audit --only=production

# 复制应用代码
COPY --from=builder --chown=niuniu:niuniu /app . 

# 创建日志目录
RUN mkdir -p logs && chown -R niuniu:niuniu logs

# 设置用户
USER niuniu

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})" || exit 1

# 暴露端口
EXPOSE 3000 3001 3002

# 使用 dumb-init 启动应用
ENTRYPOINT ["/usr/sbin/dumb-init", "--"]
CMD ["node", "launch.js"]
