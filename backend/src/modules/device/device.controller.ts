import { Request, Response } from "express";
import { DeviceService } from "./device.service";
import { DeviceRepository } from "./device.repository";
import { LogService } from "../../logging";

export class DeviceController {
  /**
   * POST /api/devices/verify-login
   */
  public static async verifyLogin(req: Request, res: Response): Promise<void> {
    try {
      const {
        visitorId,
        deviceHash,
        userId,
        tenantId,
        browser,
        os,
        deviceType,
        screenResolution,
        timezone,
        language,
      } = req.body;

      if (!visitorId || !userId) {
        res.status(400).json({ error: "visitorId and userId are required" });
        return;
      }

      const clientIp = req.ip || req.socket.remoteAddress || "127.0.0.1";

      const result = await DeviceService.verifyDeviceLogin({
        visitorId,
        deviceHash: deviceHash || `hash_${visitorId}`,
        userId,
        tenantId: tenantId || (req.headers["x-tenant-id"] as string) || "default_tenant",
        browser,
        os,
        deviceType,
        screenResolution,
        timezone,
        language,
        ipAddress: clientIp,
        userAgent: req.headers["user-agent"],
      });

      if (!result.allowed) {
        res.status(403).json({
          error: "Access Denied",
          message: "This device has been blocked by security policy.",
          risk: result.risk,
        });
        return;
      }

      res.status(200).json({
        success: true,
        userDevice: result.userDevice,
        session: result.session,
        risk: result.risk,
      });
    } catch (err: any) {
      LogService.error("[DeviceController] Failed to verify device login", err);
      res.status(500).json({ error: "Internal server error verifying device login" });
    }
  }

  /**
   * GET /api/devices
   */
  public static async getUserDevices(req: Request, res: Response): Promise<void> {
    try {
      const userId =
        (req.query.userId as string) || (req.headers["x-user-id"] as string) || "usr_demo";
      const tenantId = (req.headers["x-tenant-id"] as string) || "default_tenant";

      const devices = await DeviceRepository.getUserDevicesList(userId, tenantId);
      res.status(200).json({ success: true, count: devices.length, devices });
    } catch (err: any) {
      LogService.error("[DeviceController] Failed to fetch user devices", err);
      res.status(500).json({ error: "Failed to retrieve user devices" });
    }
  }

  /**
   * POST /api/devices/trust
   */
  public static async trustDevice(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId, userId } = req.body;
      const actorId = (req.headers["x-user-id"] as string) || userId || "usr_admin";
      const tenantId = (req.headers["x-tenant-id"] as string) || "default_tenant";

      await DeviceService.trustDevice(userId, deviceId, actorId, tenantId, req.ip || "127.0.0.1");
      res.status(200).json({ success: true, message: "Device marked as trusted" });
    } catch (err: any) {
      LogService.error("[DeviceController] Failed to trust device", err);
      res.status(500).json({ error: "Failed to update device trust status" });
    }
  }

  /**
   * POST /api/devices/block
   */
  public static async blockDevice(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId, userId } = req.body;
      const actorId = (req.headers["x-user-id"] as string) || userId || "usr_admin";
      const tenantId = (req.headers["x-tenant-id"] as string) || "default_tenant";

      await DeviceService.blockDevice(userId, deviceId, actorId, tenantId, req.ip || "127.0.0.1");
      res.status(200).json({ success: true, message: "Device blocked" });
    } catch (err: any) {
      LogService.error("[DeviceController] Failed to block device", err);
      res.status(500).json({ error: "Failed to block device" });
    }
  }

  /**
   * POST /api/devices/sessions/revoke
   */
  public static async revokeSession(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, tokenFamilyId } = req.body;
      const tenantId = (req.headers["x-tenant-id"] as string) || "default_tenant";

      if (tokenFamilyId) {
        await DeviceRepository.revokeTokenFamily(tokenFamilyId, tenantId);
      } else if (sessionId) {
        await DeviceRepository.revokeSession(sessionId, tenantId);
      } else {
        res.status(400).json({ error: "sessionId or tokenFamilyId required" });
        return;
      }

      res.status(200).json({ success: true, message: "Session revoked successfully" });
    } catch (err: any) {
      LogService.error("[DeviceController] Failed to revoke session", err);
      res.status(500).json({ error: "Failed to revoke session" });
    }
  }

  /**
   * GET /api/security/stats
   */
  public static async getSecurityStats(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = (req.headers["x-tenant-id"] as string) || "default_tenant";
      const stats = await DeviceRepository.getRealtimeStats(tenantId);
      res.status(200).json({ success: true, stats });
    } catch (err: any) {
      LogService.error("[DeviceController] Failed to fetch security stats", err);
      res.status(500).json({ error: "Failed to fetch security stats" });
    }
  }
}
