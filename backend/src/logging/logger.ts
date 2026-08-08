import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { config } from '../config';

const logsDir = path.resolve(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const isProduction = config.nodeEnv === 'production';

// Asynchronous multi-destination streams for production log rotation
const streams: pino.DestinationStream[] = isProduction
  ? [
      // Standard application log stream
      pino.destination({
        dest: path.join(logsDir, 'application.log'),
        sync: false, // Asynchronous for minimal performance overhead
        mkdir: true,
      }),
      // Dedicated error log stream
      pino.destination({
        dest: path.join(logsDir, 'error.log'),
        sync: false,
        mkdir: true,
        minLength: 4096, // Buffer size to minimize disk I/O
      }),
    ]
  : [
      // In development, log to stdout
      pino.destination({ sync: true }),
    ];

export const logger = pino(
  {
    level: config.logLevel,
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
    base: {
      env: config.nodeEnv,
      version: config.appVersion,
      build: config.buildNumber,
    },
  },
  pino.multistream(
    streams.map((stream, idx) => ({
      stream,
      // Pass level filters to specific file targets
      level: idx === 1 ? 'error' : (config.logLevel as pino.Level),
    }))
  )
);
