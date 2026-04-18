import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import type { ApiRuntimeConfig } from './config/api-runtime-config';

export function configureApp(app: INestApplication, config: ApiRuntimeConfig) {
  app.setGlobalPrefix('api', {
    exclude: ['health'],
  });
  app.enableCors({
    origin: config.corsOrigin,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Work Archive API')
    .setDescription(
      'Milestone 5 production-ready API for a local-first work archive with NestJS, Prisma, and PostgreSQL.',
    )
    .setVersion('0.5.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('docs', app, swaggerDocument, {
    jsonDocumentUrl: 'docs/openapi.json',
  });
}
