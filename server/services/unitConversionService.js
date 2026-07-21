import Decimal from 'decimal.js/decimal.js';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export const UOM_CATEGORIES = {
  mg: 'MASS',
  g: 'MASS',
  kg: 'MASS',
  mL: 'VOLUME',
  L: 'VOLUME',
  pieces: 'COUNT',
  capsules: 'COUNT',
  tablets: 'COUNT',
  sachets: 'COUNT',
};

// Mass conversion factors to Base Unit (kg)
const MASS_TO_KG = {
  mg: new Decimal('0.000001'),
  g: new Decimal('0.001'),
  kg: new Decimal('1'),
};

// Volume conversion factors to Base Unit (L)
const VOLUME_TO_L = {
  mL: new Decimal('0.001'),
  L: new Decimal('1'),
};

/**
 * High-precision unit conversion using Decimal.js
 *
 * @param {string|number} value - Amount to convert
 * @param {string} fromUom - Source UOM
 * @param {string} toUom - Target UOM
 * @param {string|number} [densityKgPerL=1.0] - Density in KG/L (Required for MASS <-> VOLUME)
 * @param {string|number} [unitWeightKg=null] - Unit weight in KG (Required for COUNT <-> MASS/VOLUME)
 * @returns {string} Converted value as a high-precision string
 */
export function convertUnit(value, fromUom, toUom, densityKgPerL = '1.000000', unitWeightKg = null) {
  const valDec = new Decimal(value || '0');
  if (valDec.isZero() || fromUom === toUom) {
    return valDec.toFixed(6);
  }

  const fromCat = UOM_CATEGORIES[fromUom];
  const toCat = UOM_CATEGORIES[toUom];

  if (!fromCat || !toCat) {
    throw new Error(`Unsupported UOM conversion: '${fromUom}' to '${toUom}'`);
  }

  // 1. Convert source value to base metric (kg for MASS/COUNT, L for VOLUME)
  let baseKgOrL;
  const density = new Decimal(densityKgPerL || '1.000000');

  if (density.isZero()) {
    throw new Error('Density cannot be zero for weight-to-volume conversion');
  }

  if (fromCat === 'MASS') {
    baseKgOrL = valDec.times(MASS_TO_KG[fromUom]); // In KG
  } else if (fromCat === 'VOLUME') {
    baseKgOrL = valDec.times(VOLUME_TO_L[fromUom]); // In L
  } else if (fromCat === 'COUNT') {
    if (!unitWeightKg) {
      throw new Error(`Unit weight is required to convert COUNT (${fromUom}) to ${toUom}`);
    }
    const unitWt = new Decimal(unitWeightKg);
    baseKgOrL = valDec.times(unitWt); // In KG
  }

  // 2. Perform cross-category conversion (MASS <-> VOLUME) if needed
  let targetBaseKgOrL;
  if (fromCat === toCat) {
    targetBaseKgOrL = baseKgOrL;
  } else if (fromCat === 'MASS' && toCat === 'VOLUME') {
    // Volume (L) = Mass (kg) / Density (kg/L)
    targetBaseKgOrL = baseKgOrL.div(density);
  } else if (fromCat === 'VOLUME' && toCat === 'MASS') {
    // Mass (kg) = Volume (L) * Density (kg/L)
    targetBaseKgOrL = baseKgOrL.times(density);
  } else if (fromCat === 'COUNT' && toCat === 'MASS') {
    targetBaseKgOrL = baseKgOrL; // already in KG
  } else if (fromCat === 'COUNT' && toCat === 'VOLUME') {
    // Mass in KG / Density in KG/L = Volume in L
    targetBaseKgOrL = baseKgOrL.div(density);
  } else if (fromCat === 'MASS' && toCat === 'COUNT') {
    if (!unitWeightKg) {
      throw new Error(`Unit weight is required to convert MASS (${fromUom}) to ${toUom}`);
    }
    const unitWt = new Decimal(unitWeightKg);
    return baseKgOrL.div(unitWt).toFixed(6);
  } else if (fromCat === 'VOLUME' && toCat === 'COUNT') {
    if (!unitWeightKg) {
      throw new Error(`Unit weight is required to convert VOLUME (${fromUom}) to ${toUom}`);
    }
    const massKg = baseKgOrL.times(density);
    const unitWt = new Decimal(unitWeightKg);
    return massKg.div(unitWt).toFixed(6);
  }

  // 3. Convert target base to final target UOM
  if (toCat === 'MASS') {
    return targetBaseKgOrL.div(MASS_TO_KG[toUom]).toFixed(6);
  } else if (toCat === 'VOLUME') {
    return targetBaseKgOrL.div(VOLUME_TO_L[toUom]).toFixed(6);
  } else if (toCat === 'COUNT') {
    if (!unitWeightKg) {
      throw new Error(`Unit weight is required to convert to COUNT (${toUom})`);
    }
    const unitWt = new Decimal(unitWeightKg);
    return targetBaseKgOrL.div(unitWt).toFixed(6);
  }

  return targetBaseKgOrL.toFixed(6);
}
