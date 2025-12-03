import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document as MongooseDocument } from 'mongoose';

export type DocumentDocument = Document & MongooseDocument;

@Schema({ timestamps: true })
export class Document {
  @Prop({ type: 'ObjectId', ref: 'User', required: true })
  userId: string;

  @Prop({ required: true, enum: ['video', 'pdf', 'text'] })
  sourceType: string;

  @Prop()
  title?: string;

  @Prop()
  originalUrl?: string;

  @Prop({
    required: true,
    enum: ['processing', 'completed', 'failed'],
    default: 'processing',
  })
  status: string;

  @Prop()
  errorMessage?: string;

  @Prop({
    type: {
      platform: { type: String, enum: ['youtube', 'bilibili'] },
      videoId: String,
      duration: Number,
      transcriptSource: { type: String, enum: ['native', 'asr'] },
    },
    required: false,
  })
  video?: {
    platform?: string;
    videoId?: string;
    duration?: number;
    transcriptSource?: string;
  };

  @Prop({
    type: {
      pageCount: Number,
      fileSize: Number,
    },
    required: false,
  })
  pdf?: {
    pageCount?: number;
    fileSize?: number;
  };

  @Prop({ default: 'zh' })
  language?: string;

  @Prop()
  wordCount?: number;
}

export const DocumentSchema = SchemaFactory.createForClass(Document);

// 创建索引
DocumentSchema.index({ userId: 1, createdAt: -1 });
DocumentSchema.index({ status: 1 });
