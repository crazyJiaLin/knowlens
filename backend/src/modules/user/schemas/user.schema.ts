import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  phone: string;

  @Prop()
  nickname?: string;

  @Prop()
  avatarUrl?: string;

  @Prop({ required: false, select: false })
  password?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

// 创建索引
UserSchema.index({ phone: 1 }, { unique: true });
