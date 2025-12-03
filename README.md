# Knowlens

基于 AI 的知识洞察助手，帮助用户从视频、PDF 等长文本内容中自动提炼知识点并生成深度洞察。

## 项目结构

```
knowlens/
├── frontend/          # 前端项目（React + Vite + TypeScript）
├── backend/           # 后端项目（Nest.js + TypeScript）
├── 需求文档.md        # 产品需求文档
└── 技术方案文档.md    # 技术方案文档
```

## 技术栈

### 前端
- React 18+
- TypeScript
- Vite
- Ant Design 5.x
- React Router v6
- zustand
- Axios

### 后端
- Nest.js 10+
- TypeScript
- MongoDB (Mongoose)
- Redis (BullMQ)
- JWT 认证
- Swagger API 文档

## 快速开始

### 前端开发

```bash
cd frontend
npm install
npm run dev
```

### 后端开发

```bash
cd backend
npm install
npm run start:dev
```

## 环境变量配置

请参考 `技术方案文档.md` 中的环境变量配置章节。

## 开发计划

详见 `技术方案文档.md` 中的分阶段实施计划。

## License

MIT

