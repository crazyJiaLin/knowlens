# 使用 Node.js 20 作为基础镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 完全清理所有 npm 配置、缓存和认证信息
RUN rm -rf ~/.npmrc /root/.npmrc ~/.npm /root/.npm /usr/local/etc/npmrc /etc/npmrc && \
    npm config delete registry || true && \
    npm config delete //registry.npmjs.org/:_authToken || true && \
    npm config delete //registry.npmmirror.com/:_authToken || true && \
    npm config delete _auth || true && \
    npm config delete _authToken || true && \
    npm cache clean --force

# 安装系统依赖（用于 yt-dlp、ffmpeg 和健康检查）
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    wget \
    && pip3 install --break-system-packages yt-dlp

# 只复制 package.json，不复制 package-lock.json（避免 lock 文件中的认证问题）
COPY package.json ./

# 安装依赖：只用 package.json，让 npm 重新解析依赖
RUN npm install \
    --registry=https://registry.npmmirror.com \
    --only=production \
    --no-audit \
    --no-package-lock \
    --cache=/tmp/.npm

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["npm", "start"]

