import Decimal from 'decimal.js/decimal.js';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export const WORKFLOW_TRANSITIONS = {
  DRAFT: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['DRAFT', 'FOR_APPROVAL'],
  FOR_APPROVAL: ['APPROVED', 'REJECTED'],
  APPROVED: ['SUPERSEDED'],
  REJECTED: [],
  SUPERSEDED: [],
};

export const ROLE_WORKFLOW_PERMISSIONS = {
  SUBMIT: ['Super Admin', 'Formulation Chemist', 'Formulator'],
  RETURN: ['Super Admin', 'Production Supervisor', 'Reviewer', 'Formulation Chemist'],
  ENDORSE: ['Super Admin', 'Production Supervisor', 'Reviewer', 'Formulation Chemist'],
  APPROVE: ['Super Admin', 'Formulation Chemist', 'Approver', 'Production Supervisor'],
  REJECT: ['Super Admin', 'Formulation Chemist', 'Approver', 'Production Supervisor'],
};

/**
 * Validate that formula composition materials sum to 100.000000% within tolerance
 *
 * @param {Array} materials - List of version materials with `percentage` property
 * @param {string|number} tolerance - Configured tolerance e.g. 0.01%
 */
export function validateFormulaPercentage(materials, tolerance = '0.010000') {
  if (!materials || materials.length === 0) {
    return { isValid: false, totalPct: '0.000000', message: 'Formula contains no material composition lines' };
  }

  let sum = new Decimal(0);

  for (const item of materials) {
    const pct = new Decimal(item.percentage || '0');
    if (pct.isNegative()) {
      return { isValid: false, totalPct: sum.toFixed(6), message: `Material ${item.material_name_snapshot || item.material_id} has negative percentage (${pct.toFixed(6)}%)` };
    }

    sum = sum.plus(pct);
  }

  const target = new Decimal('100.000000');
  const diff = sum.minus(target).abs();
  const tol = new Decimal(tolerance);

  const isValid = diff.lte(tol);
  const totalPctStr = sum.toFixed(6);

  if (!isValid) {
    return {
      isValid: false,
      totalPct: totalPctStr,
      message: `Total formula percentage is ${totalPctStr}%, which deviates from 100.00% beyond tolerance ±${tol.toFixed(6)}%`,
    };
  }

  return { isValid: true, totalPct: totalPctStr, message: 'Percentage validation successful (100.000000%)' };
}

/**
 * Verify formula version immutability before edit/update
 *
 * @param {object} version - Formula version database record
 */
export function assertVersionIsMutable(version) {
  if (!version) {
    throw new Error('Formula version not found');
  }

  if (version.version_status === 'APPROVED' || version.version_status === 'SUPERSEDED' || version.version_status === 'REJECTED' || version.version_status === 'LOCKED') {
    throw new Error(
      `Formula Version ${version.major_version}.${version.minor_version} is ${version.version_status} and locked as read-only. Create a new draft revision to modify.`
    );
  }
}

/**
 * Validate workflow transition rules and user roles
 */
export function validateWorkflowTransition(currentStatus, targetStatus, userRoles = [], action) {
  const allowedNextStatuses = WORKFLOW_TRANSITIONS[currentStatus] || [];
  if (!allowedNextStatuses.includes(targetStatus)) {
    throw new Error(`Invalid status transition from ${currentStatus} to ${targetStatus}`);
  }

  const requiredRoles = ROLE_WORKFLOW_PERMISSIONS[action];
  if (requiredRoles && userRoles.length > 0) {
    const hasRole = userRoles.some(r => requiredRoles.includes(r));
    if (!hasRole) {
      throw new Error(`User role does not have permission to execute '${action}' action (Requires: ${requiredRoles.join(', ')})`);
    }
  }
}
