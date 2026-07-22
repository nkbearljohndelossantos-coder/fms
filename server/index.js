import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { express, cors, helmet, rateLimit } from './cjsRequire.js';
import dotenv from 'dotenv';

import db from './db.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import companyRoutes from './routes/companies.js';
import vendorRoutes from './routes/vendors.js';
import materialRoutes from './routes/materials.js';
import formulaRoutes from './routes/formulas.js';
import batchRoutes from './routes/batches.js';
import qrRoutes from './routes/qr.routes.js';
import qcRoutes from './routes/qc.routes.js';
import attachmentRoutes from './routes/attachments.routes.js';
import perfumeConversionRoutes from './routes/perfumeConversions.js';
import batchCalculatorRoutes from './routes/batchCalculator.js';
import reportRoutes from './routes/reports.js';
import settingsRoutes from './routes/settings.js';
import auditLogRoutes from './routes/auditLogs.js';
import { idempotencyMiddleware } from './middleware/idempotency.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Simple Cookie Parser Middleware helper
app.use((req, res, next) => {
  req.cookies = {};
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      req.cookies[parts.shift().trim()] = decodeURIComponent(parts.join('='));
    });
  }
  next();
});

// Security & Middlewares
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(idempotencyMiddleware());

// Rate limiter for API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  message: { success: false, message: 'Too many requests from this IP, please try again later.' },
});
app.use('/api/', apiLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/v1/auth', authRoutes);

app.use('/api/users', userRoutes);
app.use('/api/v1/users', userRoutes);

app.use('/api/companies', companyRoutes);
app.use('/api/v1/companies', companyRoutes);

app.use('/api/vendors', vendorRoutes);
app.use('/api/v1/vendors', vendorRoutes);

app.use('/api/materials', materialRoutes);
app.use('/api/v1/materials', materialRoutes);

app.use('/api/formulas', formulaRoutes);
app.use('/api/v1/formulas', formulaRoutes);

app.use('/api/batches', batchRoutes);
app.use('/api/v1/batches', batchRoutes);

app.use('/api/qr', qrRoutes);
app.use('/api/v1/qr', qrRoutes);

app.use('/api/qc', qcRoutes);
app.use('/api/v1/qc', qcRoutes);

app.use('/api/attachments', attachmentRoutes);
app.use('/api/v1/attachments', attachmentRoutes);

app.use('/api/perfume-conversions', perfumeConversionRoutes);
app.use('/api/v1/perfume-conversions', perfumeConversionRoutes);

app.use('/api/batch-calculations', batchCalculatorRoutes);
app.use('/api/v1/batch-calculations', batchCalculatorRoutes);

app.use('/api/reports', reportRoutes);
app.use('/api/v1/reports', reportRoutes);

app.use('/api/settings', settingsRoutes);
app.use('/api/v1/settings', settingsRoutes);

app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/v1/audit-logs', auditLogRoutes);

// Health and Readiness Check Endpoints
app.get('/api/v1/health', async (req, res) => {
  try {
    await db.raw('SELECT 1');
    return res.json({ status: 'HEALTHY', timestamp: new Date().toISOString(), database: 'CONNECTED' });
  } catch (err) {
    return res.status(500).json({ status: 'UNHEALTHY', error: err.message });
  }
});

app.get('/api/v1/ready', async (req, res) => {
  try {
    await db.raw('SELECT 1');
    return res.json({ status: 'READY', timestamp: new Date().toISOString(), service: 'NKB MES Formulation System' });
  } catch (err) {
    return res.status(500).json({ status: 'NOT_READY', error: err.message });
  }
});

// Single Process Production Static File Serving for compiled React SPA
const clientDistPath = path.join(__dirname, '../dist');
const clientPublicPath = path.join(__dirname, '../public');

app.use(express.static(clientDistPath));
app.use(express.static(clientPublicPath));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'API route not found' });
  }

  const indexPath = path.join(clientDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }

  return res.status(500).send(`
    <!DOCTYPE html>
    <html>
      <head><title>NKB MES Formulation System - Build Required</title></head>
      <body style="font-family: system-ui, sans-serif; padding: 40px; text-align: center; background: #f8fafc; color: #0f172a;">
        <div style="max-width: 500px; margin: 40px auto; background: white; padding: 30px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
          <h2 style="color: #1e3a8a; margin-top: 0;">NKB Manufacturing MES System</h2>
          <p style="color: #475569; font-size: 14px;">Frontend assets are currently building or require compilation on the server.</p>
          <div style="background: #f1f5f9; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 13px; text-align: left; margin: 20px 0;">
            git pull origin main<br/>
            npm run build
          </div>
          <p style="color: #64748b; font-size: 12px;">Run the build command in server SSH terminal then refresh this page.</p>
        </div>
      </body>
    </html>
  `);
});

// Centralized Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  const status = err.status || 500;
  res.status(status).json({ success: false, message: err.message || 'Internal Server Error' });
});

async function initDatabase() {
  try {
    console.log('Checking database migrations...');
    await db.migrate.latest();
    console.log('✅ Database migrations up to date.');
  } catch (err) {
    console.error('Database migration note:', err.message);
  }
}

app.listen(PORT, async () => {
  console.log(`🚀 Enterprise Formulation & MES System Backend running on port ${PORT}`);
  await initDatabase();
});

export default app;
