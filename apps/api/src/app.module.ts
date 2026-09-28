import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { IdentityModule } from './modules/identity/identity.module';
import { DemandesModule } from './modules/demandes/demandes.module';
import { AffectationModule } from './modules/affectation/affectation.module';
import { TerrainModule } from './modules/terrain/terrain.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { ScoringModule } from './modules/scoring/scoring.module';
import { ConformiteModule } from './modules/conformite/conformite.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { AuditModule } from './modules/audit/audit.module';
import { ClientsModule } from './modules/clients/clients.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    IdentityModule,
    DemandesModule,
    ClientsModule,
    AffectationModule,
    TerrainModule,
    WorkflowModule,
    ScoringModule,
    ConformiteModule,
    DocumentsModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
