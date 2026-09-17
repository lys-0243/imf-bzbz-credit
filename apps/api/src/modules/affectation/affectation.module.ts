import { Module } from '@nestjs/common';
import { AffectationController } from './affectation.controller';

@Module({ controllers: [AffectationController] })
export class AffectationModule {}
