import 'dotenv/config';
import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase, getDatabaseType } from './backend/config/db.js';
import { errorHandler } from './backend/middleware/errorMiddleware.js';

import authRoutes from './backend/routes/authRoutes.js';
import statementRoutes from './backend/routes/statementRoutes.js';
import dashboardRoutes from './backend/routes/dashboardRoutes.js';
import transactionRoutes from './backend/routes/transactionRoutes.js';
import insightRoutes from './backend/routes/insightRoutes.js';
import reportRoutes from './backend/routes/reportRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const isProd = process.env.NODE_ENV === 'production';

  // Initialize Database
  await initDatabase();

  // Core Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // API Health Check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'FinSight API',
      database: getDatabaseType(),
      timestamp: new Date().toISOString(),
    });
  });

  // REST API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/statements', statementRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/transactions', transactionRoutes);
  app.use('/api', insightRoutes); // provides /api/insights and /api/recurring-payments
  app.use('/api/reports', reportRoutes);

  // Clean URL rewrite middleware (e.g. /dashboard -> /dashboard.html)
  app.use((req, res, next) => {
    const cleanRoutes: Record<string, string> = {
      '/dashboard': '/dashboard.html',
      '/upload': '/upload.html',
      '/transactions': '/transactions.html',
      '/insights': '/insights.html',
      '/profile': '/profile.html',
      '/login': '/login.html',
      '/register': '/register.html',
    };

    if (cleanRoutes[req.path]) {
      req.url = cleanRoutes[req.path];
    }
    next();
  });

  // Frontend Serving: Vite dev middleware or production static
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'mpa',
    });
    app.use(vite.middlewares);
    console.log('[Server] Vite middleware mounted for HTML & Tailwind CSS processing.');
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  // Centralized Error Handling
  app.use(errorHandler);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[FinSight] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[Fatal Server Startup Error]', err);
  process.exit(1);
});
