import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document as MongooseDocument } from 'mongoose';

export type SegmentDocument = Segment & MongooseDocument;

@Schema({ timestamps: true })
export class Segment {
  @Prop({ type: 'ObjectId', ref: 'Document', required: true })
  documentId: string;

  @Prop({ required: true })
  segmentIndex: number;

  @Prop({ required: true })
  text: string;

  // 视频时间戳（仅视频类型使用）
  @Prop()
  startTime?: number;

  @Prop()
  endTime?: number;

  // PDF位置（仅PDF类型使用）
  @Prop()
  pageNumber?: number;

  @Prop()
  startOffset?: number;

  @Prop()
  endOffset?: number;

  // 文本位置（仅纯文本类型使用）
  @Prop()
  charStart?: number;

  @Prop()
  charEnd?: number;
}

export const SegmentSchema = SchemaFactory.createForClass(Segment);

// 复合索引：按文档ID和片段顺序查询
SegmentSchema.index({ documentId: 1, segmentIndex: 1 });
