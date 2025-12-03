# 阿里云 OSS 和短信服务配置说明

## 1. 阿里云 OSS 配置

### 1.1 创建 OSS Bucket

1. 登录 [阿里云控制台](https://oss.console.aliyun.com/)
2. 进入 **对象存储 OSS** 服务
3. 点击 **创建 Bucket**
4. 配置参数：
   - **Bucket 名称**：例如 `knowlens`（需全局唯一）
   - **地域**：选择离用户最近的地域，例如 `华东1（杭州）`
   - **存储类型**：选择 `标准存储`
   - **读写权限**：选择 `私有`（推荐）或 `公共读`
   - **服务端加密**：可选，建议开启
5. 点击 **确定** 创建

### 1.2 配置 OSS CORS 规则

1. 在 Bucket 列表中，点击创建的 Bucket 名称
2. 进入 **权限管理** > **跨域设置（CORS）**
3. 点击 **创建规则**
4. 配置参数：
   - **来源（AllowedOrigins）**：
     - 开发环境：`http://localhost:5173`
     - 生产环境：`https://yourdomain.com`
     - 可配置多个，每行一个
   - **允许 Methods**：`GET, POST, PUT, DELETE, HEAD`
   - **允许 Headers**：`*`（允许所有）
   - **暴露 Headers**：`ETag, x-oss-request-id`
   - **缓存时间**：`3600`（秒）
5. 点击 **确定** 保存

### 1.3 获取 AccessKey

1. 登录 [阿里云控制台](https://home.console.aliyun.com/)
2. 鼠标悬停在右上角头像，点击 **AccessKey 管理**
3. 如果提示开启，点击 **继续使用 AccessKey**
4. 创建 AccessKey（如果还没有）：
   - 点击 **创建 AccessKey**
   - 验证身份（手机验证码或 MFA）
   - 保存 **AccessKey ID** 和 **AccessKey Secret**（只显示一次，请妥善保管）

### 1.4 配置环境变量

在 `backend/.env.development` 或 `backend/.env.production` 中添加：

```env
# 阿里云 OSS
ALIYUN_ACCESS_KEY_ID=your-access-key-id
ALIYUN_ACCESS_KEY_SECRET=your-access-key-secret
ALIYUN_OSS_REGION=oss-cn-hangzhou
ALIYUN_OSS_BUCKET=knowlens
ALIYUN_OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com

# 基础URL（用于本地文件访问）
BASE_URL=http://localhost:3000
```

**注意**：
- 如果未配置 OSS 相关环境变量，系统会自动降级到本地文件存储（`backend/uploadFile/` 目录）
- 本地存储的文件会通过后端静态文件服务提供访问

## 2. 阿里云短信服务配置

### 2.1 开通短信服务

1. 登录 [阿里云控制台](https://home.console.aliyun.com/)
2. 进入 **短信服务**（搜索 "短信服务" 或访问 https://dysms.console.aliyun.com/）
3. 如果未开通，点击 **立即开通**
4. 阅读并同意服务协议，完成开通

### 2.2 申请短信签名

1. 在短信服务控制台，进入 **国内消息** > **签名管理**
2. 点击 **添加签名**
3. 填写信息：
   - **签名名称**：例如 `Knowlens`（需与公司/应用名称相关）
   - **签名来源**：选择 `网站`、`APP` 或 `小程序` 等
   - **证明文件**：上传相关证明文件（如网站备案截图、APP截图等）
   - **备注**：填写签名用途说明
4. 提交审核（通常 1-2 个工作日）

### 2.3 申请短信模板

1. 在短信服务控制台，进入 **国内消息** > **模板管理**
2. 点击 **添加模板**
3. 填写信息：
   - **模板名称**：例如 `验证码模板`
   - **模板类型**：选择 `验证码`
   - **模板内容**：例如 `您的验证码是${code}，5分钟内有效，请勿泄露。`
   - **申请说明**：填写模板用途说明
4. 提交审核（通常 1-2 个工作日）

**模板变量说明**：
- 验证码模板必须包含 `${code}` 变量
- 变量格式：`${变量名}`

### 2.4 配置环境变量

在 `backend/.env.development` 或 `backend/.env.production` 中添加：

```env
# 阿里云短信服务
ALIYUN_SMS_ACCESS_KEY_ID=your-access-key-id
ALIYUN_SMS_ACCESS_KEY_SECRET=your-access-key-secret
ALIYUN_SMS_SIGN_NAME=Knowlens
ALIYUN_SMS_TEMPLATE_CODE=SMS_123456789
ALIYUN_SMS_REGION=cn-hangzhou
```

**注意**：
- `ALIYUN_SMS_ACCESS_KEY_ID` 和 `ALIYUN_SMS_ACCESS_KEY_SECRET` 可以使用与 OSS 相同的 AccessKey
- `ALIYUN_SMS_SIGN_NAME` 必须与在阿里云申请的签名名称完全一致
- `ALIYUN_SMS_TEMPLATE_CODE` 是审核通过后系统分配的模板代码（格式：`SMS_xxxxxx`）
- 如果未配置短信服务，开发环境会在控制台打印验证码，生产环境会返回错误

### 2.5 开发环境测试

在开发环境中，如果未配置短信服务或短信发送失败，系统会在控制台打印验证码：

```
[开发环境] 验证码: 123456 (手机号: 13800138000)
```

这样可以方便开发测试，无需真实发送短信。

## 3. 代码实现说明

### 3.1 OSS 服务

- **文件位置**：`backend/src/modules/aliyun/oss.service.ts`
- **主要功能**：
  - `uploadFile()` - 上传文件到 OSS 或本地存储
  - `deleteFile()` - 删除文件
  - `getSignedUrl()` - 生成签名 URL（用于私有文件访问）
- **降级方案**：如果 OSS 未配置或上传失败，自动降级到本地存储

### 3.2 短信服务

- **文件位置**：`backend/src/modules/aliyun/sms.service.ts`
- **主要功能**：
  - `sendVerificationCode()` - 发送验证码短信
  - `isAvailable()` - 检查短信服务是否可用
- **使用位置**：`backend/src/modules/auth/auth.service.ts` 中的 `sendCode()` 方法

## 4. 费用说明

### OSS 费用
- **存储费用**：约 ¥0.12/GB/月
- **流量费用**：约 ¥0.5/GB（外网下行流量）
- **请求费用**：PUT/POST 请求约 ¥0.01/万次，GET 请求约 ¥0.01/万次

### 短信费用
- **验证码短信**：约 ¥0.045/条
- **普通短信**：约 ¥0.04-0.05/条

**建议**：
- MVP 阶段可以先用本地存储，后续再迁移到 OSS
- 短信服务建议配置，因为验证码是核心功能

