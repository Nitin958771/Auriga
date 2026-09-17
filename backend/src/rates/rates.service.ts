import { SpotType, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ImportReport {
  processedRows: number;
  acceptedRows: number;
  rejectedRows: number;
  errors: Array<{ row: number; reason: string }>;
}

export class RatesService {
  /**
   * Imports a messy rate card CSV string.
   * Expects format (or similar): Type,First Hour,Additional Hour,Daily Cap
   */
  static async importCSV(csvData: string): Promise<ImportReport> {
    const report: ImportReport = {
      processedRows: 0,
      acceptedRows: 0,
      rejectedRows: 0,
      errors: [],
    };

    const lines = csvData.split(/\r?\n/);
    if (lines.length === 0) return report;

    // Skip header line if present (heuristically check if first line contains letters in columns 2,3,4)
    let startIndex = 0;
    if (lines[0].toLowerCase().includes('type') || isNaN(Number(lines[0].split(',')[1]?.trim()))) {
      startIndex = 1;
    }

    const validRates: Map<SpotType, any> = new Map();

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip blank lines
      
      report.processedRows++;
      const rowNumber = i + 1; // 1-based index for humans

      const cols = line.split(',');
      if (cols.length < 4) {
        report.rejectedRows++;
        report.errors.push({ row: rowNumber, reason: 'Missing columns' });
        continue;
      }

      // 1. Normalize and validate type
      const rawType = cols[0].trim().toUpperCase();
      if (rawType !== 'COMPACT' && rawType !== 'STANDARD' && rawType !== 'EV') {
        report.rejectedRows++;
        report.errors.push({ row: rowNumber, reason: `Invalid spot type: ${rawType}` });
        continue;
      }
      const spotType = rawType as SpotType;

      // 2. Validate numeric values
      const firstHourRate = Number(cols[1].trim());
      const additionalHourRate = Number(cols[2].trim());
      const dailyCap = Number(cols[3].trim());

      if (isNaN(firstHourRate) || firstHourRate < 0) {
        report.rejectedRows++;
        report.errors.push({ row: rowNumber, reason: 'Invalid first-hour rate' });
        continue;
      }
      if (isNaN(additionalHourRate) || additionalHourRate < 0) {
        report.rejectedRows++;
        report.errors.push({ row: rowNumber, reason: 'Invalid additional-hour rate' });
        continue;
      }
      if (isNaN(dailyCap) || dailyCap < 0) {
        report.rejectedRows++;
        report.errors.push({ row: rowNumber, reason: 'Invalid daily cap' });
        continue;
      }

      // If multiple valid definitions exist for the same spot type, the last one wins.
      validRates.set(spotType, {
        spotType,
        firstHourRate,
        additionalHourRate,
        dailyCap,
      });
    }

    // Persist valid rates in a transaction
    if (validRates.size > 0) {
      await prisma.$transaction(async (tx) => {
        for (const rate of validRates.values()) {
          await tx.rateCard.create({
            data: rate,
          });
          report.acceptedRows++;
        }
      });
    }

    return report;
  }
}
