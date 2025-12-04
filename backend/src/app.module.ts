import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import { getRedisConfig } from './config/redis.config';
import { UserModule } from './modules/user/user.module';
import { DocumentModule } from './modules/document/document.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { InsightModule } from './modules/insight/insight.module';
import { AuthModule } from './modules/auth/auth.module';
import { VideoModule } from './modules/video/video.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.development', '.env.production', '.env'],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const uri = configService.get<string>('mongodb.uri');
        return {
          uri,
          retryWrites: true,
          w: 'majority',
        };
      },
      inject: [ConfigService],
    }),
    // 配置 BullMQ（任务队列）
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: () => {
        const redisConfig = getRedisConfig();
        return {
          connection: redisConfig,
        };
      },
    }),
    // 注册所有模块
    UserModule,
    DocumentModule,
    KnowledgeModule,
    InsightModule,
    AuthModule,
    VideoModule,
    CommonModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
