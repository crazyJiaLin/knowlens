import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OssService } from './oss.service';
import { SmsService } from './sms.service';

@Module({
  imports: [ConfigModule],
  providers: [OssService, SmsService],
  exports: [OssService, SmsService],
})
export class AliyunModule {}
