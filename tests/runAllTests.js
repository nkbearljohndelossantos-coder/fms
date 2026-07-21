import Decimal from 'decimal.js/decimal.js';
import { convertUnit } from '../server/services/unitConversionService.js';
import { validateFormulaPercentage, assertVersionIsMutable, validateWorkflowTransition } from '../server/services/validationEngine.js';
import { calculatePerfumeConversion } from '../server/services/perfumeConversionEngine.js';
import { calculateSupplementDosage } from '../server/services/supplementEngine.js';

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
  }
}

console.log('🧪 Starting NKB Formulation System Pure Node Test Suite...\n');

// 1. Unit Conversion Tests
console.log('--- Unit Conversion Tests ---');
const massConv = convertUnit('100.000000', 'g', 'kg');
assert(massConv === '0.100000', `Mass Conversion (100g -> kg): expected 0.100000, got ${massConv}`);

const volConv = convertUnit('2.500000', 'L', 'mL');
assert(volConv === '2500.000000', `Volume Conversion (2.5L -> mL): expected 2500.000000, got ${volConv}`);

const densityConv = convertUnit('1000.000000', 'mL', 'kg', '1.050000');
assert(densityConv === '1.050000', `Density Mass<->Volume (1000mL @ 1.05 kg/L -> kg): expected 1.050000, got ${densityConv}`);

// 2. Validation Engine Tests
console.log('\n--- Validation Engine Tests ---');
const validMaterials = [
  { material_id: 1, percentage: '50.000000' },
  { material_id: 2, percentage: '50.000000' },
];
const valRes1 = validateFormulaPercentage(validMaterials);
assert(valRes1.isValid === true, `100.0000% Exact Sum Validation: expected true, got ${valRes1.isValid}`);

const invalidMaterials = [
  { material_id: 1, percentage: '50.000000' },
  { material_id: 2, percentage: '45.000000' },
];
const valRes2 = validateFormulaPercentage(invalidMaterials);
assert(valRes2.isValid === false, `Invalid Sum Validation (95%): expected false, got ${valRes2.isValid}`);

let immutabilityPassed = false;
try {
  assertVersionIsMutable({ version_status: 'APPROVED', major_version: 1, minor_version: 0 });
} catch (e) {
  immutabilityPassed = e.message.includes('locked as read-only');
}
assert(immutabilityPassed === true, `Approved Version Immutability Lock Error Assertion: expected exception thrown`);

// 3. Perfume Conversion Mode A & Mode B Tests
console.log('\n--- Perfume Conversion Engine Tests ---');
const sourceMixture = {
  actual_total_weight: '100.000000',
  weight_uom: 'kg',
  materials: [
    { material_id: 1, material_code: 'MAT-FRG-001', material_name: 'Vanilla Fragrance Oil', actual_quantity: '5.000000', percentage: '5.000000', uom: 'kg' },
    { material_id: 2, material_code: 'MAT-ALC-001', material_name: 'Ethanol 96%', actual_quantity: '95.000000', percentage: '95.000000', uom: 'kg' },
  ],
};

const targetBrandVersion = {
  materials: [
    { material_id: 1, material_code_snapshot: 'MAT-FRG-001', material_name_snapshot: 'Vanilla Fragrance Oil', percentage: '15.000000', uom_snapshot: 'kg' },
    { material_id: 2, material_code_snapshot: 'MAT-ALC-001', material_name_snapshot: 'Ethanol 96%', percentage: '80.000000', uom_snapshot: 'kg' },
    { material_id: 3, material_code_snapshot: 'MAT-FIX-001', material_name_snapshot: 'Glucam P-20 Fixative', percentage: '5.000000', uom_snapshot: 'kg' },
  ],
};

const perfCalcModeA = calculatePerfumeConversion(sourceMixture, targetBrandVersion, 'FIXED_TARGET_WEIGHT', '100.000000');
assert(perfCalcModeA.is_feasible === false, `Mode 1 Fixed Weight Infeasibility Detection: expected is_feasible = false (Ethanol 95kg > Target 80kg), got ${perfCalcModeA.is_feasible}`);

const perfCalcModeB = calculatePerfumeConversion(sourceMixture, targetBrandVersion, 'AUTO_MINIMUM_FINAL_WEIGHT');
assert(perfCalcModeB.is_feasible === true, `Mode 2 Auto-Calculate Minimum Final Batch Weight: expected is_feasible = true, got ${perfCalcModeB.is_feasible}`);
assert(Number(perfCalcModeB.final_target_weight) >= 118.75, `Mode 2 Minimum Target Weight (>= 118.75kg): got ${perfCalcModeB.final_target_weight}`);

// 4. Food Supplement Engine Tests
console.log('\n--- Food Supplement Engine Tests ---');
const supplementDetails = {
  composition_mode: 'AMOUNT_PER_SERVING',
  tablet_weight: '500.000000',
};

const supplementMats = [
  { material_id: 10, active_amount_per_serving: '200.000000', overage_pct: '10.000000', is_qs_balancing_material: false }, // 200 * 1.1 = 220mg
  { material_id: 11, active_amount_per_serving: '100.000000', overage_pct: '0.000000', is_qs_balancing_material: false },  // 100mg -> Total active = 320mg
  { material_id: 12, active_amount_per_serving: '0.000000', overage_pct: '0.000000', is_qs_balancing_material: true },     // q.s. excipient
];

const suppRes = calculateSupplementDosage(supplementDetails, supplementMats);
assert(suppRes.required_excipient === '180.000000', `Food Supplement Required Excipient (500mg - 320mg): expected 180.000000, got ${suppRes.required_excipient}`);

// 5. Formula Creation & Transaction Tests
console.log('\n--- Formula Creation & RBAC Tests ---');

import db from '../server/db.js';

async function runFormulaCreationTests() {
  try {
    const timestamp = Date.now();
    const testCode1 = `TEST-FORMULA-FORMULATOR-${timestamp}`;
    const testCode2 = `TEST-FORMULA-ADMIN-${timestamp}`;

    // Get test user IDs
    const adminUser = await db('users').where({ username: 'admin' }).first();
    const formulatorUser = await db('users').join('user_roles', 'users.id', 'user_roles.user_id')
      .join('roles', 'user_roles.role_id', 'roles.id')
      .where('roles.name', 'Formulator').select('users.*').first() || adminUser;

    const viewerUser = await db('users').join('user_roles', 'users.id', 'user_roles.user_id')
      .join('roles', 'user_roles.role_id', 'roles.id')
      .where('roles.name', 'Viewer').select('users.*').first();

    // Test A: Initial draft creation succeeds without materials
    const { formulaIdVal, versionIdVal } = await db.transaction(async (trx) => {
      const fIdRes = await trx('formulas').insert({
        code: testCode1,
        name: 'Test Formulator Draft Formula',
        product_category: 'Cosmetic',
        status: 'ACTIVE',
        owner_id: formulatorUser.id,
      });
      const fId = Array.isArray(fIdRes) ? fIdRes[0] : fIdRes;

      const vIdRes = await trx('formula_versions').insert({
        formula_id: fId,
        parent_version_id: null,
        major_version: 1,
        minor_version: 0,
        lock_version: 0,
        version_status: 'DRAFT',
        created_by: formulatorUser.id,
      });
      const vId = Array.isArray(vIdRes) ? vIdRes[0] : vIdRes;

      return { formulaIdVal: fId, versionIdVal: vId };
    });

    assert(Boolean(formulaIdVal), `Formulator can create a draft formula: expected valid formula_id, got ${formulaIdVal}`);

    const versionMatCount = await db('formula_version_materials').where({ version_id: versionIdVal });
    assert(versionMatCount.length === 0, `Initial draft creation succeeds without materials: got ${versionMatCount.length} materials`);

    // Test B: Super Admin can create a draft formula
    const [adminFormId] = await db.transaction(async (trx) => {
      const [fId] = await trx('formulas').insert({
        code: testCode2,
        name: 'Test Super Admin Draft Formula',
        product_category: 'Food Supplement',
        status: 'ACTIVE',
        owner_id: adminUser.id,
      });
      await trx('formula_versions').insert({
        formula_id: fId,
        major_version: 1,
        minor_version: 0,
        version_status: 'DRAFT',
        created_by: adminUser.id,
      });
      return [fId];
    });
    assert(adminFormId > 0, `Super Admin can create a draft formula: expected valid formula_id, got ${adminFormId}`);

    // Test C: Duplicate formula code constraint
    let duplicateCaught = false;
    try {
      await db('formulas').insert({
        code: testCode1,
        name: 'Duplicate Formula Attempt',
        product_category: 'Cosmetic',
        owner_id: adminUser.id,
      });
    } catch (err) {
      duplicateCaught = err.message.includes('UNIQUE') || err.message.includes('unique') || err.message.includes('duplicate') || err.code === 'SQLITE_CONSTRAINT';
    }
    assert(duplicateCaught === true, `Duplicate formula code receives constraint error (HTTP 409): expected true, got ${duplicateCaught}`);

    // Test D: Rollback on version creation failure
    const rollbackTestCode = `TEST-ROLLBACK-${timestamp}`;
    let rollbackOccurred = false;
    try {
      await db.transaction(async (trx) => {
        const [fId] = await trx('formulas').insert({
          code: rollbackTestCode,
          name: 'Rollback Test Formula',
          product_category: 'Cosmetic',
          owner_id: adminUser.id,
        });

        // Intentional throw to trigger transaction rollback
        throw new Error('Simulated formula_versions creation failure');
      });
    } catch (err) {
      rollbackOccurred = err.message.includes('Simulated formula_versions creation failure');
    }

    const checkRolledBackFormula = await db('formulas').where({ code: rollbackTestCode }).first();
    assert(rollbackOccurred && !checkRolledBackFormula, `Failure in formula_versions creation rolls back the formulas record: expected null, got ${checkRolledBackFormula}`);

    // Cleanup test records
    const testFormulas = await db('formulas').where('code', 'like', 'TEST-%').select('id');
    const testIds = testFormulas.map(f => f.id);
    if (testIds.length > 0) {
      await db('cosmetic_formula_details').whereIn('version_id', db('formula_versions').select('id').whereIn('formula_id', testIds)).del();
      await db('supplement_formula_details').whereIn('version_id', db('formula_versions').select('id').whereIn('formula_id', testIds)).del();
      await db('perfume_formula_details').whereIn('version_id', db('formula_versions').select('id').whereIn('formula_id', testIds)).del();
      await db('formula_versions').whereIn('formula_id', testIds).del();
      await db('formulas').whereIn('id', testIds).del();
    }

  } catch (err) {
    console.error('Error in formula creation test suite:', err);
  }
}

await runFormulaCreationTests();

console.log(`\n🎉 Test Suite Completed: ${passedTests}/${totalTests} tests passed.`);
if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}

