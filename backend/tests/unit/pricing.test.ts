import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PricingService } from '../../src/pricing/pricing.service.js';
import { SpotType, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mock Prisma
vi.mock('@prisma/client', () => {
  const mPrismaClient = {
    rateCard: {
      findFirst: vi.fn(),
    },
  };
  return { PrismaClient: vi.fn(() => mPrismaClient), SpotType: { COMPACT: 'COMPACT', STANDARD: 'STANDARD', EV: 'EV' } };
});

describe('PricingService', () => {
  const baseTime = new Date('2026-09-17T12:00:00Z');

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.rateCard.findFirst as any).mockResolvedValue({
      spotType: 'STANDARD',
      firstHourRate: 12.0,
      additionalHourRate: 6.0,
      dailyCap: 60.0,
    });
  });

  const testCases = [
    { name: '30 minutes -> 1 hour', addMs: 30 * 60 * 1000, expectedFee: 12.0 },
    { name: '59 minutes -> 1 hour', addMs: 59 * 60 * 1000, expectedFee: 12.0 },
    { name: '60 minutes -> 1 hour', addMs: 60 * 60 * 1000, expectedFee: 12.0 },
    { name: '61 minutes -> 2 hours', addMs: 61 * 60 * 1000, expectedFee: 18.0 },
    { name: '119 minutes -> 2 hours', addMs: 119 * 60 * 1000, expectedFee: 18.0 },
    { name: '120 minutes -> 2 hours', addMs: 120 * 60 * 1000, expectedFee: 18.0 },
    { name: '121 minutes -> 3 hours', addMs: 121 * 60 * 1000, expectedFee: 24.0 },
    { name: 'exact cap (9 hours -> 12 + 8*6 = 60)', addMs: 9 * 60 * 60 * 1000, expectedFee: 60.0 },
    { name: 'just above cap (10 hours -> 12 + 9*6 = 66 -> capped at 60)', addMs: 10 * 60 * 60 * 1000, expectedFee: 60.0 },
    { name: '24 hours -> cap', addMs: 24 * 60 * 60 * 1000, expectedFee: 60.0 },
    { name: '25 hours -> cap', addMs: 25 * 60 * 60 * 1000, expectedFee: 60.0 },
    { name: 'multiple days (48 hours) -> cap', addMs: 48 * 60 * 60 * 1000, expectedFee: 60.0 },
  ];

  for (const tc of testCases) {
    it(tc.name, async () => {
      const entry = new Date(baseTime.getTime());
      const exit = new Date(baseTime.getTime() + tc.addMs);
      
      const fee = await PricingService.calculateFee(SpotType.STANDARD, entry, exit);
      expect(fee).toBe(tc.expectedFee);
    });
  }
});
