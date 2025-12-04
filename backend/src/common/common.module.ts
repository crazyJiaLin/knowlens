import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MoonshotService } from './services/moonshot.service';

@Module({
  imports: [ConfigModule],
  providers: [MoonshotService],
  exports: [MoonshotService],
})
export class CommonModule {}
