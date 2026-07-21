import Decimal from 'decimal.js/decimal.js';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/**
 * High-precision Food Supplement Dosage and Excipient Calculation Engine
 *
 * Supports Percentage mode and Amount-Per-Serving mode.
 * Enforces q.s. excipient validation (Required Excipient >= 0).
 *
 * @param {object} supplementDetails - Supplement dosage form metadata
 * @param {Array} materials - List of version materials with active amounts and overages
 * @returns {object} Calculated serving and batch metrics
 */
export function calculateSupplementDosage(supplementDetails, materials) {
  const mode = supplementDetails.composition_mode || 'PERCENTAGE';

  if (mode === 'PERCENTAGE') {
    return { composition_mode: 'PERCENTAGE', isValid: true };
  }

  // AMOUNT_PER_SERVING Mode
  const targetUnitWeight = new Decimal(supplementDetails.tablet_weight || supplementDetails.serving_size || '0');
  if (targetUnitWeight.lte(0)) {
    throw new Error('Target tablet/capsule/sachet unit weight is required for Amount-Per-Serving mode');
  }

  let totalActiveWithOverage = new Decimal(0);
  let totalFixedNonActive = new Decimal(0);
  let qsBalancingMaterial = null;
  let qsCount = 0;

  const processedMaterials = [];

  for (const mat of materials) {
    const activeAmt = new Decimal(mat.active_amount_per_serving || mat.serving_amount || '0');
    const overagePct = new Decimal(mat.overage_pct || '0');

    if (overagePct.isNegative()) {
      throw new Error(`Overage percentage cannot be negative for material ${mat.material_name_snapshot || mat.material_id}`);
    }

    if (mat.is_qs_balancing_material) {
      qsCount++;
      qsBalancingMaterial = mat;
      continue;
    }

    // Active amount with overage = ActiveAmt * (1 + Overage% / 100)
    const amtWithOverage = activeAmt.times(new Decimal(1).plus(overagePct.div(100)));

    if (mat.is_fixed_non_active || mat.is_excipient) {
      totalFixedNonActive = totalFixedNonActive.plus(amtWithOverage);
    } else {
      totalActiveWithOverage = totalActiveWithOverage.plus(amtWithOverage);
    }

    processedMaterials.push({
      material_id: mat.material_id,
      name: mat.material_name_snapshot,
      active_amount_per_serving: activeAmt.toFixed(6),
      overage_pct: overagePct.toFixed(6),
      total_amount_per_serving: amtWithOverage.toFixed(6),
    });
  }

  if (qsCount > 1) {
    throw new Error('Only ONE designated q.s. (quantity sufficient) balancing excipient is allowed per supplement formula');
  }

  // Required Excipient = Target Unit Weight - Total Active Ingredients with Overage - Fixed Non-Active Ingredients
  const requiredExcipient = targetUnitWeight.minus(totalActiveWithOverage).minus(totalFixedNonActive);

  if (requiredExcipient.lt(0)) {
    throw new Error(
      `Active ingredients and fixed additives (${totalActiveWithOverage.plus(totalFixedNonActive).toFixed(4)} mg) exceed target unit weight (${targetUnitWeight.toFixed(
        4
      )} mg). Excipient deficit: ${requiredExcipient.abs().toFixed(4)} mg.`
    );
  }

  if (qsBalancingMaterial) {
    processedMaterials.push({
      material_id: qsBalancingMaterial.material_id,
      name: qsBalancingMaterial.material_name_snapshot,
      active_amount_per_serving: '0.000000',
      overage_pct: '0.000000',
      total_amount_per_serving: requiredExcipient.toFixed(6),
      is_qs: true,
    });
  }

  // Calculate percentage composition relative to target unit weight
  const compositionWithPct = processedMaterials.map(m => {
    const amtDec = new Decimal(m.total_amount_per_serving);
    const pct = targetUnitWeight.gt(0) ? amtDec.div(targetUnitWeight).times(100) : new Decimal(0);
    return {
      ...m,
      calculated_percentage: pct.toFixed(6),
    };
  });

  return {
    composition_mode: 'AMOUNT_PER_SERVING',
    target_unit_weight: targetUnitWeight.toFixed(6),
    total_active_with_overage: totalActiveWithOverage.toFixed(6),
    total_fixed_non_active: totalFixedNonActive.toFixed(6),
    required_excipient: requiredExcipient.toFixed(6),
    materials: compositionWithPct,
  };
}
