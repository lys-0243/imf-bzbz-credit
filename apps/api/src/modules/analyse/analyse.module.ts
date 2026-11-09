import { Module } from '@nestjs/common';
import { ScoringModule } from '../scoring/scoring.module';
import { AnalyseController } from './analyse.controller';
import { AnalyseService } from './analyse.service';

@Module({
  imports: [ScoringModule],
  controllers: [AnalyseController],
  providers: [AnalyseService],
})
export class AnalyseModule {}
