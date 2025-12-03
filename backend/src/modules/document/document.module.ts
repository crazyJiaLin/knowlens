import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { Document, DocumentSchema } from './schemas/document.schema';
import { Segment, SegmentSchema } from './schemas/segment.schema';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Document.name, schema: DocumentSchema },
      { name: Segment.name, schema: SegmentSchema },
    ]),
    BullModule.registerQueue({
      name: 'video-queue',
    }),
  ],
  controllers: [DocumentController],
  providers: [DocumentService],
  exports: [DocumentService, MongooseModule],
})
export class DocumentModule {}
