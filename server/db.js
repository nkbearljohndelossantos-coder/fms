import knex from 'knex/knex.js';
import knexConfig from './knexfile.js';

const env = process.env.NODE_ENV || 'development';
const dbClient = process.env.DB_CLIENT || (process.env.DB_USER ? 'mysql2' : null);

// If running in production mode or DB_CLIENT is mysql2 or on Hostinger, use production config
const configKey = (env === 'production' || dbClient === 'mysql2') ? 'production' : env;
const config = knexConfig[configKey] || knexConfig.production || knexConfig.development;

const db = knex(config);

export default db;
