import { logger } from "./logger";

export interface StructuredLogContext {
  request_id?: string;
  method?: string;
  url?: string;
  status?: number;
  duration?: number;
  ip?: string;
  user_agent?: string;
  tenant_id?: string;
  user_id?: string;
  [key: string]: unknown;
}

export class LogService {
  public static info(message: string, context?: StructuredLogContext): void {
    logger.info(context || {}, message);
  }

  public static warn(message: string, context?: StructuredLogContext): void {
    logger.warn(context || {}, message);
  }

  public static error(
    message: string,
    error?: Error | unknown,
    context?: StructuredLogContext,
  ): void {
    const errorDetails =
      error instanceof Error
        ? { err: { message: error.message, stack: error.stack } }
        : { err: error };
    logger.error({ ...context, ...errorDetails }, message);
  }

  public static debug(message: string, context?: StructuredLogContext): void {
    logger.debug(context || {}, message);
  }
}
