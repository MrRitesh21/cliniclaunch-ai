import { Gauge } from 'prom-client';
import { registry } from './registry';
import { config } from '../../config';

// App Uptime in seconds
export const appUptimeSeconds = new Gauge({
  name: 'app_uptime_seconds',
  help: 'Application uptime in seconds',
  registers: [registry],
  collect() {
    this.set(process.uptime());
  },
});

// App Info Gauge (Version, Build Number)
export const appInfo = new Gauge({
  name: 'app_info',
  help: 'Static metadata info regarding backend version and build number',
  labelNames: ['version', 'build'],
  registers: [registry],
});

appInfo.set({ version: config.appVersion, build: config.buildNumber }, 1);

// Container Restarts Gauge
export const containerRestartCount = new Gauge({
  name: 'container_restart_count',
  help: 'Estimated container restart count derived from uptime resets',
  registers: [registry],
});

let restartCounter = 0;
containerRestartCount.set(restartCounter);

export function incrementRestartCounter(): void {
  restartCounter += 1;
  containerRestartCount.set(restartCounter);
}
