import { describe, it, expect, vi } from 'vitest';
import { RatesService } from '../../src/rates/rates.service.js';

// Mock Prisma
vi.mock('@prisma/client', () => {
  const mPrismaClient = {
    $transaction: vi.fn(async (cb) => {
      return cb({
        rateCard: {
          create: vi.fn(),
        },
      });
    }),
  };
  return { PrismaClient: vi.fn(() => mPrismaClient), SpotType: { COMPACT: 'COMPACT', STANDARD: 'STANDARD', EV: 'EV' } };
});

describe('RatesService CSV Import', () => {
  it('should process a messy rate card', async () => {
    const csv = `Type,First Hour,Additional Hour,Daily Cap
EV,50,30,300
garbage,foo,bar,baz
 STANDARD ,40,20,250
COMPACT,invalid,15,200
COMPACT,30,10,180
`;
    const report = await RatesService.importCSV(csv);
    
    // Total lines minus header = 5
    expect(report.processedRows).toBe(5);
    // Accepted: EV, STANDARD, COMPACT (the last one)
    expect(report.acceptedRows).toBe(3);
    // Rejected: garbage row, COMPACT with invalid number
    expect(report.rejectedRows).toBe(2);
    
    expect(report.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: expect.stringContaining('Invalid spot type') }),
        expect.objectContaining({ reason: expect.stringContaining('Invalid first-hour rate') })
      ])
    );
  });
  
  it('should handle blank lines and extra whitespace', async () => {
    const csv = `

  EV  ,  15  ,  8  ,  80  

`;
    const report = await RatesService.importCSV(csv);
    
    expect(report.processedRows).toBe(1);
    expect(report.acceptedRows).toBe(1);
    expect(report.rejectedRows).toBe(0);
  });
  
  it('should reject negative values', async () => {
    const csv = `EV,-5,10,100`;
    const report = await RatesService.importCSV(csv);
    
    expect(report.processedRows).toBe(1);
    expect(report.acceptedRows).toBe(0);
    expect(report.rejectedRows).toBe(1);
    expect(report.errors[0].reason).toContain('Invalid first-hour rate');
  });
});
