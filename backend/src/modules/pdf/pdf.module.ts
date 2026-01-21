import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { Document, DocumentSchema } from '../document/schemas/document.schema';
import { Segment, SegmentSchema } from '../document/schemas/segment.schema';
import { PdfController } from './pdf.controller';
import { PdfService } from './pdf.service';
import { PdfProcessor } from './processors/pdf.processor';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Document.name, schema: DocumentSchema },
      { name: Segment.name, schema: SegmentSchema },
    ]),
    BullModule.registerQueue({
      name: 'pdf-queue',
      defaultJobOptions: {
        removeOnComplete: {
          age: 7 * 24 * 60 * 60 * 1000,
          count: 1000,
        },
        removeOnFail: {
          age: 30 * 24 * 60 * 60 * 1000,
          count: 500,
        },
      },
    }),
    BullModule.registerQueue({
      name: 'knowledge-queue',
      defaultJobOptions: {
        removeOnComplete: {
          age: 7 * 24 * 60 * 60 * 1000,
          count: 1000,
        },
        removeOnFail: {
          age: 30 * 24 * 60 * 60 * 1000,
          count: 500,
        },
      },
    }),
  ],
  controllers: [PdfController],
  providers: [PdfService, PdfProcessor],
})
export class PdfModule {}
