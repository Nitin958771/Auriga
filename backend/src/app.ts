import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import { env } from './config/env.js';

import { authRoutes } from './auth/auth.routes.js';
import { sessionRoutes } from './sessions/sessions.routes.js';
import { ratesRoutes } from './rates/rates.routes.js';
import { spotsRoutes } from './spots/spots.routes.js';
import { clockRoutes } from './clock/clock.routes.js';
import { verifyJWT } from './middleware/auth.middleware.js';

export function buildApp(): FastifyInstance {
  const app = fastify({
    logger: true,
  });

  // Plugins
  app.register(helmet);
  app.register(cors, {
    origin: env.FRONTEND_ORIGIN,
    credentials: true,
  });
  app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
  });
  app.register(jwt, {
    secret: env.JWT_SECRET,
  });

  // Global error handler
  app.setErrorHandler((error, request, reply) => {
    if (error.statusCode === 429) {
      return reply.status(429).send({ error: 'Too Many Requests', message: 'Rate limit exceeded' });
    }
    app.log.error(error);
    reply.status(error.statusCode || 500).send({
      error: error.name || 'Internal Server Error',
      message: error.statusCode ? error.message : 'An unexpected error occurred',
    });
  });

  // Decorate request with JWT verification
  app.decorate('authenticate', verifyJWT);

  // Register public routes
  app.register(authRoutes);
  
  // Test/Admin route
  app.register(clockRoutes);

  // Register protected routes (require JWT)
  app.register(async (protectedRoutes) => {
    protectedRoutes.addHook('onRequest', verifyJWT);
    
    protectedRoutes.register(sessionRoutes);
    protectedRoutes.register(ratesRoutes);
    protectedRoutes.register(spotsRoutes);
  });

  return app;
}
