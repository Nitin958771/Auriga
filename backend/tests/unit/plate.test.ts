import { describe, it, expect } from 'vitest';
import { normalizePlate } from '../../src/utils/plate.js';

describe('Plate Normalization Utility', () => {
  it('should trim whitespace', () => {
    expect(normalizePlate('  RJ14AB1234  ')).toBe('RJ14AB1234');
  });

  it('should convert to uppercase', () => {
    expect(normalizePlate('rj14ab1234')).toBe('RJ14AB1234');
  });

  it('should remove internal spaces', () => {
    expect(normalizePlate('RJ14 AB 1234')).toBe('RJ14AB1234');
  });

  it('should remove internal dashes', () => {
    expect(normalizePlate('RJ14-AB-1234')).toBe('RJ14AB1234');
  });

  it('should handle combination of all cases', () => {
    expect(normalizePlate('  rj14 - ab 1234  ')).toBe('RJ14AB1234');
  });
});
