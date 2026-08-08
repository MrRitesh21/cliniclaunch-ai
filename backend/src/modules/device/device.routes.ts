import { Router } from 'express';
import { DeviceController } from './device.controller';

export const deviceRouter = Router();

// Device Verification (Call on Login/Signup/Sensitive Actions)
deviceRouter.post('/devices/verify-login', DeviceController.verifyLogin);

// List User Devices
deviceRouter.get('/devices', DeviceController.getUserDevices);

// Trust Device
deviceRouter.post('/devices/trust', DeviceController.trustDevice);

// Block Device
deviceRouter.post('/devices/block', DeviceController.blockDevice);

// Revoke Session
deviceRouter.post('/devices/sessions/revoke', DeviceController.revokeSession);

// Security Stats Overview
deviceRouter.get('/security/stats', DeviceController.getSecurityStats);
