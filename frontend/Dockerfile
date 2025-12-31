# 构建阶段
FROM node:20-alpine AS builder

WORKDIR /app

# 完全清理所有 npm 配置、缓存和认证信息
RUN rm -rf ~/.npmrc /root/.npmrc ~/.npm /root/.npm /usr/local/etc/npmrc /etc/npmrc && \
    npm config delete registry || true && \
    npm config delete //registry.npmjs.org/:_authToken || true && \
    npm config delete //registry.npmmirror.com/:_authToken || true && \
    npm config delete _auth || true && \
    npm config delete _authToken || true && \
    npm cache clean --force

# 只复制 package.json，不复制 package-lock.json（避免 lock 文件中的认证问题）
COPY package.json ./

# 安装依赖：只用 package.json，让 npm 重新解析依赖
RUN npm install \
    --registry=https://registry.npmmirror.com \
    --no-audit \
    --legacy-peer-deps \
    --no-package-lock \
    --cache=/tmp/.npm

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 生产阶段
FROM nginx:alpine

# 复制构建产物到 Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 Nginx 配置文件
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

