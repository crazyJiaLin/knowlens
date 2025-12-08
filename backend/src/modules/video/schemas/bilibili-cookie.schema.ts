import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document as MongooseDocument } from 'mongoose';

export type BilibiliCookieDocument = BilibiliCookie & MongooseDocument;

export enum BilibiliCookieStatus {
  ENABLED = 'enabled', // 启用
  DISABLED = 'disabled', // 禁用
  EXPIRED = 'expired', // 已过期
}

@Schema({ timestamps: true })
export class BilibiliCookie {
  @Prop({ required: true })
  name: string; // Cookie 名称/备注

  @Prop({ required: true, type: String })
  content: string; // Cookie 内容（Netscape 格式）

  @Prop({
    required: true,
    enum: BilibiliCookieStatus,
    default: BilibiliCookieStatus.ENABLED,
  })
  status: BilibiliCookieStatus;

  @Prop()
  lastUsedAt?: Date; // 最后使用时间

  @Prop()
  lastError?: string; // 最后错误信息

  @Prop({ default: 0 })
  usageCount: number; // 使用次数

  @Prop()
  createdBy?: string; // 创建者手机号

  @Prop()
  updatedBy?: string; // 最后编辑者手机号
}

export const BilibiliCookieSchema =
  SchemaFactory.createForClass(BilibiliCookie);

// 创建索引
BilibiliCookieSchema.index({ status: 1, createdAt: -1 });
BilibiliCookieSchema.index({ status: 1, lastUsedAt: -1 });
