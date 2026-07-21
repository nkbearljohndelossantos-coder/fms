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
  SUBMIT: ['Super Admin', 'Formulator'],
  RETURN: ['Super Admin', 'Reviewer'],
  ENDORSE: ['Super Admin', 'Reviewer'],
  APPROVE: ['Super Admin', 'Approver'],
  REJECT: ['Super Admin', 'Approver'],
};

/**
 * Validate that formula composition materials sum to 100.000000% within tolerance
 *
 * @param {Array} materials - List of version materials with `percentage` property
 * @param {string|number} tolerance - Configured tolerance e.g. 0.01%
 */
export function validateFormulaPercentage(materials, tolerance = '0.01') {
  if (!materials || materials.length === 0) {
    return { isValid: false, totalPct: '0.00', message: 'Formula contains no material composition lines' };
  }

  let sum = new Decimal(0);
  const seenMaterialIds = new Set();

  for (const item of materials) {
    const pct = new Decimal(item.percentage || '0');
    if (pct.isNegative()) {
      return { isValid: false, totalPct: sum.toFixed(2), message: `Material ${item.material_name_snapshot || item.material_id} has negative percentage (${pct.toFixed(2)}%)` };
    }

    if (seenMaterialIds.has(item.material_id)) {
      return { isValid: false, totalPct: sum.toFixed(2), message: `Duplicate material ID ${item.material_id} found in formula composition` };
    }
    seenMaterialIds.add(item.material_id);

    sum = sum.plus(pct);
  }

  const target = new Decimal('100.00');
  const diff = sum.minus(target).abs();
  const tol = new Decimal(tolerance);

  const isValid = diff.lte(tol);
  const totalPctStr = sum.toFixed(2);

  if (!isValid) {
    return {
      isValid: false,
      totalPct: totalPctStr,
      message: `Total formula percentage is ${totalPctStr}%, which deviates from 100.00% beyond tolerance ±${tol.toFixed(2)}%`,
    };
  }

  return { isValid: true, totalPct: totalPctStr, message: 'Percentage validation successful (100.00%)' };
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

  if (version.version_status === 'APPROVED' || version.version_status === 'SUPERSEDED' || version.version_status === 'REJECTED') {
    throw new Error(
      `Formula Version ${version.major_version}.${version.minor_version} is ${version.version_status} and locked as read-only. Create a new draft revision to modify.`
    );
  }
}

/**
 * Validate workflow transition rules and user roles
 */
export function validateWorkflowTransition(currentStatus, targetStatus, userRoles, action) {
  const allowedNextStatuses = WORKFLOW_TRANSITIONS[currentStatus] || [];
  if (!allowedNextStatuses.includes(targetStatus)) {
    throw new Error(`Invalid status transition from ${currentStatus} to ${targetStatus}`);
  }

  const requiredRoles = ROLE_WORKFLOW_PERMISSIONS[action];
  if (requiredRoles) {
    const hasRole = userRoles.some(r => requiredRoles.includes(r));
    if (!hasRole) {
      throw new Error(`User role does not have permission to execute '${action}' action (Requires: ${requiredRoles.join(', ')})`);
    }
  }
}
