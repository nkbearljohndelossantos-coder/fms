import bcrypt from 'bcryptjs';
import crypto from 'crypto';

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
    { sequence_name: 'FORMULA_CODE', current_val: 105, prefix: 'FORM', year: 2026 },
    { sequence_name: 'BATCH_NUMBER', current_val: 105, prefix: 'BAT', year: 2026 },
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

  // 6. Category-Configurable QC Templates (Cosmetics Only)
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

  // 7. Seed Production Batches & QC Inspections (Cosmetics Focus Only)
  await knex('qc_inspections').del();
  await knex('batch_material_requirements').del();
  await knex('batch_steps').del();
  await knex('batch_phases').del();
  await knex('production_batches').del();

  const fCosmetic = await knex('formulas').where({ product_category: 'Cosmetic' }).first();
  const vCosmetic = fCosmetic ? await knex('formula_versions').where({ formula_id: fCosmetic.id }).first() : null;
  const mx01Machine = await knex('machines').where({ code: 'MX-01' }).first();

  if (fCosmetic && vCosmetic) {
    // Batch 1: Cosmetic (In Progress)
    const [bId1] = await knex('production_batches').insert({
      batch_number: 'BAT-2026-0101',
      formula_id: fCosmetic.id,
      formula_version_id: vCosmetic.id,
      category: 'Cosmetics',
      status: 'In Progress',
      target_batch_size: '500.000000',
      overall_progress_percent: '40.000000',
      assigned_operator_id: opUser?.id || null,
      assigned_machine_id: mx01Machine?.id || null,
      snapshot_hash: crypto.randomBytes(32).toString('hex'),
      created_by: adminId,
    }).then(r => [r[0]]);

    const [bpId1] = await knex('batch_phases').insert({
      batch_id: bId1,
      phase_letter: 'A',
      phase_name: 'Phase A: Water Phase',
      sequence: 1,
      status: 'In Progress',
    }).then(r => [r[0]]);

    const [bsId1] = await knex('batch_steps').insert({
      batch_id: bId1,
      phase_id: bpId1,
      step_number: 1,
      instructions: 'Weigh Deionized Water & Charge into MX-01 Main Vessel',
      status: 'Completed',
      lock_version: 1,
    }).then(r => [r[0]]);

    const [bsId2] = await knex('batch_steps').insert({
      batch_id: bId1,
      phase_id: bpId1,
      step_number: 2,
      instructions: 'Weigh Glycerin USP & Mix at 400 RPM for 10 mins',
      status: 'Pending',
      lock_version: 1,
    }).then(r => [r[0]]);

    const mats = await knex('materials').select('*');
    const matWtr = mats.find(m => m.code === 'MAT-WTR-001') || mats[0];
    const matGly = mats.find(m => m.code === 'MAT-GLY-002') || mats[1] || mats[0];

    if (matWtr) {
      await knex('batch_material_requirements').insert({
        batch_id: bId1,
        step_id: bsId1,
        material_id: matWtr.id,
        material_code: matWtr.code,
        material_name: matWtr.name,
        percentage: '65.000000',
        target_weight: '325.000000',
        tolerance_percent: '1.000000',
        min_weight: '321.750000',
        max_weight: '328.250000',
      });
    }

    if (matGly) {
      await knex('batch_material_requirements').insert({
        batch_id: bId1,
        step_id: bsId2,
        material_id: matGly.id,
        material_code: matGly.code,
        material_name: matGly.name,
        percentage: '5.000000',
        target_weight: '25.000000',
        tolerance_percent: '1.000000',
        min_weight: '24.750000',
        max_weight: '25.250000',
      });
    }

    const cosmeticTemplate = await knex('qc_templates').where({ category: 'Cosmetics' }).first();
    if (cosmeticTemplate) {
      await knex('qc_inspections').insert({
        batch_id: bId1,
        template_id: cosmeticTemplate.id,
        status: 'Pending QC',
      });
    }

    const qrToken1 = crypto.randomBytes(32).toString('hex');
    await knex('qr_tokens').insert({
      token_hash: crypto.createHash('sha256').update(qrToken1).digest('hex'),
      batch_id: bId1,
      formula_version_id: vCosmetic.id,
      is_single_use: false,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
  }

  console.log('✅ Enterprise MES Seed completed (Cosmetics Focus Only)!');
}
