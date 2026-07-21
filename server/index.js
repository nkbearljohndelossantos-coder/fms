import path from 'path';
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
import perfumeConversionRoutes from './routes/perfumeConversions.js';
import batchCalculatorRoutes from './routes/batchCalculator.js';
import reportRoutes from './routes/reports.js';
import settingsRoutes from './routes/settings.js';
import auditLogRoutes from './routes/auditLogs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Middlewares
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiter for API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { success: false, message: 'Too many requests from this IP, please try again later.' },
});
app.use('/api/', apiLimiter);

// API Routes (Supporting both /api/ and /api/v1/ prefixes)
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

// Health Check Endpoint
app.get('/api/v1/health', async (req, res) => {
  try {
    await db.raw('SELECT 1');
    return res.json({ status: 'HEALTHY', timestamp: new Date().toISOString(), database: 'CONNECTED' });
  } catch (err) {
    return res.status(500).json({ status: 'UNHEALTHY', error: err.message });
  }
});

// Single Process Production Static File Serving for compiled React SPA
const clientDistPath = path.join(__dirname, '../dist');
app.use(express.static(clientDistPath));

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  } else {
    res.status(404).json({ success: false, message: 'API route not found' });
  }
});

// Centralized Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`🚀 NKB Formulation Management System Backend running on port ${PORT}`);
});

export default app;
