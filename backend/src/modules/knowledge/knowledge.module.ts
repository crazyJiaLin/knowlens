import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import {
  KnowledgePoint,
  KnowledgePointSchema,
} from './schemas/knowledge-point.schema';
import { Segment, SegmentSchema } from '../document/schemas/segment.schema';
import { Document, DocumentSchema } from '../document/schemas/document.schema';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeProcessor } from './processors/knowledge.processor';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [
    CommonModule,
    MongooseModule.forFeature([
      { name: KnowledgePoint.name, schema: KnowledgePointSchema },
      { name: Segment.name, schema: SegmentSchema },
      { name: Document.name, schema: DocumentSchema },
    ]),
    BullModule.registerQueue({
      name: 'knowledge-queue',
    }),
  ],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, KnowledgeProcessor],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
