import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function levelRoutes(fastify: FastifyInstance) {
  fastify.post('/api/garages/:id/levels', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { levelNumber, name } = request.body as any;

    if (levelNumber === undefined) return reply.status(400).send({ error: 'Level number is required' });

    try {
      const level = await prisma.level.create({
        data: {
          garageId: id,
          levelNumber: Number(levelNumber),
          name
        }
      });
      return reply.status(201).send(level);
    } catch (e: any) {
      if (e.code === 'P2002') {
         return reply.status(409).send({ error: 'Conflict', message: 'Level number already exists in this garage' });
      }
      throw e;
    }
  });
}
