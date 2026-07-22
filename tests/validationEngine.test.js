import { describe, it, expect } from 'vitest';
import { validateFormulaPercentage, assertVersionIsMutable, validateWorkflowTransition } from '../server/services/validationEngine.js';

describe('Validation Engine', () => {
  it('validates 100.000000% formula percentage total within tolerance', () => {
    const materials = [
      { material_id: 1, percentage: '65.000000' },
      { material_id: 2, percentage: '25.000000' },
      { material_id: 3, percentage: '10.000000' },
    ];

    const result = validateFormulaPercentage(materials, '0.010000');
    expect(result.isValid).toBe(true);
    expect(result.totalPct).toBe('100.000000');
  });

  it('rejects formula percentage total that deviates from 100%', () => {
    const materials = [
      { material_id: 1, percentage: '65.000000' },
      { material_id: 2, percentage: '20.000000' },
    ];

    const result = validateFormulaPercentage(materials, '0.010000');
    expect(result.isValid).toBe(false);
    expect(result.totalPct).toBe('85.000000');
  });

  it('rejects duplicate materials in formula composition', () => {
    const materials = [
      { material_id: 1, percentage: '50.000000' },
      { material_id: 1, percentage: '50.000000' },
    ];

    const result = validateFormulaPercentage(materials);
    expect(result.isValid).toBe(false);
    expect(result.message).toContain('Duplicate material ID');
  });

  it('asserts immutability of APPROVED versions', () => {
    const approvedVersion = { major_version: 1, minor_version: 0, version_status: 'APPROVED' };
    expect(() => assertVersionIsMutable(approvedVersion)).toThrow(/locked as read-only/i);
  });

  it('validates role-based workflow state transitions', () => {
    const userRoles = ['Formulator'];
    expect(() => validateWorkflowTransition('DRAFT', 'UNDER_REVIEW', userRoles, 'SUBMIT')).not.toThrow();
    expect(() => validateWorkflowTransition('DRAFT', 'APPROVED', userRoles, 'APPROVE')).toThrow(/Invalid status transition/i);
  });
});
