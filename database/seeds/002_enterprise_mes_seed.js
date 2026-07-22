import bcrypt from 'bcryptjs';

export async function seed(knex) {
  const passwordHash = await bcrypt.hash('Admin@123456', 10);

  // 1. Roles
  const targetRoles = [
    { name: 'Super Admin', description: 'Full System Administration' },
    { name: 'Formulation Chemist', description: 'R&D Formula Creation & Submission' },
    { name: 'Production Supervisor', description: 'Batch Assignment, Monitoring, Deviation Review & Force Unlock' },
    { name: 'Compounding Operator', description: 'Touch-Friendly MES Step Weighing & Batch Execution Only' },
    { name: 'QC Specialist', description: 'Quality Inspection, Parameters Entry & Batch Release' },
  ];

  const roleMap = {};
  for (const r of targetRoles) {
    let existing = await knex('roles').where({ name: r.name }).first();
    if (!existing) {
      const [id] = await knex('roles').insert(r).then(res => [res[0]]);
      roleMap[r.name] = id;
    } else {
      await knex('roles').where({ id: existing.id }).update({ description: r.description });
      roleMap[r.name] = existing.id;
    }
  }

  // 2. Permissions
  const permissionsData = [
    { key: 'formula.view', name: 'View Formulas', description: 'View formula library and versions' },
    { key: 'formula.create', name: 'Create Formula', description: 'Create new formula draft' },
    { key: 'formula.edit', name: 'Edit Formula', description: 'Modify draft formulas' },
    { key: 'formula.submit', name: 'Submit Formula', description: 'Submit formula for review' },
    { key: 'formula.approve', name: 'Approve Formula', description: 'Approve submitted formula versions' },
    { key: 'formula.lock', name: 'Lock Formula', description: 'Lock approved formulas' },
    { key: 'batch.assign', name: 'Assign Batch', description: 'Assign batch to operator and machine' },
    { key: 'batch.execute', name: 'Execute Batch', description: 'Perform compounding weighing step execution' },
    { key: 'batch.pause', name: 'Pause Batch', description: 'Pause and resume active batch' },
    { key: 'batch.complete', name: 'Complete Batch', description: 'Complete compounding execution' },
    { key: 'batch.submit_qc', name: 'Submit to QC', description: 'Transfer completed batch to QC' },
    { key: 'qc.inspect', name: 'QC Inspect', description: 'Enter QC parameter test results' },
    { key: 'qc.approve', name: 'QC Release', description: 'Approve final batch release' },
    { key: 'qc.reject', name: 'QC Reject', description: 'Reject batch or order rework' },
    { key: 'reports.view', name: 'View Reports', description: 'Access manufacturing analytics and export PDF/Excel' },
    { key: 'users.manage', name: 'Manage Users', description: 'Create and edit user accounts and roles' },
    { key: 'audit.view', name: 'View Audit Logs', description: 'Inspect append-only tamper-evident audit logs' },
    { key: 'lock.force_unlock', name: 'Force Unlock Batch', description: 'Supervisor override to release execution locks' },
    { key: 'deviation.review', name: 'Review Deviation', description: 'Approve or reject out-of-tolerance weighing deviations' },
    { key: 'correction.approve', name: 'Approve Correction', description: 'Approve weighing entry correction audit records' },
    { key: 'batch.cancel', name: 'Cancel Batch', description: 'Authorize cancellation of in-progress batches' },
  ];

  for (const p of permissionsData) {
    const existing = await knex('permissions').where({ key: p.key }).first();
    if (!existing) {
      await knex('permissions').insert(p);
    }
  }

  // Map permissions to roles
  const allPermissions = await knex('permissions').select('id', 'key');
  const getPermId = (key) => allPermissions.find(p => p.key === key)?.id;

  const rolePermMap = {
    [roleMap['Super Admin']]: allPermissions.map(p => p.id),
    [roleMap['Formulation Chemist']]: ['formula.view', 'formula.create', 'formula.edit', 'formula.submit', 'formula.approve', 'formula.lock', 'reports.view'].map(getPermId).filter(Boolean),
    [roleMap['Production Supervisor']]: ['formula.view', 'batch.assign', 'batch.pause', 'batch.cancel', 'lock.force_unlock', 'deviation.review', 'correction.approve', 'reports.view', 'audit.view'].map(getPermId).filter(Boolean),
    [roleMap['Compounding Operator']]: ['batch.execute', 'batch.pause', 'batch.complete', 'batch.submit_qc'].map(getPermId).filter(Boolean),
    [roleMap['QC Specialist']]: ['qc.inspect', 'qc.approve', 'qc.reject', 'reports.view'].map(getPermId).filter(Boolean),
  };

  for (const [roleId, permIds] of Object.entries(rolePermMap)) {
    if (roleId && roleId !== 'undefined') {
      await knex('role_permissions').where({ role_id: Number(roleId) }).del();
      for (const pid of permIds) {
        await knex('role_permissions').insert({ role_id: Number(roleId), permission_id: pid });
      }
    }
  }

  // 3. Demo Users
  const usersData = [
    { username: 'admin', email: 'admin@nkb.com', first_name: 'Super', last_name: 'Admin', roleName: 'Super Admin' },
    { username: 'chemist1', email: 'chemist1@nkb.com', first_name: 'Elena', last_name: 'Rostova (Maker)', roleName: 'Formulation Chemist' },
    { username: 'chemist2', email: 'chemist2@nkb.com', first_name: 'Marcus', last_name: 'Vance (Checker)', roleName: 'Formulation Chemist' },
    { username: 'supervisor', email: 'supervisor@nkb.com', first_name: 'David', last_name: 'Miller', roleName: 'Production Supervisor' },
    { username: 'operator', email: 'operator@nkb.com', first_name: 'John', last_name: 'Delos Santos', roleName: 'Compounding Operator' },
    { username: 'qc_spec', email: 'qc@nkb.com', first_name: 'Sarah', last_name: 'Jenkins', roleName: 'QC Specialist' },
  ];

  const adminUser = await knex('users').where({ email: 'admin@nkb.com' }).first();
  const adminId = adminUser?.id || null;

  for (const u of usersData) {
    const existing = await knex('users').where({ email: u.email }).first();
    let userId = existing?.id;
    if (!existing) {
      const [insertedId] = await knex('users').insert({
        username: u.username,
        email: u.email,
        password_hash: passwordHash,
        first_name: u.first_name,
        last_name: u.last_name,
        is_active: true,
      }).then(res => [res[0]]);
      userId = insertedId;
    }

    const roleId = roleMap[u.roleName];
    if (userId && roleId) {
      const ur = await knex('user_roles').where({ user_id: userId, role_id: roleId }).first();
      if (!ur) {
        await knex('user_roles').insert({ user_id: userId, role_id: roleId });
      }
    }
  }

  // 4. Equipment & Authorizations
  const machinesData = [
    { code: 'MX-01', name: 'High-Shear Vacuum Mixer 500L', type: 'Mixer', location: 'Cleanroom B1', status: 'Active' },
    { code: 'RC-02', name: 'Stainless Steel Compounding Reactor 1000L', type: 'Reactor', location: 'Main Compounding Bay', status: 'Active' },
    { code: 'HM-01', name: 'Inline Micro-Homogenizer 200L/h', type: 'Homogenizer', location: 'Emulsion Line A', status: 'Active' },
    { code: 'MT-01', name: 'Perfume Maceration Vessel 2000L', type: 'Maceration Tank', location: 'Fragrance Vault', status: 'Active' },
    { code: 'TP-01', name: 'Rotary Tablet Compression Press', type: 'Tablet Press', location: 'Nutraceutical Suite 2', status: 'Active' },
  ];

  const opUser = await knex('users').where({ email: 'operator@nkb.com' }).first();
  for (const m of machinesData) {
    const existing = await knex('machines').where({ code: m.code }).first();
    let machineId = existing?.id;
    if (!existing) {
      const [newId] = await knex('machines').insert(m).then(res => [res[0]]);
      machineId = newId;
    }

    if (machineId && opUser) {
      const authExists = await knex('operator_machine_authorizations').where({ user_id: opUser.id, machine_id: machineId }).first();
      if (!authExists) {
        await knex('operator_machine_authorizations').insert({ user_id: opUser.id, machine_id: machineId, authorized_by: adminId });
      }
    }
  }

  // 5. System Atomic Sequences
  const seqs = [
    { sequence_name: 'FORMULA_CODE', current_val: 100, prefix: 'FORM', year: 2026 },
    { sequence_name: 'BATCH_NUMBER', current_val: 100, prefix: 'BAT', year: 2026 },
    { sequence_name: 'DEVIATION_CODE', current_val: 10, prefix: 'DEV', year: 2026 },
    { sequence_name: 'CORRECTION_CODE', current_val: 10, prefix: 'COR', year: 2026 },
    { sequence_name: 'REWORK_CODE', current_val: 5, prefix: 'RWK', year: 2026 },
  ];

  for (const s of seqs) {
    const existing = await knex('system_sequences').where({ sequence_name: s.sequence_name }).first();
    if (!existing) {
      await knex('system_sequences').insert(s);
    }
  }

  // 6. Category-Configurable QC Templates
  const qcTemplates = [
    {
      code: 'QC-TMP-COSMETIC',
      name: 'Standard Cosmetic Cream/Lotion QC Matrix',
      category: 'Cosmetics',
      params: [
        { param_code: 'PH_VAL', param_name: 'pH Level @ 25°C', unit: 'pH', min_value: 5.500000, max_value: 6.500000, is_required: true },
        { param_code: 'VISC_CPS', param_name: 'Viscosity (Brookfield RV)', unit: 'cPs', min_value: 12000.000000, max_value: 18000.000000, is_required: true },
        { param_code: 'DENSITY_GML', param_name: 'Density / Specific Gravity', unit: 'g/mL', min_value: 0.980000, max_value: 1.020000, is_required: true },
        { param_code: 'MICROBE_CFU', param_name: 'Total Aerobic Microbial Count', unit: 'CFU/g', min_value: 0.000000, max_value: 100.000000, is_required: true },
        { param_code: 'HEAVY_METALS', param_name: 'Heavy Metals Screen (Pb/As)', unit: 'PPM', min_value: 0.000000, max_value: 10.000000, is_required: true },
      ],
    },
    {
      code: 'QC-TMP-PERFUME',
      name: 'Fine Fragrance Maceration & Clarity QC Matrix',
      category: 'Perfumes',
      params: [
        { param_code: 'SPEC_GRAV', param_name: 'Specific Gravity @ 20°C', unit: 'g/mL', min_value: 0.810000, max_value: 0.850000, is_required: true },
        { param_code: 'CLARITY_NTU', param_name: 'Optical Turbidity / Clarity', unit: 'NTU', min_value: 0.000000, max_value: 2.000000, is_required: true },
        { param_code: 'ALC_VOL', param_name: 'Ethanol Volumetric Assay', unit: '% v/v', min_value: 78.000000, max_value: 82.000000, is_required: true },
        { param_code: 'SCENT_EVAL', param_name: 'Organoleptic Olfactory Profile', unit: 'Pass/Fail', target_value_str: 'Standard Match', is_required: true },
      ],
    },
    {
      code: 'QC-TMP-SUPPLEMENT',
      name: 'Nutraceutical Supplement Quality Matrix',
      category: 'Food Supplements',
      params: [
        { param_code: 'ACTIVE_ASSAY', param_name: 'Active Vitamin C Assay', unit: '% label', min_value: 98.000000, max_value: 105.000000, is_required: true },
        { param_code: 'DISINTEGRATION', param_name: 'USP Disintegration Time', unit: 'minutes', min_value: 0.000000, max_value: 15.000000, is_required: true },
        { param_code: 'MOISTURE_PCT', param_name: 'Karl Fischer Moisture Content', unit: '%', min_value: 0.000000, max_value: 3.500000, is_required: true },
        { param_code: 'HEAVY_METALS_NUTRA', param_name: 'ICP-MS Heavy Metals Panel', unit: 'PPM', min_value: 0.000000, max_value: 5.000000, is_required: true },
      ],
    },
  ];

  for (const t of qcTemplates) {
    const existing = await knex('qc_templates').where({ code: t.code }).first();
    let tId = existing?.id;
    if (!existing) {
      const [inserted] = await knex('qc_templates').insert({
        code: t.code,
        name: t.name,
        category: t.category,
        is_active: true,
      }).then(res => [res[0]]);
      tId = inserted;
    }

    if (tId) {
      for (const p of t.params) {
        const pExist = await knex('qc_template_parameters').where({ template_id: tId, param_code: p.param_code }).first();
        if (!pExist) {
          await knex('qc_template_parameters').insert({
            template_id: tId,
            param_code: p.param_code,
            param_name: p.param_name,
            unit: p.unit,
            min_value: p.min_value,
            max_value: p.max_value,
            target_value_str: p.target_value_str || null,
            is_required: p.is_required,
          });
        }
      }
    }
  }

  console.log('✅ Enterprise MES Seed completed!');
}
