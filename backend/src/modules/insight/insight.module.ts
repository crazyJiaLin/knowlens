import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Insight, InsightSchema } from './schemas/insight.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Insight.name, schema: InsightSchema }]),
  ],
  exports: [MongooseModule],
})
export class InsightModule {}
