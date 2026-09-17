/**
 * Normalizes a license plate by trimming whitespace,
 * converting to uppercase, and removing internal spaces or dashes.
 */
export function normalizePlate(plate: string): string {
  return plate
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, '');
}
