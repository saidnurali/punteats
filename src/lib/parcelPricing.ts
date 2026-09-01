// src/lib/parcelPricing.ts
// ─── Parcel Delivery Pricing ───────────────────────────────────────────────
// Centralised pricing logic — edit rates here only, never in UI components.

export type PackageSize = 'Small' | 'Medium' | 'Large';

interface PricingResult {
  deliveryFee: number;
  serviceFee: number;
  total: number;
  deliveryFeeFormatted: string;
  serviceFeeFormatted: string;
  totalFormatted: string;
}

// ── Base rates by size ──
const BASE_RATES: Record<PackageSize, number> = {
  Small: 1.50,
  Medium: 2.50,
  Large: 3.50,
};

const SERVICE_FEE = 0.50;

/**
 * Calculate delivery fee based on package size.
 * Distance-based pricing can be added here later:
 *   e.g. distanceKm * 0.30 added to the base rate
 */
export function calculateParcelFee(
  packageSize: PackageSize,
  distanceKm?: number
): PricingResult {
  const base = BASE_RATES[packageSize] ?? BASE_RATES.Medium;
  const distanceSurcharge = distanceKm ? Math.max(0, (distanceKm - 3) * 0.20) : 0;
  const deliveryFee = parseFloat((base + distanceSurcharge).toFixed(2));
  const serviceFee = SERVICE_FEE;
  const total = parseFloat((deliveryFee + serviceFee).toFixed(2));

  return {
    deliveryFee,
    serviceFee,
    total,
    deliveryFeeFormatted: `$${deliveryFee.toFixed(2)}`,
    serviceFeeFormatted: `$${serviceFee.toFixed(2)}`,
    totalFormatted: `$${total.toFixed(2)}`,
  };
}

export const PACKAGE_TYPES = ['Food', 'Documents', 'Clothing', 'Electronics', 'Other'] as const;
export const PACKAGE_SIZES: PackageSize[] = ['Small', 'Medium', 'Large'];
export type PackageType = typeof PACKAGE_TYPES[number];
