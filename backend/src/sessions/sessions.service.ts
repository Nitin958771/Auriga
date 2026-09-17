import { PrismaClient, SpotType, SessionStatus } from '@prisma/client';
import { normalizePlate } from '../utils/plate.js';
import { clockService } from '../clock/clock.service.js';
import { PricingService } from '../pricing/pricing.service.js';

const prisma = new PrismaClient();

export class SessionsService {
  /**
   * Check in a vehicle.
   */
  static async checkIn(rawPlate: string, vehicleType: SpotType) {
    const plate = normalizePlate(rawPlate);

    return await prisma.$transaction(async (tx) => {
      // 1. Check if plate already has an ACTIVE session
      const existingSession = await tx.parkingSession.findFirst({
        where: { plate, status: SessionStatus.ACTIVE },
      });
      if (existingSession) {
        throw new Error(`Plate ${plate} already has an active session.`);
      }

      // 2. Find compatible spot using FOR UPDATE SKIP LOCKED
      // Priority: lowest level first, then lowest spot number
      // We use $queryRaw to utilize SKIP LOCKED
      const spots = await tx.$queryRaw<any[]>`
        SELECT "ParkingSpot".* FROM "ParkingSpot"
        JOIN "Level" ON "ParkingSpot"."levelId" = "Level"."id"
        WHERE "ParkingSpot"."spotType" = ${vehicleType}::"SpotType"
          AND "ParkingSpot"."status" = 'AVAILABLE'
        ORDER BY "Level"."levelNumber" ASC, "ParkingSpot"."spotNumber" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `;

      if (spots.length === 0) {
        throw new Error(`No ${vehicleType} parking spot is available`);
      }

      const spotId = spots[0].id;

      // 3. Mark spot occupied
      await tx.parkingSpot.update({
        where: { id: spotId },
        data: { status: 'OCCUPIED' },
      });

      // 4. Create active session
      const now = clockService.now();
      const session = await tx.parkingSession.create({
        data: {
          plate,
          spotId,
          entryTime: now,
          status: SessionStatus.ACTIVE,
        },
        include: {
          spot: {
            include: { level: true }
          }
        }
      });

      return session;
    });
  }

  /**
   * Check out a vehicle.
   */
  static async checkOut(sessionId: string) {
    return await prisma.$transaction(async (tx) => {
      // 1. Lock the session
      const sessions = await tx.$queryRaw<any[]>`
        SELECT * FROM "ParkingSession"
        WHERE id = ${sessionId} AND status = 'ACTIVE'
        FOR UPDATE
      `;
      
      if (sessions.length === 0) {
        throw new Error(`Session ${sessionId} is not active or does not exist`);
      }
      
      const session = await tx.parkingSession.findUniqueOrThrow({
        where: { id: sessionId },
        include: { spot: true }
      });

      const now = clockService.now();

      // 2. Calculate fee
      const fee = await PricingService.calculateFee(session.spot.spotType, session.entryTime, now);

      // 3. Complete session
      const updatedSession = await tx.parkingSession.update({
        where: { id: sessionId },
        data: {
          exitTime: now,
          fee: fee,
          status: SessionStatus.COMPLETED,
          autoClosed: false,
        },
      });

      // 4. Release spot
      await tx.parkingSpot.update({
        where: { id: session.spotId },
        data: { status: 'AVAILABLE' },
      });

      return updatedSession;
    });
  }

  /**
   * Transfer an active session to a new plate.
   */
  static async transfer(sessionId: string, rawNewPlate: string) {
    const newPlate = normalizePlate(rawNewPlate);

    return await prisma.$transaction(async (tx) => {
      // 1. Lock the session
      const sessions = await tx.$queryRaw<any[]>`
        SELECT * FROM "ParkingSession"
        WHERE id = ${sessionId} AND status = 'ACTIVE'
        FOR UPDATE
      `;
      
      if (sessions.length === 0) {
        throw new Error(`Session ${sessionId} is not active or does not exist`);
      }

      // 2. Ensure new plate doesn't already have an active session
      const existingSession = await tx.parkingSession.findFirst({
        where: { plate: newPlate, status: SessionStatus.ACTIVE },
      });
      if (existingSession) {
        throw new Error(`Plate ${newPlate} already has an active session.`);
      }

      // 3. Update plate (preserve entryTime and spotId)
      const updatedSession = await tx.parkingSession.update({
        where: { id: sessionId },
        data: { plate: newPlate },
        include: { spot: { include: { level: true } } }
      });

      return updatedSession;
    });
  }
}
