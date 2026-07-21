import { describe, it, expect } from 'vitest';
import { calculatePerfumeConversion } from '../server/services/perfumeConversionEngine.js';

describe('Perfume Brand Conversion Engine', () => {
  const sampleMixture = {
    actual_total_weight: '50.000000',
    materials: [
      { material_id: 101, name: 'Fragrance Oil', percentage: '4.000000', actual_quantity: '2.000000', uom: 'kg' },
      { material_id: 102, name: 'Ethyl Alcohol', percentage: '76.000000', actual_quantity: '38.000000', uom: 'L' },
      { material_id: 103, name: 'Fixative', percentage: '1.000000', actual_quantity: '0.500000', uom: 'kg' },
      { material_id: 104, name: 'Deionized Water', percentage: '19.000000', actual_quantity: '9.500000', uom: 'kg' },
    ],
  };

  const targetBrandVersionFeasible = {
    materials: [
      { material_id: 101, name: 'Fragrance Oil', percentage: '10.000000', uom: 'kg' }, // target 10%
      { material_id: 102, name: 'Ethyl Alcohol', percentage: '70.000000', uom: 'L' },
      { material_id: 103, name: 'Fixative', percentage: '2.000000', uom: 'kg' },
      { material_id: 104, name: 'Deionized Water', percentage: '18.000000', uom: 'kg' },
    ],
  };

  const targetBrandVersionInfeasible = {
    materials: [
      { material_id: 101, name: 'Fragrance Oil', percentage: '2.000000', uom: 'kg' }, // target 2% < existing 4% (2kg)
      { material_id: 102, name: 'Ethyl Alcohol', percentage: '78.000000', uom: 'L' },
      { material_id: 103, name: 'Fixative', percentage: '1.000000', uom: 'kg' },
      { material_id: 104, name: 'Deionized Water', percentage: '19.000000', uom: 'kg' },
    ],
  };

  it('calculates feasible conversion under Mode A (Fixed Target Weight)', () => {
    const result = calculatePerfumeConversion(sampleMixture, targetBrandVersionFeasible, 'FIXED_TARGET_WEIGHT', '100.000000');
    expect(result.is_feasible).toBe(true);
    expect(result.conversion_status).toBe('CALCULATED');
    expect(result.final_target_weight).toBe('100.000000');

    // Fragrance oil: target 10% of 100kg = 10kg. Existing 2kg. Addition = 8kg.
    const foAdd = result.additions.find(a => a.material_id === 101);
    expect(foAdd.required_addition).toBe('8.000000');
  });

  it('detects infeasible conversion under Mode A when target batch weight causes negative additions', () => {
    const result = calculatePerfumeConversion(sampleMixture, targetBrandVersionInfeasible, 'FIXED_TARGET_WEIGHT', '50.000000');
    expect(result.is_feasible).toBe(false);
    expect(result.conversion_status).toBe('INFEASIBLE');
    expect(result.blocking_warning_text).toContain('CONVERSION INFEASIBLE');
  });

  it('calculates auto minimum final batch weight under Mode B', () => {
    // Mode B: W_min = max(existing_i / target_fraction_i)
    // Fragrance oil: 2kg / 0.10 = 20kg
    // Alcohol: 38kg / 0.70 = 54.285714kg
    // Fixative: 0.5kg / 0.02 = 25kg
    // Water: 9.5kg / 0.18 = 52.777778kg
    // W_min should be ~54.285714 kg
    const result = calculatePerfumeConversion(sampleMixture, targetBrandVersionFeasible, 'AUTO_MINIMUM_FINAL_WEIGHT');
    expect(result.is_feasible).toBe(true);
    expect(Number(result.min_feasible_weight)).toBeGreaterThan(50);
  });

  it('detects infeasibility when source mixture contains a material with 0% target percentage', () => {
    const targetWithMissingMat = {
      materials: [
        { material_id: 101, name: 'Fragrance Oil', percentage: '10.000000', uom: 'kg' },
        { material_id: 102, name: 'Ethyl Alcohol', percentage: '90.000000', uom: 'L' },
        // Fixative (103) is omitted / 0%
      ],
    };

    const result = calculatePerfumeConversion(sampleMixture, targetWithMissingMat, 'AUTO_MINIMUM_FINAL_WEIGHT');
    expect(result.is_feasible).toBe(false);
    expect(result.blocking_warning_text).toContain('0% target concentration');
  });
});
