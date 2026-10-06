import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('IMF Credit API')
    .setDescription(
      [
        'API métier IMF Bisou Bisou : authentification JWT, réception de dossiers,',
        'affectation responsable crédit, terrain agent, workflow et administration.',
        '',
        '**Auth** : obtenir un token via `POST /auth/login`, puis cliquer sur',
        '**Authorize** et coller `Bearer <accessToken>` (ou uniquement le token).',
      ].join('\n'),
    )
    .setVersion('0.1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT renvoyé par POST /auth/login (champ accessToken)',
      },
      'JWT',
    )
    .addTag('Health', 'Santé du service')
    .addTag('Auth', 'Connexion et profil')
    .addTag('Demandes', 'Référentiels et dossiers (réception / agent)')
    .addTag('Affectation', 'File responsable crédit')
    .addTag('Terrain', 'Visites, checklist, rapport, pièces')
    .addTag('Workflow', 'Transitions d’état')
    .addTag('Documents', 'Téléchargement des pièces')
    .addTag('Banking', 'Lookup compte core banking (mock)')
    .addTag('Admin', 'Utilisateurs, zones, produits, audit')
    .addTag('Audit', 'Point d’entrée journal')
    .addTag('Scoring', 'Module scoring (stub)')
    .addTag('Conformite', 'Module conformité (stub)')
    .addTag('Clients', 'Module clients (stub)')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
}

bootstrap();
