import { Module } from '@nestjs/common';
import { ConformiteController } from './conformite.controller';

@Module({ controllers: [ConformiteController] })
export class ConformiteModule {}
