import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document as MongooseDocument } from 'mongoose';

export type InsightDocument = Insight & MongooseDocument;

@Schema({ timestamps: true })
export class Insight {
  @Prop({
    type: 'ObjectId',
    ref: 'KnowledgePoint',
    required: true,
    unique: true,
  })
  knowledgePointId: string;

  @Prop({ required: true })
  logic: string;

  @Prop()
  hiddenInfo?: string;

  @Prop()
  extensionOptional?: string;

  @Prop()
  tokensUsed?: number;

  @Prop()
  generationTimeMs?: number;
}

export const InsightSchema = SchemaFactory.createForClass(Insight);

// 创建索引：一个知识点只有一个洞察
InsightSchema.index({ knowledgePointId: 1 }, { unique: true });
