import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from '@/app.module';
import { AllExceptionsFilter } from '@/common/filters/http-exception.filter';
import { validateEnv } from '@/env.validate';
import { auth } from '@/auth/auth.instance';

async function bootstrap() {
  validateEnv();

  const app = await NestFactory.create(AppModule);
  const isProd = process.env.NODE_ENV === 'production';

  // Trust one proxy hop (nginx / Cloudflare) so ThrottlerGuard reads the real
  // client IP from X-Forwarded-For instead of the load balancer address.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // ── Security headers ────────────────────────────────────────────────────────
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // unsafe-inline needed only for Swagger UI — tightened in production
          scriptSrc: isProd ? ["'self'"] : ["'self'", "'unsafe-inline'"],
          styleSrc: isProd ? ["'self'"] : ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
        },
      },
    }),
  );

  // ── CORS ────────────────────────────────────────────────────────────────────
  const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim());

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS: origin not allowed'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ── Global pipes & filters ──────────────────────────────────────────────────
  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── Routing ─────────────────────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1', {
    exclude: ['api/auth/*path'],
  });

  // ── Swagger (non-production only) ───────────────────────────────────────────
  if (!isProd) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Island Tours API')
      .setDescription('Tour marketplace — operators, slots, bookings')
      .setVersion('1.0')
      .addCookieAuth('better-auth.session_token')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);

    try {
      // Fetch the generated schema from Better Auth natively
      const authSchema = await auth.api.generateOpenAPISchema();

      const transformedAuthPaths: any = {};
      for (const [pathKey, pathItem] of Object.entries(authSchema.paths)) {
        const newPathKey = `/api/auth${pathKey}`;
        const newPathItem: any = { ...pathItem };
        
        for (const method of ['get', 'post', 'put', 'delete', 'patch', 'options', 'head']) {
          if (newPathItem[method]) {
            newPathItem[method].tags = ['Auth'];
          }
        }
        
        transformedAuthPaths[newPathKey] = newPathItem;
      }

      // Merge paths into NestJS Swagger doc (cast as any to resolve strict TS mismatches)
      document.paths = {
        ...document.paths,
        ...transformedAuthPaths,
      };

      // Merge schemas (types/models)
      if (authSchema.components?.schemas) {
        document.components = document.components || {};
        document.components.schemas = {
          ...document.components.schemas,
          ...(authSchema.components.schemas as any),
        };
      }
    } catch (err) {
      console.warn('Failed to merge Better Auth OpenAPI schema:', err);
    }

    SwaggerModule.setup(
      'api/docs',
      app,
      document,
    );
  }

  // ── Graceful shutdown ───────────────────────────────────────────────────────
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 5050);
}
bootstrap();
