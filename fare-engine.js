/*
 * PasaheCheck demo fare engine.
 * Rates: September 28, 2026 news reporting for Philippine jeepneys.
 * This is an ESTIMATE using measured phone distance, not an LTFRB-certified fare.
 * For fractional kilometers this prototype uses a proportional formula.
 * Confirm the authorized route distance, partial-km rules, and published matrix
 * before calling a discrepancy an overcharge.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PasaheCheckFare = api;
})(typeof window !== 'undefined' ? window : undefined, function () {
  'use strict';
  const RATE_CONFIG = Object.freeze({
    traditional: Object.freeze({ label: 'Traditional jeepney', base: 14, initialKm: 4, succeeding: 2 }),
    modern: Object.freeze({ label: 'Modern jeepney', base: 17, initialKm: 4, succeeding: 2.4 })
  });
  const roundQuarter = value => Math.round((value + Number.EPSILON) * 4) / 4;
  function calculateFare(distanceKm, vehicleType = 'traditional', discounted = false) {
    if (!Number.isFinite(distanceKm) || distanceKm < 0) throw new RangeError('Distance must be a non-negative finite number.');
    const rate = RATE_CONFIG[vehicleType];
    if (!rate) throw new RangeError('Unknown vehicle type');
    const extraKm = Math.max(0, distanceKm - rate.initialKm);
    const extraFare = extraKm * rate.succeeding;
    const regularUnrounded = rate.base + extraFare;
    const discountUnrounded = discounted ? regularUnrounded * 0.20 : 0;
    const total = roundQuarter(regularUnrounded - discountUnrounded);
    return { rate, distanceKm, extraKm, baseFare: rate.base, extraFare, discountUnrounded, total, discounted };
  }
  return { RATE_CONFIG, roundQuarter, calculateFare };
});
