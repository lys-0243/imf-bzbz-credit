import { Module } from '@nestjs/common';
import { TerrainController } from './terrain.controller';

@Module({ controllers: [TerrainController] })
export class TerrainModule {}
