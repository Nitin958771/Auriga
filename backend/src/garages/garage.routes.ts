import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function garageRoutes(fastify: FastifyInstance) {
  fastify.get('/api/garages', async (request, reply) => {
    const garages = await prisma.garage.findMany({
      include: {
        levels: {
          include: {
            spots: true
          }
        }
      }
    });
    return reply.status(200).send(garages);
  });

  fastify.post('/api/garages', async (request, reply) => {
    const { name, description } = request.body as any;
    if (!name) return reply.status(400).send({ error: 'Name is required' });

    const garage = await prisma.garage.create({
      data: { name, description }
    });
    return reply.status(201).send(garage);
  });
}
