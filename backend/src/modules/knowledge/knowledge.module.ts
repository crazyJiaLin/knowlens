import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  KnowledgePoint,
  KnowledgePointSchema,
} from './schemas/knowledge-point.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: KnowledgePoint.name, schema: KnowledgePointSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class KnowledgeModule {}
