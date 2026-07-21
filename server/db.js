import knex from 'knex/knex.js';
import knexConfig from './knexfile.js';

const environment = process.env.NODE_ENV || 'development';
const config = knexConfig[environment] || knexConfig.development;

const db = knex(config);

export default db;
