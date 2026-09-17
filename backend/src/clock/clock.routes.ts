import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { clockService } from './clock.service.js';
import { PrismaClient, SessionStatus } from '@prisma/client';
import { PricingService } from '../pricing/pricing.service.js';

const prisma = new PrismaClient();

const ClockBodySchema = z.object({
  currentTime: z.string().datetime().optional(), // ISO string
});

export async function clockRoutes(fastify: FastifyInstance) {
  fastify.post('/api/clock', async (request, reply) => {
    const parsed = ClockBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Bad Request', details: parsed.error.format() });
    }

    const { currentTime } = parsed.data;

    // 1. Update the application clock
    if (currentTime) {
      clockService.setSimulatedTime(new Date(currentTime));
    }

    const now = clockService.now();

    // 2. Find every ACTIVE session whose duration is strictly greater than 24 hours.
    // 24 hours = 24 * 60 * 60 * 1000 = 86400000 ms
    const thresholdMs = 24 * 60 * 60 * 1000;
    const autoCloseThreshold = new Date(now.getTime() - thresholdMs);

    const eligibleSessions = await prisma.parkingSession.findMany({
      where: {
        status: SessionStatus.ACTIVE,
        entryTime: {
          lt: autoCloseThreshold, // strictly less than -> duration strictly greater than 24h
        },
      },
      include: { spot: true },
    });

    let closedCount = 0;

    for (const session of eligibleSessions) {
      // Use a transaction for each session to ensure atomic auto-close
      await prisma.$transaction(async (tx) => {
        // Re-check and lock the session to prevent concurrent checkout
        const lockedSessionArr = await tx.$queryRaw<any[]>`
          SELECT * FROM "ParkingSession"
          WHERE id = ${session.id} AND status = 'ACTIVE'
          FOR UPDATE
        `;
        
        if (lockedSessionArr.length === 0) return; // Already processed
        
        const fee = await PricingService.calculateFee(session.spot.spotType, session.entryTime, now);

        await tx.parkingSession.update({
          where: { id: session.id },
          data: {
            exitTime: now,
            fee: fee,
            status: SessionStatus.COMPLETED,
            autoClosed: true,
          },
        });

        await tx.parkingSpot.update({
          where: { id: session.spotId },
          data: {
            status: 'AVAILABLE',
          },
        });

        closedCount++;
      });
    }

    return reply.status(200).send({
      message: 'Clock advanced and sessions auto-closed',
      simulatedTime: now.toISOString(),
      autoClosedSessions: closedCount,
    });
  });
}
