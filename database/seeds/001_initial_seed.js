import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const bcrypt = require('bcryptjs');

export async function seed(knex) {
  const isMysql = knex.client.config.client.includes('mysql');
  if (isMysql) {
    await knex.raw('SET FOREIGN_KEY_CHECKS = 0;');
  } else {
    await knex.raw('PRAGMA foreign_keys = OFF;');
  }

  // Clear existing records
  await knex('audit_logs').del();
  await knex('system_settings').del();
  await knex('formula_cost_snapshot_items').del();
  await knex('formula_cost_snapshots').del();
  await knex('batch_calculation_items').del();
  await knex('batch_calculations').del();
  await knex('perfume_conversion_additions').del();
  await knex('perfume_conversions').del();
  await knex('perfume_mixture_materials').del();
  await knex('perfume_mixtures').del();
  await knex('formula_workflow_records').del();
  await knex('supplement_serving_details').del();
  await knex('supplement_formula_details').del();
  await knex('perfume_formula_details').del();
  await knex('cosmetic_formula_details').del();
  await knex('formula_instructions').del();
  await knex('formula_version_materials').del();
  await knex('formula_phases').del();
  await knex('formula_versions').del();
  await knex('formulas').del();
  await knex('material_cost_history').del();
  await knex('materials').del();
  await knex('vendors').del();
  await knex('companies').del();
  await knex('refresh_tokens').del();
  await knex('role_permissions').del();
  await knex('user_roles').del();
  await knex('permissions').del();
  await knex('roles').del();
  await knex('users').del();

  // 1. Roles
  const targetRoles = [
    { name: 'Super Admin', description: 'Full System Administration' },
    { name: 'Formulation Chemist', description: 'R&D Formula Creation & Submission' },
    { name: 'Production Supervisor', description: 'Batch Assignment, Monitoring, Deviation Review & Force Unlock' },
    { name: 'Compounding Operator', description: 'Touch-Friendly MES Step Weighing & Batch Execution Only' },
    { name: 'QC Specialist', description: 'Quality Inspection, Parameters Entry & Batch Release' },
    { name: 'Formulator', description: 'Formulator Role' },
    { name: 'Reviewer', description: 'Reviewer Role' },
    { name: 'Approver', description: 'Approver Role' },
    { name: 'Viewer', description: 'Read-only access' },
  ];

  const roleMap = {};
  for (const r of targetRoles) {
    const [id] = await knex('roles').insert(r).then(res => [res[0]]);
    roleMap[r.name] = id;
  }

  // 2. Users
  const passwordHash = await bcrypt.hash('Admin@123456', 10);
  const usersToSeed = [
    { username: 'admin', email: 'admin@nkb.com', first_name: 'Super', last_name: 'Admin', roleName: 'Super Admin' },
    { username: 'chemist1', email: 'chemist1@nkb.com', first_name: 'Elena', last_name: 'Rostova (Maker)', roleName: 'Formulation Chemist' },
    { username: 'chemist2', email: 'chemist2@nkb.com', first_name: 'Marcus', last_name: 'Vance (Checker)', roleName: 'Formulation Chemist' },
    { username: 'supervisor', email: 'supervisor@nkb.com', first_name: 'David', last_name: 'Miller', roleName: 'Production Supervisor' },
    { username: 'operator', email: 'operator@nkb.com', first_name: 'John', last_name: 'Delos Santos', roleName: 'Compounding Operator' },
    { username: 'qc_spec', email: 'qc@nkb.com', first_name: 'Sarah', last_name: 'Jenkins', roleName: 'QC Specialist' },
    { username: 'formulator1', email: 'formulator@nkb.com', first_name: 'Elena', last_name: 'Santos', roleName: 'Formulation Chemist' },
    { username: 'reviewer1', email: 'reviewer@nkb.com', first_name: 'Marcus', last_name: 'Reyes', roleName: 'Production Supervisor' },
    { username: 'approver1', email: 'approver@nkb.com', first_name: 'Dr. Sofia', last_name: 'Cruz', roleName: 'Formulation Chemist' },
  ];

  const userMap = {};
  for (const u of usersToSeed) {
    const [userId] = await knex('users').insert({
      username: u.username,
      email: u.email,
      password_hash: passwordHash,
      first_name: u.first_name,
      last_name: u.last_name,
      is_active: true,
    }).then(res => [res[0]]);
    userMap[u.email] = userId;

    const rId = roleMap[u.roleName] || roleMap['Super Admin'];
    await knex('user_roles').insert({ user_id: userId, role_id: rId });
  }

  const formulatorUserId = userMap['chemist1@nkb.com'] || userMap['formulator@nkb.com'];
  const reviewerUserId = userMap['supervisor@nkb.com'] || userMap['reviewer@nkb.com'];
  const approverUserId = userMap['chemist2@nkb.com'] || userMap['approver@nkb.com'];

  // 3. Companies & Vendors
  const [c1, c2] = await Promise.all([
    knex('companies').insert({ code: 'NKB-LAB', name: 'NKB Laboratories Inc.', contact_person: 'John Doe', email: 'lab@nkb.com', phone: '+63 2 8123 4567' }).then(res => res[0] || 1),
    knex('companies').insert({ code: 'COS-TECH', name: 'CosmeTech Innovations', contact_person: 'Jane Smith', email: 'contact@cosmetech.com' }).then(res => res[0] || 2),
  ]);

  const [v1, v3] = await Promise.all([
    knex('vendors').insert({ code: 'V-CHEM', name: 'Global Chem Supplies', contact_person: 'Robert Chen', email: 'sales@globalchem.com' }).then(res => res[0] || 1),
    knex('vendors').insert({ code: 'V-BIOEXT', name: 'BioExtracts Organics', contact_person: 'David Miller', email: 'dmiller@bioextracts.com' }).then(res => res[0] || 3),
  ]);

  // 4. System Settings
  await knex('system_settings').insert([
    { key: 'percentage_display_decimals', value: '4', description: 'Decimals for displaying percentages' },
    { key: 'quantity_display_decimals', value: '4', description: 'Decimals for displaying material weights/quantities' },
    { key: 'cost_display_decimals', value: '4', description: 'Decimals for displaying financial costs' },
    { key: 'rounding_mode', value: 'ROUND_HALF_UP', description: 'UI display rounding algorithm' },
    { key: 'default_currency', value: 'PHP', description: 'Default system currency code' },
    { key: 'formula_tolerance_pct', value: '0.01', description: 'Tolerance for 100% total formula validation' },
  ]);

  // 5. Seed Cosmetic Raw Materials
  const rawMaterials = [
    { code: 'MAT-WTR-001', name: 'Deionized Water', company_id: c1, vendor_id: v1, uom: 'kg', uom_category: 'MASS', cost: '12.500000', currency_code: 'PHP', density_kg_per_l: '1.000000', specific_gravity: '1.000000', description: 'Pure deionized water', is_inventoried: true },
    { code: 'MAT-GLY-002', name: 'Glycerin USP', company_id: c1, vendor_id: v1, uom: 'kg', uom_category: 'MASS', cost: '185.000000', currency_code: 'PHP', density_kg_per_l: '1.261000', specific_gravity: '1.261000', description: 'Humectant and skin protectant', is_inventoried: true },
    { code: 'MAT-SLES-003', name: 'Sodium Lauryl Ether Sulfate (SLES 70%)', company_id: c2, vendor_id: v1, uom: 'kg', uom_category: 'MASS', cost: '240.000000', currency_code: 'PHP', density_kg_per_l: '1.050000', specific_gravity: '1.050000', description: 'Primary anionic surfactant', is_inventoried: true },
    { code: 'MAT-CAPB-004', name: 'Cocamidopropyl Betaine (CAPB)', company_id: c2, vendor_id: v1, uom: 'kg', uom_category: 'MASS', cost: '210.000000', currency_code: 'PHP', density_kg_per_l: '1.040000', specific_gravity: '1.040000', description: 'Amphoteric secondary surfactant', is_inventoried: true },
    { code: 'MAT-NIAC-005', name: 'Niacinamide (Vitamin B3)', company_id: c1, vendor_id: v3, uom: 'kg', uom_category: 'MASS', cost: '1850.000000', currency_code: 'PHP', density_kg_per_l: '1.200000', specific_gravity: '1.200000', description: 'Brightening active ingredient', is_inventoried: false },
    { code: 'MAT-PHENOX-006', name: 'Phenoxyethanol Preservative', company_id: c1, vendor_id: v1, uom: 'kg', uom_category: 'MASS', cost: '650.000000', currency_code: 'PHP', density_kg_per_l: '1.107000', specific_gravity: '1.107000', description: 'Broad-spectrum preservative', is_inventoried: true },
  ];

  const materialMap = {};
  for (const m of rawMaterials) {
    const [id] = await knex('materials').insert(m).then(res => [res[0]]);
    materialMap[m.code] = id;
  }

  // 6. Seed Cosmetic Formula 1
  const [f1Id] = await knex('formulas').insert({
    code: 'F-COS-001',
    name: 'Gentle Hydrating Facial Cleanser',
    product_category: 'Cosmetic',
    product_subcategory: 'Facial Wash',
    brand_type: 'In-House',
    status: 'ACTIVE',
    owner_id: formulatorUserId,
    department: 'Personal Care R&D',
  }).then(res => [res[0] || 1]);

  const [v1Id] = await knex('formula_versions').insert({
    formula_id: f1Id,
    major_version: 1,
    minor_version: 0,
    lock_version: 0,
    version_status: 'APPROVED',
    change_type: 'INITIAL_RELEASE',
    revision_reason: 'Initial approved formula launch',
    change_summary: 'Baseline gentle cleanser formulation',
    target_batch_size: '100.000000',
    target_batch_uom: 'kg',
    expected_yield: '99.500000',
    shelf_life: '24 Months',
    storage_condition: 'Store in cool dry place below 30°C',
    created_by: formulatorUserId,
    reviewed_by: reviewerUserId,
    approved_by: approverUserId,
    effective_date: knex.fn.now(),
    approval_timestamp: knex.fn.now(),
  }).then(res => [res[0] || 1]);

  const [phaseA1] = await knex('formula_phases').insert({ version_id: v1Id, phase_name: 'Phase A - Water Phase', phase_order: 1 }).then(res => [res[0] || 1]);
  const [phaseB1] = await knex('formula_phases').insert({ version_id: v1Id, phase_name: 'Phase B - Surfactant Phase', phase_order: 2 }).then(res => [res[0] || 2]);
  const [phaseC1] = await knex('formula_phases').insert({ version_id: v1Id, phase_name: 'Cooling Phase', phase_order: 3 }).then(res => [res[0] || 3]);

  const f1Materials = [
    { version_id: v1Id, phase_id: phaseA1, material_id: materialMap['MAT-WTR-001'], material_code_snapshot: 'MAT-WTR-001', material_name_snapshot: 'Deionized Water', uom_snapshot: 'kg', percentage: '65.000000', calculated_quantity: '65.000000', addition_order: 1, temp_c: 75, mixing_speed_rpm: 300, duration_min: 15, line_cost: '812.500000', function_name: 'Solvent Base' },
    { version_id: v1Id, phase_id: phaseA1, material_id: materialMap['MAT-GLY-002'], material_code_snapshot: 'MAT-GLY-002', material_name_snapshot: 'Glycerin USP', uom_snapshot: 'kg', percentage: '5.000000', calculated_quantity: '5.000000', addition_order: 2, temp_c: 75, mixing_speed_rpm: 400, duration_min: 10, line_cost: '925.000000', function_name: 'Humectant' },
    { version_id: v1Id, phase_id: phaseB1, material_id: materialMap['MAT-SLES-003'], material_code_snapshot: 'MAT-SLES-003', material_name_snapshot: 'Sodium Lauryl Ether Sulfate (SLES 70%)', uom_snapshot: 'kg', percentage: '18.000000', calculated_quantity: '18.000000', addition_order: 3, temp_c: 60, mixing_speed_rpm: 600, duration_min: 25, line_cost: '4320.000000', function_name: 'Primary Surfactant' },
    { version_id: v1Id, phase_id: phaseB1, material_id: materialMap['MAT-CAPB-004'], material_code_snapshot: 'MAT-CAPB-004', material_name_snapshot: 'Cocamidopropyl Betaine (CAPB)', uom_snapshot: 'kg', percentage: '9.500000', calculated_quantity: '9.500000', addition_order: 4, temp_c: 50, mixing_speed_rpm: 500, duration_min: 20, line_cost: '1995.000000', function_name: 'Co-Surfactant' },
    { version_id: v1Id, phase_id: phaseC1, material_id: materialMap['MAT-NIAC-005'], material_code_snapshot: 'MAT-NIAC-005', material_name_snapshot: 'Niacinamide (Vitamin B3)', uom_snapshot: 'kg', percentage: '1.500000', calculated_quantity: '1.500000', addition_order: 5, temp_c: 40, mixing_speed_rpm: 400, duration_min: 15, line_cost: '2775.000000', function_name: 'Skin Brightening Active' },
    { version_id: v1Id, phase_id: phaseC1, material_id: materialMap['MAT-PHENOX-006'], material_code_snapshot: 'MAT-PHENOX-006', material_name_snapshot: 'Phenoxyethanol Preservative', uom_snapshot: 'kg', percentage: '1.000000', calculated_quantity: '1.000000', addition_order: 6, temp_c: 35, mixing_speed_rpm: 350, duration_min: 10, line_cost: '650.000000', function_name: 'Preservative' },
  ];

  for (const m of f1Materials) {
    await knex('formula_version_materials').insert(m);
  }

  await knex('cosmetic_formula_details').insert({
    version_id: v1Id,
    target_ph: '5.50 - 6.00',
    viscosity_cp: '4500 - 6000 cP',
    appearance: 'Clear gel liquid',
    color: 'Water clear',
    odor: 'Clean subtle characteristic',
    texture: 'Smooth viscous gel',
    preservative_system: 'Phenoxyethanol 1.0%',
    manufacturing_conditions: 'Standard stainless steel jacketed vessel with propeller mixer',
  });

  // Seed Cosmetic Formula 2
  const [f2Id] = await knex('formulas').insert({
    code: 'F-COS-002',
    name: 'Niacinamide 10% Soothing Serum',
    product_category: 'Cosmetic',
    product_subcategory: 'Facial Serum',
    brand_type: 'In-House',
    status: 'ACTIVE',
    owner_id: formulatorUserId,
    department: 'Personal Care R&D',
  }).then(res => [res[0] || 2]);

  const [v2Id] = await knex('formula_versions').insert({
    formula_id: f2Id,
    major_version: 1,
    minor_version: 0,
    lock_version: 0,
    version_status: 'APPROVED',
    change_type: 'INITIAL_RELEASE',
    revision_reason: 'Soothing serum release',
    target_batch_size: '50.000000',
    target_batch_uom: 'kg',
    created_by: formulatorUserId,
    reviewed_by: reviewerUserId,
    approved_by: approverUserId,
    effective_date: knex.fn.now(),
    approval_timestamp: knex.fn.now(),
  }).then(res => [res[0] || 2]);

  const [phaseA2] = await knex('formula_phases').insert({ version_id: v2Id, phase_name: 'Phase A - Water Phase', phase_order: 1 }).then(res => [res[0] || 4]);

  await knex('formula_version_materials').insert([
    { version_id: v2Id, phase_id: phaseA2, material_id: materialMap['MAT-WTR-001'], material_code_snapshot: 'MAT-WTR-001', material_name_snapshot: 'Deionized Water', uom_snapshot: 'kg', percentage: '84.000000', calculated_quantity: '42.000000', addition_order: 1, line_cost: '525.000000', function_name: 'Solvent' },
    { version_id: v2Id, phase_id: phaseA2, material_id: materialMap['MAT-NIAC-005'], material_code_snapshot: 'MAT-NIAC-005', material_name_snapshot: 'Niacinamide (Vitamin B3)', uom_snapshot: 'kg', percentage: '10.000000', calculated_quantity: '5.000000', addition_order: 2, line_cost: '9250.000000', function_name: 'Active' },
    { version_id: v2Id, phase_id: phaseA2, material_id: materialMap['MAT-GLY-002'], material_code_snapshot: 'MAT-GLY-002', material_name_snapshot: 'Glycerin USP', uom_snapshot: 'kg', percentage: '5.000000', calculated_quantity: '2.500000', addition_order: 3, line_cost: '462.500000', function_name: 'Humectant' },
    { version_id: v2Id, phase_id: phaseA2, material_id: materialMap['MAT-PHENOX-006'], material_code_snapshot: 'MAT-PHENOX-006', material_name_snapshot: 'Phenoxyethanol Preservative', uom_snapshot: 'kg', percentage: '1.000000', calculated_quantity: '0.500000', addition_order: 4, line_cost: '325.000000', function_name: 'Preservative' },
  ]);

  await knex('cosmetic_formula_details').insert({
    version_id: v2Id,
    target_ph: '5.00 - 5.50',
    viscosity_cp: '1000 - 1500 cP',
    appearance: 'Clear fluid liquid',
    color: 'Colorless',
  });

  if (isMysql) {
    await knex.raw('SET FOREIGN_KEY_CHECKS = 1;');
  } else {
    await knex.raw('PRAGMA foreign_keys = ON;');
  }

  console.log('✅ Initial Seed completed (Cosmetic Formulation Focus)!');
}
