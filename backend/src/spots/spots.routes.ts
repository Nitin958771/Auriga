import { FastifyInstance } from 'fastify';
import { PrismaClient, SpotType } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

const AvailabilityQuerySchema = z.object({
  type: z.nativeEnum(SpotType).optional(),
});

export async function spotsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/spots/availability', async (request, reply) => {
    const parsed = AvailabilityQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Bad Request', details: parsed.error.format() });
    }

    const { type } = parsed.data;

    const where: any = {};
    if (type) {
      where.spotType = type;
    }

    const [total, occupied, availableSpots] = await Promise.all([
      prisma.parkingSpot.count({ where }),
      prisma.parkingSpot.count({ where: { ...where, status: 'OCCUPIED' } }),
      prisma.parkingSpot.findMany({
        where: { ...where, status: 'AVAILABLE' },
        include: { level: true },
        orderBy: [{ level: { levelNumber: 'asc' } }, { spotNumber: 'asc' }]
      })
    ]);

    return reply.status(200).send({
      type: type || 'ALL',
      total,
      available: total - occupied,
      occupied,
      spots: availableSpots.map(s => ({
        id: s.id,
        level: s.level.levelNumber,
        spotNumber: s.spotNumber,
        type: s.spotType
      }))
    });
  });
}
