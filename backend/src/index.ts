import { app } from './app';
import { config } from './config';
import { LogService } from './logging';
import http from 'http';

const server = http.createServer(app);

server.listen(config.port, () => {
  LogService.info(`🚀 Backend Server initialized and listening on port ${config.port}`, {
    port: config.port,
    env: config.nodeEnv,
    version: config.appVersion,
    build: config.buildNumber,
    metrics_path: config.metricsPath,
  });
});

// Graceful Shutdown handling for SIGTERM & SIGINT
const gracefulShutdown = (signal: string) => {
  LogService.warn(`Received ${signal}. Initiating graceful shutdown...`);
  server.close(() => {
    LogService.info('HTTP server closed. Exiting process.');
    process.exit(0);
  });

  // Force shutdown after 10 seconds timeout
  setTimeout(() => {
    LogService.error('Forceful shutdown triggered after timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
