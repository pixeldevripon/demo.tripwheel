import 'dotenv/config';

import { AppModule } from '@/app.module';
import { auth } from '@/auth/auth.instance';
import { AllExceptionsFilter } from '@/common/filters/http-exception.filter';
import { parseCorsOrigins } from '@/common/utils/parse-cors-origins';
import { validateEnv } from '@/env.validate';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import helmet from 'helmet';

async function bootstrap() {
  validateEnv();

  // rawBody: true keeps the unparsed request body available for Stripe webhook
  // signature verification (PaymentsController reads req.rawBody).
  const app = await NestFactory.create(AppModule, { rawBody: true });
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
          // unsafe-inline needed only for Swagger UI - tightened in production
          scriptSrc: isProd ? ["'self'"] : ["'self'", "'unsafe-inline'"],
          styleSrc: isProd ? ["'self'"] : ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
        },
      },
    }),
  );

  // ── CORS ────────────────────────────────────────────────────────────────────
  const allowedOrigins = parseCorsOrigins(process.env.CORS_ORIGINS);

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no Origin header (Postman, curl, server-to-server)
      // and listed origins. The literal string 'null' is NOT allowed: that is
      // what sandboxed iframes and data:/file: pages send, and combined with
      // credentials:true it would let such a page make cookie-carrying calls.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS: origin not allowed'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // Octo-* + Accept-Language: OCTO capability negotiation and localization.
    // X-Traveler-Session: the /bookings pair-login token (traveler-session.util).
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Octo-Capabilities',
      'Octo-Env',
      'Accept-Language',
      'X-Traveler-Session',
    ],
    // Let OTAs read the echoed capability set + negotiated content locale.
    exposedHeaders: ['Octo-Capabilities', 'Content-Language'],
  });

  // ── Global pipes & filters ──────────────────────────────────────────────────
  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      // enableImplicitConversion removed - use explicit @Type() decorators on DTOs
    }),
  );

  // ── Routing ─────────────────────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1', {
    exclude: ['api/auth/*path'],
  });

  // ── Swagger ─────────────────────────────────────────────────────────────────
  // Served in EVERY environment, production included (product decision,
  // 2026-07-21). The old "non-production only" comment here never matched the
  // code - nothing gated it - and the code was right.
  await setupSwagger(app);

  // ── Graceful shutdown ───────────────────────────────────────────────────────
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 5050);
}

/** Build the OpenAPI document (app + Better Auth) and mount `/api/docs`. */
async function setupSwagger(app: INestApplication): Promise<void> {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Island Tours API')
    .setDescription('Tour marketplace - operators, slots, bookings')
    .setVersion('1.0')
    .addCookieAuth('better-auth.session_token')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  // `generateOpenAPISchema` only exists when Better Auth's `openAPI()` plugin is
  // registered, and that plugin is deliberately dev-only (auth.instance.ts) - it
  // publishes the auth schema. So in production the method is genuinely absent,
  // and calling it threw `auth.api.generateOpenAPISchema is not a function` on
  // every boot. The app's own routes were documented fine; only the /api/auth/*
  // section was missing, with a scary error standing in for a one-line skip.
  if (typeof auth.api.generateOpenAPISchema !== 'function') {
    SwaggerModule.setup('api/docs', app, document);
    return;
  }

  try {
    const authSchema = await auth.api.generateOpenAPISchema();

    const transformedAuthPaths: any = {};
    for (const [pathKey, pathItem] of Object.entries(authSchema.paths)) {
      const newPathKey = `/api/auth${pathKey}`;
      const newPathItem: any = { ...pathItem };

      for (const method of [
        'get',
        'post',
        'put',
        'delete',
        'patch',
        'options',
        'head',
      ]) {
        if (newPathItem[method]) {
          newPathItem[method].tags = ['Auth'];
        }
      }

      transformedAuthPaths[newPathKey] = newPathItem;
    }

    document.paths = { ...document.paths, ...transformedAuthPaths };

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

  SwaggerModule.setup('api/docs', app, document);
}

void bootstrap();
