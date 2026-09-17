import { PrismaClient, SpotType, ParkingSession } from '@prisma/client';

const prisma = new PrismaClient();

export class PricingService {
  /**
   * Calculate the parking fee based on entry, exit, and spot type.
   * Fetches the latest rate card from the database.
   * If a RateCard isn't found, throws an Error.
   */
  static async calculateFee(
    spotType: SpotType,
    entryTime: Date,
    exitTime: Date,
  ): Promise<number> {
    const durationMs = exitTime.getTime() - entryTime.getTime();
    if (durationMs <= 0) return 0;

    // Convert to billable hours (ceiling)
    // 30 min -> 1 hour
    // 59 min -> 1 hour
    // 60 min -> 1 hour
    // 61 min -> 2 hours
    const durationHours = durationMs / (1000 * 60 * 60);
    const billableHours = Math.ceil(durationHours);

    // Get the active rate card for the spot type
    const rateCard = await prisma.rateCard.findFirst({
      where: { spotType },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (!rateCard) {
      throw new Error(`No rate card found for spot type: ${spotType}`);
    }

    const firstHourRate = Number(rateCard.firstHourRate);
    const additionalHourRate = Number(rateCard.additionalHourRate);
    const dailyCap = Number(rateCard.dailyCap);

    let fee = 0;
    if (billableHours === 1) {
      fee = firstHourRate;
    } else if (billableHours > 1) {
      fee = firstHourRate + (billableHours - 1) * additionalHourRate;
    }

    // Apply daily cap (interpretation: max fee for the entire session)
    return Math.min(fee, dailyCap);
  }
}
