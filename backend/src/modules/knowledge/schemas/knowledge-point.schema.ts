import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  Document as MongooseDocument,
  Schema as MongooseSchema,
} from 'mongoose';

export type KnowledgePointDocument = KnowledgePoint & MongooseDocument;

// 定义 sourceAnchor 嵌套 Schema
const SourceAnchorSchema = new MongooseSchema(
  {
    type: {
      type: String,
      enum: ['video', 'pdf', 'text'],
      required: true,
    },
    startTime: Number,
    endTime: Number,
    page: Number,
    startOffset: Number,
    endOffset: Number,
    segmentId: { type: MongooseSchema.Types.ObjectId, ref: 'Segment' },
  },
  { _id: false },
);

@Schema({ timestamps: true })
export class KnowledgePoint {
  @Prop({ type: 'ObjectId', ref: 'Document', required: true })
  documentId: string;

  @Prop({ required: true })
  topic: string;

  @Prop({ required: true })
  excerpt: string;

  @Prop({ min: 0, max: 1 })
  confidenceScore?: number;

  @Prop({ type: SourceAnchorSchema, required: true })
  sourceAnchor: {
    type: string;
    startTime?: number;
    endTime?: number;
    page?: number;
    startOffset?: number;
    endOffset?: number;
    segmentId?: string;
  };

  @Prop()
  displayOrder?: number;
}

export const KnowledgePointSchema =
  SchemaFactory.createForClass(KnowledgePoint);

// 创建索引
KnowledgePointSchema.index({ documentId: 1 });
