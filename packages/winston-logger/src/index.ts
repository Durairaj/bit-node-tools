import * as winston from 'winston';

export interface LoggerMeta {
  /**
   * Trace token passed from X-Trace-Token headers or generated in the service (if initial)
   */
  traceToken?: string;
  /**
   * For both request and response. If this contains any PII, such as email address, ensure it is redacted.
   */
  status?: number;
  /**
   * Only for HTTP requests (GET, POST, ...)
   */
  uri?: string;
  /**
   * Only for HTTP requests (GET, POST, ...)
   */
  method?: string;
  /**
   * The service name (same as in Github)
   */
  service?: string;
  /**
   * Client/server/producer/consumer (producer/consumer just for Kafka)
   */
  type?: string;
  error?: Error;
  [key: string]: any;
}

export type LoggerSanitizer = (staticMeta: LoggerMeta) => LoggerMeta;

export class Logger {
  constructor(
    private logger: winston.Logger,
    readonly staticMeta: LoggerMeta = {},
    readonly sanitizers: LoggerSanitizer[] = [],
  ) {}

  withStaticMeta(meta: LoggerMeta) {
    return new Logger(this.logger, { ...this.staticMeta, ...meta }, this.sanitizers);
  }

  log(level: string, message: string, meta?: LoggerMeta) {
    const metadata = {
      ...meta,
      ...this.staticMeta,
    };

    const sanitizedMetadata = this.sanitizers.reduce<LoggerMeta>(
      (currentMetadata, sanitizer) => sanitizer(currentMetadata),
      metadata,
    );

    this.logger.log(level, message, { metadata: sanitizedMetadata });
    return this;
  }

  error(message: string, meta?: LoggerMeta) {
    return this.log('error', message, meta);
  }

  warn(message: string, meta?: LoggerMeta) {
    return this.log('warn', message, meta);
  }

  notice(message: string, meta?: LoggerMeta) {
    return this.log('notice', message, meta);
  }

  info(message: string, meta?: LoggerMeta) {
    return this.log('info', message, meta);
  }

  silly(message: string, meta?: LoggerMeta) {
    return this.log('silly', message, meta);
  }
}
