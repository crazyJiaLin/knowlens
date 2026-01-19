#!/bin/bash

# SSL 证书申请脚本（使用 Let's Encrypt）
# 使用方法：./setup-ssl.sh 主域名 邮箱 [额外域名...]

set -e

MAIN_DOMAIN=$1
EMAIL=$2

if [ -z "$MAIN_DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo "使用方法: ./setup-ssl.sh 主域名 邮箱 [额外域名...]"
    echo "示例: ./setup-ssl.sh mikestan.cn crazyjialin@foxmail.com www.mikestan.cn knowlens.mikestan.cn"
    exit 1
fi

# 构建域名参数
DOMAIN_ARGS="-d $MAIN_DOMAIN"
shift 2  # 移除前两个参数（主域名和邮箱）

# 添加额外的域名
for domain in "$@"; do
    DOMAIN_ARGS="$DOMAIN_ARGS -d $domain"
    echo "添加域名: $domain"
done

echo "================================================"
echo "为以下域名申请 Let's Encrypt SSL 证书:"
echo "$DOMAIN_ARGS"
echo "================================================"

# 1. 创建证书存储目录
echo "1. 创建证书存储目录..."
mkdir -p certbot/conf certbot/www

# 2. 启动服务（HTTP模式，用于验证域名）
echo "2. 启动服务（HTTP模式）..."
docker compose up -d

echo "等待 Nginx 启动..."
sleep 5

# 3. 使用 Certbot 申请证书
echo "3. 申请 SSL 证书..."
docker run --rm \
    -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
    -v "$(pwd)/certbot/www:/var/www/certbot" \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    $DOMAIN_ARGS

# 4. 启用 HTTPS 配置
echo "4. 更新 Nginx 配置..."
echo "⚠️  请手动编辑 frontend/nginx.conf："
echo "   1. 注释掉第 10-55 行（阶段1：HTTP配置）"
echo "   2. 取消注释第 67-134 行（阶段2：HTTPS配置）"
echo ""
read -p "已完成 nginx.conf 修改？(y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 请先修改 nginx.conf 后再继续"
    exit 1
fi

echo "5. 重新构建并启动服务..."
docker compose down
docker compose build frontend
docker compose up -d

echo "================================================"
echo "✅ SSL 证书申请成功！"
echo "================================================"
echo ""
echo "📝 后续操作："
echo "1. 访问 https://$MAIN_DOMAIN 测试"
echo "2. 证书会在 90 天后过期"
echo ""
echo "🔄 证书自动续期设置（添加到 crontab）："
echo "在服务器上执行: crontab -e"
echo "添加以下行:"
echo "0 0 1 * * cd $(pwd) && docker run --rm -v \$(pwd)/certbot/conf:/etc/letsencrypt -v \$(pwd)/certbot/www:/var/www/certbot certbot/certbot renew --quiet && docker compose restart frontend"
echo ""
echo "📁 证书文件位置："
echo "  - 证书: certbot/conf/live/$MAIN_DOMAIN/fullchain.pem"
echo "  - 私钥: certbot/conf/live/$MAIN_DOMAIN/privkey.pem"

