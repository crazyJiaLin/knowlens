# 使用 Node.js 20 作为基础镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 配置 Alpine 使用国内镜像源加速（清华大学镜像）
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apk/repositories

# 安装系统依赖（用于 yt-dlp、ffmpeg 和健康检查）
# 放在前面利用 Docker 缓存层，只需构建一次
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    wget \
    && pip3 install --break-system-packages -i https://pypi.tuna.tsinghua.edu.cn/simple yt-dlp

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

# 安装依赖：包括 devDependencies（构建时需要 @nestjs/cli）
RUN npm install \
    --registry=https://registry.npmmirror.com \
    --no-audit \
    --no-package-lock \
    --cache=/tmp/.npm

# 复制源代码
COPY . .

# 构建应用（测试环境）
RUN npm run build:test

# 暴露端口
EXPOSE 3000

# 启动应用（测试环境）
CMD ["npm", "run", "start:test"]

