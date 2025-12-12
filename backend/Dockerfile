# 使用 Node.js 20 作为基础镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 安装系统依赖（用于 yt-dlp、ffmpeg 和健康检查）
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    wget \
    && pip3 install yt-dlp

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["npm", "start"]

