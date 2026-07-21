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
  const [adminRoleId, formulatorRoleId, reviewerRoleId, approverRoleId, viewerRoleId] = await Promise.all([
    knex('roles').insert({ name: 'Super Admin', description: 'Full system control and administration' }).then(res => res[0] || 1),
    knex('roles').insert({ name: 'Formulator', description: 'Can create and edit draft formulas' }).then(res => res[0] || 2),
    knex('roles').insert({ name: 'Reviewer', description: 'Can review and return/endorse formulas' }).then(res => res[0] || 3),
    knex('roles').insert({ name: 'Approver', description: 'Can approve or reject submitted formulas' }).then(res => res[0] || 4),
    knex('roles').insert({ name: 'Viewer', description: 'Read-only access to formulas and reports' }).then(res => res[0] || 5),
  ]);

  // 2. Permissions
  const permissionKeys = [
    { name: 'Manage System Settings', key: 'settings:manage' },
    { name: 'Manage Users & Roles', key: 'users:manage' },
    { name: 'View Materials', key: 'materials:view' },
    { name: 'Manage Materials', key: 'materials:manage' },
    { name: 'View Formulas', key: 'formulas:view' },
    { name: 'Create/Edit Formulas', key: 'formulas:manage' },
    { name: 'Submit Formula Review', key: 'formulas:submit' },
    { name: 'Review Formulas', key: 'formulas:review' },
    { name: 'Approve Formulas', key: 'formulas:approve' },
    { name: 'Calculate Batches', key: 'batch:calculate' },
    { name: 'Perform Perfume Conversions', key: 'perfume:convert' },
    { name: 'Export Reports', key: 'reports:export' },
    { name: 'View Audit Logs', key: 'audit:view' },
  ];

  const permissionIds = [];
  for (const p of permissionKeys) {
    const id = await knex('permissions').insert(p).then(res => res[0] || permissionIds.length + 1);
    permissionIds.push(id);
  }

  // Grant all permissions to Super Admin role
  for (const permId of permissionIds) {
    await knex('role_permissions').insert({ role_id: adminRoleId, permission_id: permId });
  }

  // 3. Super Admin User
  const passwordHash = await bcrypt.hash('Admin@123456', 10);
  const [adminUserId] = await knex('users').insert({
    username: 'admin',
    email: 'admin@nkb.com',
    password_hash: passwordHash,
    first_name: 'Super',
    last_name: 'Admin',
    is_active: true,
  }).then(res => [res[0] || 1]);

  await knex('user_roles').insert({ user_id: adminUserId, role_id: adminRoleId });

  // Additional Seed Users
  const formulatorHash = await bcrypt.hash('Formulator@123', 10);
  const [formulatorUserId] = await knex('users').insert({
    username: 'formulator1',
    email: 'formulator@nkb.com',
    password_hash: formulatorHash,
    first_name: 'Elena',
    last_name: 'Santos',
    is_active: true,
  }).then(res => [res[0] || 2]);
  await knex('user_roles').insert({ user_id: formulatorUserId, role_id: formulatorRoleId });

  const reviewerHash = await bcrypt.hash('Reviewer@123', 10);
  const [reviewerUserId] = await knex('users').insert({
    username: 'reviewer1',
    email: 'reviewer@nkb.com',
    password_hash: reviewerHash,
    first_name: 'Marcus',
    last_name: 'Reyes',
    is_active: true,
  }).then(res => [res[0] || 3]);
  await knex('user_roles').insert({ user_id: reviewerUserId, role_id: reviewerRoleId });

  const approverHash = await bcrypt.hash('Approver@123', 10);
  const [approverUserId] = await knex('users').insert({
    username: 'approver1',
    email: 'approver@nkb.com',
    password_hash: approverHash,
    first_name: 'Dr. Sofia',
    last_name: 'Cruz',
    is_active: true,
  }).then(res => [res[0] || 4]);
  await knex('user_roles').insert({ user_id: approverUserId, role_id: approverRoleId });

  // 4. Companies & Vendors
  const [c1, c2, c3] = await Promise.all([
    knex('companies').insert({ code: 'NKB-LAB', name: 'NKB Laboratories Inc.', contact_person: 'John Doe', email: 'lab@nkb.com', phone: '+63 2 8123 4567' }).then(res => res[0] || 1),
    knex('companies').insert({ code: 'COS-TECH', name: 'CosmeTech Innovations', contact_person: 'Jane Smith', email: 'contact@cosmetech.com' }).then(res => res[0] || 2),
    knex('companies').insert({ code: 'NUTRI-GLO', name: 'NutriPharm Global', contact_person: 'Alan Vance', email: 'info@nutripharm.com' }).then(res => res[0] || 3),
  ]);

  const [v1, v2, v3] = await Promise.all([
    knex('vendors').insert({ code: 'V-CHEM', name: 'Global Chem Supplies', contact_person: 'Robert Chen', email: 'sales@globalchem.com' }).then(res => res[0] || 1),
    knex('vendors').insert({ code: 'V-ESSENCE', name: 'Aroma Essence Ltd', contact_person: 'Claire Dupont', email: 'claire@aromaessence.fr' }).then(res => res[0] || 2),
    knex('vendors').insert({ code: 'V-BIOEXT', name: 'BioExtracts Organics', contact_person: 'David Miller', email: 'dmiller@bioextracts.com' }).then(res => res[0] || 3),
  ]);

  // 5. System Settings
  await knex('system_settings').insert([
    { key: 'percentage_display_decimals', value: '4', description: 'Decimals for displaying percentages' },
    { key: 'quantity_display_decimals', value: '4', description: 'Decimals for displaying material weights/quantities' },
    { key: 'cost_display_decimals', value: '4', description: 'Decimals for displaying financial costs' },
    { key: 'rounding_mode', value: 'ROUND_HALF_UP', description: 'UI display rounding algorithm' },
    { key: 'default_currency', value: 'PHP', description: 'Default system currency code' },
    { key: 'formula_tolerance_pct', value: '0.01', description: 'Tolerance for 100% total formula validation' },
  ]);

  // 6. Seed Materials
  const rawMaterials = [
    // Cosmetic & General
    { code: 'MAT-WTR-001', name: 'Deionized Water', company_id: c1, vendor_id: v1, uom: 'kg', uom_category: 'MASS', cost: '12.500000', currency_code: 'PHP', density_kg_per_l: '1.000000', specific_gravity: '1.000000', description: 'Pure deionized water', is_inventoried: true },
    { code: 'MAT-GLY-002', name: 'Glycerin USP', company_id: c1, vendor_id: v1, uom: 'kg', uom_category: 'MASS', cost: '185.000000', currency_code: 'PHP', density_kg_per_l: '1.261000', specific_gravity: '1.261000', description: 'Humectant and skin protectant', is_inventoried: true },
    { code: 'MAT-SLES-003', name: 'Sodium Lauryl Ether Sulfate (SLES 70%)', company_id: c2, vendor_id: v1, uom: 'kg', uom_category: 'MASS', cost: '240.000000', currency_code: 'PHP', density_kg_per_l: '1.050000', specific_gravity: '1.050000', description: 'Primary anionic surfactant', is_inventoried: true },
    { code: 'MAT-CAPB-004', name: 'Cocamidopropyl Betaine (CAPB)', company_id: c2, vendor_id: v1, uom: 'kg', uom_category: 'MASS', cost: '210.000000', currency_code: 'PHP', density_kg_per_l: '1.040000', specific_gravity: '1.040000', description: 'Amphoteric secondary surfactant', is_inventoried: true },
    { code: 'MAT-NIAC-005', name: 'Niacinamide (Vitamin B3)', company_id: c1, vendor_id: v3, uom: 'kg', uom_category: 'MASS', cost: '1850.000000', currency_code: 'PHP', density_kg_per_l: '1.200000', specific_gravity: '1.200000', description: 'Brightening active ingredient', is_inventoried: false },
    { code: 'MAT-PHENOX-006', name: 'Phenoxyethanol Preservative', company_id: c1, vendor_id: v1, uom: 'kg', uom_category: 'MASS', cost: '650.000000', currency_code: 'PHP', density_kg_per_l: '1.107000', specific_gravity: '1.107000', description: 'Broad-spectrum preservative', is_inventoried: true },

    // Perfumes
    { code: 'MAT-ETH-101', name: 'Ethyl Alcohol 96% Perfumery Grade', company_id: c1, vendor_id: v1, uom: 'L', uom_category: 'VOLUME', cost: '145.000000', currency_code: 'PHP', density_kg_per_l: '0.808000', specific_gravity: '0.808000', description: 'Carrier solvent for fragrance', is_inventoried: true },
    { code: 'MAT-FO-102', name: 'French Vanilla Fragrance Oil', company_id: c1, vendor_id: v2, uom: 'kg', uom_category: 'MASS', cost: '4200.000000', currency_code: 'PHP', density_kg_per_l: '0.985000', specific_gravity: '0.985000', description: 'Concentrated fragrance oil note', is_inventoried: true },
    { code: 'MAT-FO-103', name: 'Ocean Breeze Fragrance Oil', company_id: c1, vendor_id: v2, uom: 'kg', uom_category: 'MASS', cost: '3900.000000', currency_code: 'PHP', density_kg_per_l: '0.975000', specific_gravity: '0.975000', description: 'Fresh aquatic fragrance oil note', is_inventoried: true },
    { code: 'MAT-FIX-104', name: 'Galaxolide 50% Fixative', company_id: c1, vendor_id: v2, uom: 'kg', uom_category: 'MASS', cost: '1950.000000', currency_code: 'PHP', density_kg_per_l: '1.005000', specific_gravity: '1.005000', description: 'Perfume fixative agent', is_inventoried: true },
    { code: 'MAT-PEG-105', name: 'PEG-40 Hydrogenated Castor Oil', company_id: c1, vendor_id: v1, uom: 'kg', uom_category: 'MASS', cost: '480.000000', currency_code: 'PHP', density_kg_per_l: '1.030000', specific_gravity: '1.030000', description: 'Solubilizer for fragrance in water', is_inventoried: true },

    // Food Supplements
    { code: 'MAT-VITC-201', name: 'Ascorbic Acid (Vitamin C Powder)', company_id: c3, vendor_id: v3, uom: 'kg', uom_category: 'MASS', cost: '890.000000', currency_code: 'PHP', density_kg_per_l: '1.650000', specific_gravity: '1.650000', description: 'Active dietary vitamin ingredient', is_inventoried: true },
    { code: 'MAT-ZINC-202', name: 'Zinc Gluconate Powder', company_id: c3, vendor_id: v3, uom: 'kg', uom_category: 'MASS', cost: '1420.000000', currency_code: 'PHP', density_kg_per_l: '1.500000', specific_gravity: '1.500000', description: 'Essential mineral active', is_inventoried: true },
    { code: 'MAT-MCC-203', name: 'Microcrystalline Cellulose 102 (MCC)', company_id: c3, vendor_id: v1, uom: 'kg', uom_category: 'MASS', cost: '310.000000', currency_code: 'PHP', density_kg_per_l: '1.450000', specific_gravity: '1.450000', description: 'Tablet/capsule filler binder (Excipient)', is_inventoried: true },
    { code: 'MAT-MAGST-204', name: 'Magnesium Stearate USP', company_id: c3, vendor_id: v1, uom: 'kg', uom_category: 'MASS', cost: '450.000000', currency_code: 'PHP', density_kg_per_l: '1.030000', specific_gravity: '1.030000', description: 'Capsule lubricant (Excipient)', is_inventoried: true },
    { code: 'MAT-CAP-205', name: 'Gelatin Capsule Size 0 Empty', company_id: c3, vendor_id: v1, uom: 'pieces', uom_category: 'COUNT', cost: '0.450000', currency_code: 'PHP', density_kg_per_l: '1.000000', specific_gravity: '1.000000', unit_weight: '0.000096', unit_weight_uom: 'kg', description: 'Empty gelatin capsule size 0 (96mg shell)', is_inventoried: true },
  ];

  const materialMap = {};
  for (const m of rawMaterials) {
    const [id] = await knex('materials').insert(m).then(res => [res[0]]);
    materialMap[m.code] = id;
  }

  // 7. Seed Formulas
  // Formula 1: Cosmetic Gentle Facial Cleanser (APPROVED)
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
    revision_reason: 'Initial approved formula formula launch',
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

  // Composition: Water 65%, Glycerin 5%, SLES 18%, CAPB 9.5%, Niacinamide 1.5%, Phenoxyethanol 1.0% = 100.00%
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

  // Cost Snapshot for V1.0
  const [snap1Id] = await knex('formula_cost_snapshots').insert({
    version_id: v1Id,
    raw_material_cost: '11477.500000',
    process_loss_pct: '0.500000',
    packaging_cost: '1500.000000',
    labor_cost: '800.000000',
    overhead_cost: '600.000000',
    total_cost: '14434.887500',
    cost_per_unit: '144.348875',
    currency_code: 'PHP',
  }).then(res => [res[0] || 1]);

  for (const m of f1Materials) {
    await knex('formula_cost_snapshot_items').insert({
      snapshot_id: snap1Id,
      material_id: m.material_id,
      material_code_snapshot: m.material_code_snapshot,
      material_name_snapshot: m.material_name_snapshot,
      percentage: m.percentage,
      quantity: m.calculated_quantity,
      uom: m.uom_snapshot,
      cost_per_uom: (Number(m.line_cost) / Number(m.calculated_quantity)).toString(),
      line_cost: m.line_cost,
      currency_code: 'PHP',
    });
  }

  // Formula 2: Perfume No Brand Vanilla Mist (APPROVED)
  const [f2Id] = await knex('formulas').insert({
    code: 'F-PRF-001',
    name: 'Vanilla Blossom Body Mist (No Brand Base)',
    product_category: 'Perfume No Brand',
    product_subcategory: 'Body Mist',
    brand_type: 'Generic Base',
    status: 'ACTIVE',
    owner_id: formulatorUserId,
    department: 'Fragrance Lab',
  }).then(res => [res[0] || 2]);

  const [v2Id] = await knex('formula_versions').insert({
    formula_id: f2Id,
    major_version: 1,
    minor_version: 0,
    lock_version: 0,
    version_status: 'APPROVED',
    change_type: 'INITIAL_RELEASE',
    revision_reason: 'Base perfume formulation release',
    target_batch_size: '10.000000',
    target_batch_uom: 'kg',
    expected_yield: '98.000000',
    shelf_life: '36 Months',
    storage_condition: 'Keep away from heat and direct sunlight',
    created_by: formulatorUserId,
    reviewed_by: reviewerUserId,
    approved_by: approverUserId,
    effective_date: knex.fn.now(),
    approval_timestamp: knex.fn.now(),
  }).then(res => [res[0] || 2]);

  const f2Materials = [
    { version_id: v2Id, material_id: materialMap['MAT-FO-102'], material_code_snapshot: 'MAT-FO-102', material_name_snapshot: 'French Vanilla Fragrance Oil', uom_snapshot: 'kg', percentage: '5.000000', calculated_quantity: '0.500000', line_cost: '2100.000000', function_name: 'Fragrance Note' },
    { version_id: v2Id, material_id: materialMap['MAT-ETH-101'], material_code_snapshot: 'MAT-ETH-101', material_name_snapshot: 'Ethyl Alcohol 96% Perfumery Grade', uom_snapshot: 'L', percentage: '75.000000', calculated_quantity: '7.500000', line_cost: '1087.500000', function_name: 'Solvent Carrier' },
    { version_id: v2Id, material_id: materialMap['MAT-FIX-104'], material_code_snapshot: 'MAT-FIX-104', material_name_snapshot: 'Galaxolide 50% Fixative', uom_snapshot: 'kg', percentage: '1.000000', calculated_quantity: '0.100000', line_cost: '195.000000', function_name: 'Fixative' },
    { version_id: v2Id, material_id: materialMap['MAT-PEG-105'], material_code_snapshot: 'MAT-PEG-105', material_name_snapshot: 'PEG-40 Hydrogenated Castor Oil', uom_snapshot: 'kg', percentage: '2.000000', calculated_quantity: '0.200000', line_cost: '96.000000', function_name: 'Solubilizer' },
    { version_id: v2Id, material_id: materialMap['MAT-WTR-001'], material_code_snapshot: 'MAT-WTR-001', material_name_snapshot: 'Deionized Water', uom_snapshot: 'kg', percentage: '17.000000', calculated_quantity: '1.700000', line_cost: '21.250000', function_name: 'Diluent Water' },
  ];

  for (const m of f2Materials) {
    await knex('formula_version_materials').insert(m);
  }

  await knex('perfume_formula_details').insert({
    version_id: v2Id,
    concentration_tier: 'Body Mist',
    fragrance_pct: '5.000000',
    alcohol_pct: '75.000000',
    water_pct: '17.000000',
    fixative_pct: '1.000000',
    solubilizer_pct: '2.000000',
    maceration_days: 14,
    filtration_required: true,
    cooling_required_c: '4°C for 24 hours prior to filtration',
    odor_profile: 'Sweet warm vanilla with amber woody base note',
    packaging_recommendation: 'Amber glass bottle with spray pump',
  });

  // Formula 3: Food Supplement Vitamin C + Zinc Capsule (APPROVED)
  const [f3Id] = await knex('formulas').insert({
    code: 'F-SUP-001',
    name: 'Immune Shield Vit C + Zinc Capsule 500mg',
    product_category: 'Food Supplement',
    product_subcategory: 'Immunity Supplement',
    brand_type: 'NutriPharm Label',
    status: 'ACTIVE',
    owner_id: formulatorUserId,
    department: 'Nutraceutical R&D',
  }).then(res => [res[0] || 3]);

  const [v3Id] = await knex('formula_versions').insert({
    formula_id: f3Id,
    major_version: 1,
    minor_version: 0,
    lock_version: 0,
    version_status: 'APPROVED',
    change_type: 'INITIAL_RELEASE',
    revision_reason: 'Commercial approval for dietary supplement launch',
    target_batch_size: '10.000000', // 10 kg batch = 20,000 capsules @ 500mg target fill
    target_batch_uom: 'kg',
    expected_yield: '99.000000',
    shelf_life: '24 Months',
    storage_condition: 'Store below 25°C in cool dry place away from light',
    created_by: formulatorUserId,
    reviewed_by: reviewerUserId,
    approved_by: approverUserId,
    effective_date: knex.fn.now(),
    approval_timestamp: knex.fn.now(),
  }).then(res => [res[0] || 3]);

  await knex('supplement_formula_details').insert({
    version_id: v3Id,
    dosage_form: 'Capsules',
    composition_mode: 'AMOUNT_PER_SERVING',
    serving_size: '1.000000',
    serving_uom: 'capsule',
    servings_per_container: 60,
    capsule_size: 'Size 0',
    tablet_weight: '500.000000',
    tablet_weight_uom: 'mg',
    daily_recommended_intake: 'Take 1 capsule daily after meals',
    warning_statement: 'Consult physician if pregnant or taking medication',
    storage_instruction: 'Store tightly sealed in original container',
  });

  // Active Vit C (300mg + 5% overage = 315mg), Zinc (15mg + 5% overage = 15.75mg), MCC filler q.s. (164.25mg), Mag Stearate (5mg) = 500mg total fill
  const f3Materials = [
    { version_id: v3Id, material_id: materialMap['MAT-VITC-201'], material_code_snapshot: 'MAT-VITC-201', material_name_snapshot: 'Ascorbic Acid (Vitamin C Powder)', uom_snapshot: 'kg', percentage: '63.000000', serving_amount: '300.000000', serving_uom: 'mg', calculated_quantity: '6.300000', line_cost: '5607.000000', function_name: 'Active Vitamin C', is_qs_balancing_material: false },
    { version_id: v3Id, material_id: materialMap['MAT-ZINC-202'], material_code_snapshot: 'MAT-ZINC-202', material_name_snapshot: 'Zinc Gluconate Powder', uom_snapshot: 'kg', percentage: '3.150000', serving_amount: '15.000000', serving_uom: 'mg', calculated_quantity: '0.315000', line_cost: '447.300000', function_name: 'Active Zinc Mineral', is_qs_balancing_material: false },
    { version_id: v3Id, material_id: materialMap['MAT-MCC-203'], material_code_snapshot: 'MAT-MCC-203', material_name_snapshot: 'Microcrystalline Cellulose 102 (MCC)', uom_snapshot: 'kg', percentage: '32.850000', serving_amount: '164.250000', serving_uom: 'mg', calculated_quantity: '3.285000', line_cost: '1018.350000', function_name: 'Filler / Binder (q.s. Excipient)', is_qs_balancing_material: true },
    { version_id: v3Id, material_id: materialMap['MAT-MAGST-204'], material_code_snapshot: 'MAT-MAGST-204', material_name_snapshot: 'Magnesium Stearate USP', uom_snapshot: 'kg', percentage: '1.000000', serving_amount: '5.000000', serving_uom: 'mg', calculated_quantity: '0.100000', line_cost: '45.000000', function_name: 'Lubricant Excipient', is_qs_balancing_material: false },
  ];

  for (const m of f3Materials) {
    const [vmId] = await knex('formula_version_materials').insert(m).then(res => [res[0]]);
    const overagePct = m.material_id === materialMap['MAT-VITC-201'] || m.material_id === materialMap['MAT-ZINC-202'] ? '5.000000' : '0.000000';
    const isExcipient = m.material_id === materialMap['MAT-MCC-203'] || m.material_id === materialMap['MAT-MAGST-204'];
    await knex('supplement_serving_details').insert({
      version_material_id: vmId,
      active_amount_per_serving: m.serving_amount,
      active_uom: m.serving_uom,
      overage_pct: overagePct,
      is_excipient: isExcipient,
      is_fixed_non_active: m.material_id === materialMap['MAT-MAGST-204'],
    });
  }

  // 8. Seed Perfume Mixture for Conversion Testing
  const [mix1Id] = await knex('perfume_mixtures').insert({
    mixture_code: 'MIX-2026-001',
    mixture_name: 'Existing Vanilla Base Mixture Lot 402',
    source_formula_version_id: v2Id,
    actual_total_weight: '50.000000',
    weight_uom: 'kg',
    recorded_date: knex.fn.now(),
    remarks: 'Actual recorded batch mixture for conversion testing',
    created_by: formulatorUserId,
  }).then(res => [res[0] || 1]);

  await knex('perfume_mixture_materials').insert([
    { mixture_id: mix1Id, material_id: materialMap['MAT-FO-102'], percentage: '4.000000', actual_quantity: '2.000000', uom: 'kg' },
    { mixture_id: mix1Id, material_id: materialMap['MAT-ETH-101'], percentage: '76.000000', actual_quantity: '38.000000', uom: 'L' },
    { mixture_id: mix1Id, material_id: materialMap['MAT-FIX-104'], percentage: '1.000000', actual_quantity: '0.500000', uom: 'kg' },
    { mixture_id: mix1Id, material_id: materialMap['MAT-PEG-105'], percentage: '2.000000', actual_quantity: '1.000000', uom: 'kg' },
    { mixture_id: mix1Id, material_id: materialMap['MAT-WTR-001'], percentage: '17.000000', actual_quantity: '8.500000', uom: 'kg' },
  ]);

  if (isMysql) {
    await knex.raw('SET FOREIGN_KEY_CHECKS = 1;');
  } else {
    await knex.raw('PRAGMA foreign_keys = ON;');
  }

  console.log('✅ Seed completed successfully!');
}
