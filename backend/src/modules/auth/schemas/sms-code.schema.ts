import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document as MongooseDocument } from 'mongoose';

export type SmsCodeDocument = SmsCode & MongooseDocument;

@Schema({ timestamps: true })
export class SmsCode {
  @Prop({ required: true })
  phone: string;

  @Prop({ required: true })
  code: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: false })
  used: boolean;
}

export const SmsCodeSchema = SchemaFactory.createForClass(SmsCode);

// 复合索引：查询未使用且未过期的验证码
SmsCodeSchema.index({ phone: 1, expiresAt: 1, used: 1 });

// TTL索引：自动删除过期验证码（24小时后）
SmsCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });
