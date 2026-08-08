import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { metricsMiddleware } from './monitoring/middlewares/metricsMiddleware';
import { loggingMiddleware } from './monitoring/middlewares/loggingMiddleware';
import { monitoringRouter } from './monitoring/routes/monitoringRoutes';
import { deviceRouter } from './modules/device/device.routes';
import { LogService } from './logging';
import { telemetryProvider } from './monitoring/telemetry/promTelemetryProvider';

export const app = express();

// Security and CORS middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Monitoring & Logging Middlewares
app.use(metricsMiddleware);
app.use(loggingMiddleware);

// Mount health, readiness, liveness, ping & metrics routes
app.use('/', monitoringRouter);

// Mount Device Intelligence & Security Endpoints
app.use('/api', deviceRouter);

// Sample Business Routes demonstrating Telemetry & Pino Logging integration
app.get('/api/v1/users', (req: Request, res: Response) => {
  const span = telemetryProvider.startSpan('fetch_users');
  try {
    LogService.info('Fetching user list', { tenant_id: (req.headers['x-tenant-id'] as string) || 'default_tenant' });
    span.setAttribute('user_count', 5);
    res.status(200).json({
      success: true,
      data: [
        { id: 'usr_1', name: 'Alice Smith', email: 'alice@example.com' },
        { id: 'usr_2', name: 'Bob Jones', email: 'bob@example.com' },
      ],
    });
  } finally {
    span.end();
  }
});

app.get('/api/v1/slow-task', (req: Request, res: Response) => {
  const span = telemetryProvider.startSpan('slow_task');
  setTimeout(() => {
    span.end();
    res.status(200).json({ success: true, message: 'Completed slow operation' });
  }, 600); // Exceeds 500ms threshold to trigger slow request metric & warning log
});

app.get('/api/v1/error-demo', (req: Request, res: Response) => {
  LogService.error('Simulating internal server error');
  res.status(500).json({ error: 'Internal Server Error', code: 'SERVER_ERROR' });
});

// 404 Route Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Resource Not Found', path: req.path });
});

// Global Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  LogService.error('Unhandled Application Error', err, {
    request_id: req.id ? String(req.id) : undefined,
    url: req.url,
    method: req.method,
  });
  res.status(500).json({
    error: 'Internal Server Error',
    request_id: req.id ? String(req.id) : undefined,
  });
});
