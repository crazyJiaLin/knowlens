import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = new Logger('Bootstrap');

  // 数据库连接错误处理
  const connection = app.get<Connection>(getConnectionToken());
  connection.on('error', (err: Error) => {
    logger.error('MongoDB 连接错误:', err);
  });
  connection.on('disconnected', () => {
    logger.warn('MongoDB 连接断开');
  });
  connection.on('connected', () => {
    logger.log('MongoDB 连接成功');
  });

  // 使用 cookie-parser 中间件
  app.use(cookieParser());

  // 配置 CORS，允许携带 cookie
  // 支持多个 origin（用逗号分隔），如果只有一个则使用字符串，多个则使用数组
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
  const corsOrigins = corsOrigin.split(',').map((origin) => origin.trim());
  const corsOriginConfig =
    corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins;

  app.enableCors({
    origin: corsOriginConfig,
    credentials: true, // 重要：允许携带 cookie
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Range'],
    exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges'],
  });

  // 配置静态文件服务（用于访问本地上传的文件）
  // 放在 CORS 之后，确保静态文件也能跨域访问
  app.useStaticAssets(join(process.cwd(), 'uploadFile'), {
    prefix: '/uploadFile',
    // 启用 CORS 和范围请求支持（PDF 预览需要）
    setHeaders: (res: { set: (key: string, value: string) => void }) => {
      res.set('Access-Control-Allow-Origin', corsOriginConfig as string);
      res.set('Access-Control-Allow-Credentials', 'true');
      res.set('Accept-Ranges', 'bytes');
    },
  });

  // 全局前缀
  app.setGlobalPrefix('api');

  // 全局异常过滤器
  app.useGlobalFilters(new HttpExceptionFilter());

  // 全局拦截器
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 全局 JWT 认证守卫（使用 @Public() 装饰器可以跳过认证）
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new JwtAuthGuard(reflector));

  // Swagger API 文档配置
  const config = new DocumentBuilder()
    .setTitle('Knowlens API')
    .setDescription('Knowlens API 文档')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`应用运行在: http://localhost:${port}`);
  console.log(`API 文档: http://localhost:${port}/api/docs`);
}
void bootstrap();
