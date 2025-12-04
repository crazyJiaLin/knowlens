import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { VideoController } from './video.controller';
import { BilibiliCookieController } from './bilibili-cookie.controller';
import { VideoService } from './video.service';
import { YoutubeService } from './services/youtube.service';
import { BilibiliService } from './services/bilibili.service';
import { XfyunService } from './services/xfyun.service';
import { XfyunAudioExtractorService } from './services/xfyun-audio-extractor.service';
import { BilibiliCookieService } from './services/bilibili-cookie.service';
import { VideoProcessor } from './processors/video.processor';
import { Document, DocumentSchema } from '../document/schemas/document.schema';
import { Segment, SegmentSchema } from '../document/schemas/segment.schema';
import {
  KnowledgePoint,
  KnowledgePointSchema,
} from '../knowledge/schemas/knowledge-point.schema';
import {
  BilibiliCookie,
  BilibiliCookieSchema,
} from './schemas/bilibili-cookie.schema';
import { DocumentModule } from '../document/document.module';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [
    DocumentModule,
    CommonModule,
    ConfigModule,
    MongooseModule.forFeature([
      { name: Document.name, schema: DocumentSchema },
      { name: Segment.name, schema: SegmentSchema },
      { name: KnowledgePoint.name, schema: KnowledgePointSchema },
      { name: BilibiliCookie.name, schema: BilibiliCookieSchema },
    ]),
    BullModule.registerQueue({
      name: 'video-queue',
    }),
  ],
  controllers: [VideoController, BilibiliCookieController],
  providers: [
    VideoService,
    YoutubeService,
    BilibiliService,
    XfyunAudioExtractorService,
    XfyunService,
    BilibiliCookieService,
    VideoProcessor,
  ],
  exports: [
    VideoService,
    YoutubeService,
    BilibiliService,
    XfyunService,
    BilibiliCookieService,
  ],
})
export class VideoModule {}
