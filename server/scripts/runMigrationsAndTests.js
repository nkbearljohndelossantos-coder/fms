import db from '../db.js';
import knexConfig from '../knexfile.js';

async function main() {
  console.log('🔄 Running database migrations...');
  const environment = process.env.NODE_ENV || 'development';
  const config = knexConfig[environment] || knexConfig.development;

  try {
    const [batchNo, log] = await db.migrate.latest(config.migrations);
    console.log(`✅ Migrations complete (Batch ${batchNo}):`);
    log.forEach(m => console.log(`  - ${m}`));

    console.log('\n🔄 Running database seeds...');
    await db.seed.run(config.seeds);
    console.log('✅ Seeds complete!');

    process.exit(0);
  } catch (err) {
    console.error('❌ Migration/Seed Error:', err);
    process.exit(1);
  }
}

main();
