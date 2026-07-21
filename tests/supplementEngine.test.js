import { describe, it, expect } from 'vitest';
import { calculateSupplementDosage } from '../server/services/supplementEngine.js';

describe('Food Supplement Dosage & Excipient Engine', () => {
  const supplementDetails = {
    composition_mode: 'AMOUNT_PER_SERVING',
    tablet_weight: '500.000000',
    tablet_weight_uom: 'mg',
  };

  it('calculates active amounts with overage and required excipient weight', () => {
    // Vit C (300mg + 5% overage = 315mg)
    // Zinc (10mg + 10% overage = 11mg)
    // Excipient MCC q.s. = 500 - 315 - 11 = 174mg
    const materials = [
      { material_id: 1, material_name_snapshot: 'Vitamin C', active_amount_per_serving: '300.000000', overage_pct: '5.000000' },
      { material_id: 2, material_name_snapshot: 'Zinc Gluconate', active_amount_per_serving: '10.000000', overage_pct: '10.000000' },
      { material_id: 3, material_name_snapshot: 'MCC Filler', is_qs_balancing_material: true },
    ];

    const result = calculateSupplementDosage(supplementDetails, materials);
    expect(result.total_active_with_overage).toBe('326.000000');
    expect(result.required_excipient).toBe('174.000000');
  });

  it('blocks calculation when active ingredients exceed target unit weight', () => {
    const excessiveMaterials = [
      { material_id: 1, material_name_snapshot: 'Vitamin C', active_amount_per_serving: '500.000000', overage_pct: '10.000000' }, // 550mg > 500mg
    ];

    expect(() => calculateSupplementDosage(supplementDetails, excessiveMaterials)).toThrow(/exceed target unit weight/i);
  });
});
