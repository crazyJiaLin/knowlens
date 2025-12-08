import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Insight, InsightSchema } from './schemas/insight.schema';
import { InsightController } from './insight.controller';
import { InsightService } from './insight.service';
import {
  KnowledgePoint,
  KnowledgePointSchema,
} from '../knowledge/schemas/knowledge-point.schema';
import { Segment, SegmentSchema } from '../document/schemas/segment.schema';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Insight.name, schema: InsightSchema },
      { name: KnowledgePoint.name, schema: KnowledgePointSchema },
      { name: Segment.name, schema: SegmentSchema },
    ]),
    CommonModule,
  ],
  controllers: [InsightController],
  providers: [InsightService],
  exports: [InsightService],
})
export class InsightModule {}
