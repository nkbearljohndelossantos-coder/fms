import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = {
  development: process.env.DB_CLIENT === 'mysql2' ? {
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'u335953510_fms',
      password: process.env.DB_PASSWORD || 'NkbManufacturing2026',
      database: process.env.DB_NAME || 'u335953510_fms_db',
    },
    migrations: {
      directory: path.join(__dirname, '../database/migrations'),
    },
    seeds: {
      directory: path.join(__dirname, '../database/seeds'),
    },
  } : {
    client: 'sqlite3',
    connection: {
      filename: path.join(__dirname, '../database/nkb_formulation.sqlite'),
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(__dirname, '../database/migrations'),
    },
    seeds: {
      directory: path.join(__dirname, '../database/seeds'),
    },
    pool: {
      afterCreate: (conn, cb) => {
        conn.run('PRAGMA foreign_keys = ON;', cb);
      },
    },
  },

  test: {
    client: 'sqlite3',
    connection: {
      filename: ':memory:',
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(__dirname, '../database/migrations'),
    },
    seeds: {
      directory: path.join(__dirname, '../database/seeds'),
    },
    pool: {
      afterCreate: (conn, cb) => {
        conn.run('PRAGMA foreign_keys = ON;', cb);
      },
    },
  },

  production: {
    client: process.env.DB_CLIENT || 'mysql2',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'u335953510_fms',
      password: process.env.DB_PASSWORD || 'NkbManufacturing2026',
      database: process.env.DB_NAME || 'u335953510_fms_db',
    },
    migrations: {
      directory: path.join(__dirname, '../database/migrations'),
    },
    seeds: {
      directory: path.join(__dirname, '../database/seeds'),
    },
    pool: {
      min: 2,
      max: 10,
    },
  },
};

export default config;
