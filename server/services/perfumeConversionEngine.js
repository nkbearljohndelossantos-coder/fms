import Decimal from 'decimal.js/decimal.js';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

const DEFAULT_TOLERANCE = new Decimal('0.000001');

/**
 * Mathematically rigorous Perfume Brand Conversion Engine
 *
 * Supports Mode A (FIXED_TARGET_WEIGHT) and Mode B (AUTO_MINIMUM_FINAL_WEIGHT).
 * Uses Decimal.js for arbitrary-precision arithmetic.
 *
 * @param {object} mixture - Source mixture object with `actual_total_weight` and `materials` list
 * @param {object} targetBrandVersion - Target approved Brand Formula version with `materials` composition list
 * @param {string} mode - 'FIXED_TARGET_WEIGHT' or 'AUTO_MINIMUM_FINAL_WEIGHT'
 * @param {string|number} [specifiedTargetWeight=null] - Specified target batch weight for Mode A
 * @returns {object} Mathematical conversion result with feasibility status and line additions
 */
export function calculatePerfumeConversion(mixture, targetBrandVersion, mode, specifiedTargetWeight = null) {
  const existingTotalWeight = new Decimal(mixture.actual_total_weight || '0');
  if (existingTotalWeight.lte(0)) {
    throw new Error('Source mixture weight must be greater than zero');
  }

  // Map source mixture materials
  const existingMap = {};
  for (const m of mixture.materials) {
    existingMap[m.material_id] = {
      material_id: m.material_id,
      code: m.code || m.material_code_snapshot,
      name: m.name || m.material_name_snapshot,
      percentage: new Decimal(m.percentage || '0'),
      quantity: new Decimal(m.actual_quantity || '0'),
      uom: m.uom || 'kg',
    };
  }

  // Map target brand formula materials
  const targetMap = {};
  for (const tm of targetBrandVersion.materials) {
    targetMap[tm.material_id] = {
      material_id: tm.material_id,
      code: tm.material_code_snapshot || tm.code,
      name: tm.material_name_snapshot || tm.name,
      targetPercentage: new Decimal(tm.percentage || '0'),
      targetFraction: new Decimal(tm.percentage || '0').div(100),
      uom: tm.uom_snapshot || tm.uom || 'kg',
    };
  }

  // Rule 1: Check if an existing material is present in source mixture (qty > 0) but target fraction is zero (not in target formula).
  // If so, addition-only conversion is IMPOSSIBLE regardless of final batch weight.
  const zeroTargetViolations = [];
  for (const matId of Object.keys(existingMap)) {
    const existingMat = existingMap[matId];
    if (existingMat.quantity.gt(0)) {
      const targetMat = targetMap[matId];
      if (!targetMat || targetMat.targetFraction.isZero()) {
        zeroTargetViolations.push(
          `Material '${existingMat.name}' (${existingMat.quantity.toFixed(4)} ${existingMat.uom}) exists in source mixture but has 0% target concentration in target Brand formula.`
        );
      }
    }
  }

  // Mode B: Calculate minimum feasible weight W_min
  // W_min = max( existing_amount_i / target_fraction_i ) for all target_fraction_i > 0
  let minFeasibleWeight = new Decimal(0);
  for (const matId of Object.keys(targetMap)) {
    const targetMat = targetMap[matId];
    if (targetMat.targetFraction.gt(0)) {
      const existingMat = existingMap[matId];
      const existingAmount = existingMat ? existingMat.quantity : new Decimal(0);
      const reqWeightForMat = existingAmount.div(targetMat.targetFraction);
      if (reqWeightForMat.gt(minFeasibleWeight)) {
        minFeasibleWeight = reqWeightForMat;
      }
    }
  }

  // Determine final target batch weight based on mode
  let finalTargetWeight;
  if (mode === 'AUTO_MINIMUM_FINAL_WEIGHT') {
    if (specifiedTargetWeight) {
      const specDec = new Decimal(specifiedTargetWeight);
      finalTargetWeight = specDec.gte(minFeasibleWeight) ? specDec : minFeasibleWeight;
    } else {
      finalTargetWeight = minFeasibleWeight;
    }
  } else {
    // FIXED_TARGET_WEIGHT
    if (!specifiedTargetWeight) {
      throw new Error('Specified target weight is required for FIXED_TARGET_WEIGHT mode');
    }
    finalTargetWeight = new Decimal(specifiedTargetWeight);
  }

  // Calculate required additions for each material
  const allMaterialIds = new Set([...Object.keys(existingMap), ...Object.keys(targetMap)]);
  const additions = [];
  let isFeasible = zeroTargetViolations.length === 0;
  const blockingWarnings = [...zeroTargetViolations];

  for (const matId of allMaterialIds) {
    const existingMat = existingMap[matId];
    const targetMat = targetMap[matId];

    const targetPct = targetMat ? targetMat.targetPercentage : new Decimal(0);
    const existingAmt = existingMat ? existingMat.quantity : new Decimal(0);
    const targetAmt = targetMat ? targetMat.targetFraction.times(finalTargetWeight) : new Decimal(0);

    const diffAmt = targetAmt.minus(existingAmt);
    let reqAddition = diffAmt;

    // Decimal floating-point tolerance check
    if (reqAddition.lt(DEFAULT_TOLERANCE.negated())) {
      isFeasible = false;
      const excessAmt = existingAmt.minus(targetAmt);
      blockingWarnings.push(
        `Excess concentration for '${existingMat ? existingMat.name : targetMat.name}': Existing amount (${existingAmt.toFixed(
          4
        )}) exceeds target required amount (${targetAmt.toFixed(4)}) by ${excessAmt.toFixed(4)}.`
      );
    } else if (reqAddition.abs().lte(DEFAULT_TOLERANCE)) {
      reqAddition = new Decimal(0);
    }

    additions.push({
      material_id: Number(matId),
      material_code: targetMat ? targetMat.code : existingMat.code,
      material_name: targetMat ? targetMat.name : existingMat.name,
      target_percentage: targetPct.toFixed(6),
      existing_amount: existingAmt.toFixed(6),
      target_amount: targetAmt.toFixed(6),
      required_addition: reqAddition.toFixed(6),
      uom: targetMat ? targetMat.uom : existingMat.uom,
      is_negative: reqAddition.lt(0),
    });
  }

  let blockingWarningText = null;
  if (!isFeasible) {
    blockingWarningText =
      'CONVERSION INFEASIBLE: Cannot achieve target perfume concentration by addition alone. Dilution, partial removal, or reformulation is required.\n\n' +
      blockingWarnings.join('\n');
  }

  return {
    mode,
    is_feasible: isFeasible,
    conversion_status: isFeasible ? 'CALCULATED' : 'INFEASIBLE',
    initial_weight: existingTotalWeight.toFixed(6),
    min_feasible_weight: minFeasibleWeight.toFixed(6),
    final_target_weight: finalTargetWeight.toFixed(6),
    blocking_warning_text: blockingWarningText,
    additions,
  };
}

/**
 * Validate and complete a perfume conversion with actual additions
 */
export function completePerfumeConversion(conversionRecord, actualAdditions) {
  if (!conversionRecord.is_feasible) {
    throw new Error('Cannot complete an INFEASIBLE perfume conversion. Reformulation or auto-minimum weight calculation is required.');
  }

  let finalActualWeight = new Decimal(conversionRecord.initial_weight);
  const updatedAdditions = [];

  for (const item of conversionRecord.additions) {
    const actualInput = actualAdditions.find(a => Number(a.material_id) === Number(item.material_id));
    if (!actualInput || actualInput.actual_addition === undefined || actualInput.actual_addition === null) {
      throw new Error(`Actual addition quantity is required for material ID ${item.material_id}`);
    }

    const actualAddDec = new Decimal(actualInput.actual_addition);
    if (actualAddDec.isNegative()) {
      throw new Error(`Actual addition cannot be negative for material ID ${item.material_id}`);
    }

    const reqAddDec = new Decimal(item.required_addition);
    const varianceDec = actualAddDec.minus(reqAddDec);

    finalActualWeight = finalActualWeight.plus(actualAddDec);

    updatedAdditions.push({
      ...item,
      actual_addition: actualAddDec.toFixed(6),
      variance: varianceDec.toFixed(6),
    });
  }

  // Calculate final actual percentage composition snapshot
  const finalCompositionSnapshot = updatedAdditions.map(item => {
    const totalMatAmt = new Decimal(item.existing_amount).plus(new Decimal(item.actual_addition));
    const actualPct = finalActualWeight.gt(0) ? totalMatAmt.div(finalActualWeight).times(100) : new Decimal(0);
    return {
      material_id: item.material_id,
      material_code: item.material_code,
      material_name: item.material_name,
      total_quantity: totalMatAmt.toFixed(6),
      actual_percentage: actualPct.toFixed(6),
      uom: item.uom,
    };
  });

  return {
    actual_final_weight: finalActualWeight.toFixed(6),
    actual_final_composition_snapshot: JSON.stringify(finalCompositionSnapshot),
    updated_additions: updatedAdditions,
    conversion_status: 'COMPLETED',
  };
}
