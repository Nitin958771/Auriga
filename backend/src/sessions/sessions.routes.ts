import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SessionsService } from './sessions.service.js';
import { SpotType, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CheckInSchema = z.object({
  plate: z.string().min(1).max(20),
  vehicleType: z.nativeEnum(SpotType),
});

const TransferSchema = z.object({
  newPlate: z.string().min(1).max(20),
});

const SearchSchema = z.object({
  plate: z.string().optional(),
  status: z.enum(['ACTIVE', 'COMPLETED']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export async function sessionRoutes(fastify: FastifyInstance) {
  fastify.post('/api/sessions/check-in', async (request, reply) => {
    const parsed = CheckInSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Bad Request', details: parsed.error.format() });
    }

    try {
      const session = await SessionsService.checkIn(parsed.data.plate, parsed.data.vehicleType);
      return reply.status(201).send(session);
    } catch (error: any) {
      if (error.message.includes('already has an active session')) {
        return reply.status(409).send({ error: 'Conflict', message: error.message });
      }
      if (error.message.includes('No') && error.message.includes('is available')) {
        return reply.status(409).send({ error: 'Conflict', message: error.message });
      }
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.post('/api/sessions/:id/check-out', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    try {
      const session = await SessionsService.checkOut(id);
      return reply.status(200).send(session);
    } catch (error: any) {
      if (error.message.includes('not active or does not exist')) {
        return reply.status(409).send({ error: 'Conflict', message: error.message });
      }
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.post('/api/sessions/:id/transfer', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = TransferSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Bad Request', details: parsed.error.format() });
    }

    try {
      const session = await SessionsService.transfer(id, parsed.data.newPlate);
      return reply.status(200).send(session);
    } catch (error: any) {
      if (error.message.includes('already has an active session') || error.message.includes('not active or does not exist')) {
        return reply.status(409).send({ error: 'Conflict', message: error.message });
      }
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.get('/api/sessions', async (request, reply) => {
    const parsed = SearchSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Bad Request', details: parsed.error.format() });
    }

    const { plate, status, page, limit } = parsed.data;
    
    const where: any = {};
    if (plate) where.plate = plate.toUpperCase().trim().replace(/[\s-]/g, ''); // Normalization could be moved to util
    if (status) where.status = status;

    const skip = (page - 1) * limit;

    const [total, sessions] = await Promise.all([
      prisma.parkingSession.count({ where }),
      prisma.parkingSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: { entryTime: 'desc' },
        include: { spot: { include: { level: true } } }
      })
    ]);

    return reply.send({
      data: sessions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  });
}
