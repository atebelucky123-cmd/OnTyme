// Pricing model — placeholder coefficients per OnTyme.md section 13/44.
// These are planning inputs, not calibrated numbers. Adjust freely; nothing
// else in the codebase needs to change when you tune them.
export const PRICING = {
  baseFare: 3000,
  perKm: 350,
  perMin: 60,
  minimumFare: 3000,
  freeWaitingMinutes: 5,
  waitingPerMinute: 100,
  roundTripMultiplier: 1.85,
  waitReturnMultiplier: 1.7,
  airportSurcharge: 3000,
  estimateRangeSpread: 0.12
};

export function calculateFare({ distanceKm, durationMin, tripType }) {
  let distance = distanceKm;
  let duration = durationMin;
  let extra = 0;

  if (tripType === 'roundtrip') {
    distance *= PRICING.roundTripMultiplier;
    duration *= PRICING.roundTripMultiplier;
  } else if (tripType === 'waitreturn') {
    distance *= PRICING.waitReturnMultiplier;
    duration *= PRICING.waitReturnMultiplier;
  } else if (tripType === 'airport') {
    extra += PRICING.airportSurcharge;
  }

  const distanceCharge = distance * PRICING.perKm;
  const timeCharge = duration * PRICING.perMin;
  let total = PRICING.baseFare + distanceCharge + timeCharge + extra;
  total = Math.max(total, PRICING.minimumFare);

  const low = Math.round((total * (1 - PRICING.estimateRangeSpread)) / 100) * 100;
  const high = Math.round((total * (1 + PRICING.estimateRangeSpread)) / 100) * 100;

  return {
    distanceKm: Math.round(distance * 10) / 10,
    durationMin: Math.round(duration),
    low,
    high,
    breakdown: {
      base: PRICING.baseFare,
      distance: Math.round(distanceCharge),
      time: Math.round(timeCharge),
      extra
    }
  };
}

export function formatNaira(amount) {
  return '₦' + Math.round(amount).toLocaleString('en-NG');
}
