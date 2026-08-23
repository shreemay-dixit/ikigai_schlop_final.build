export type LogLevel = 'info' | 'warn' | 'error' | 'fatal';

interface DiagnosticContext {
  component?: string;
  action?: string;
  [key: string]: any;
}

class DiagnosticEngine {
  private log(level: LogLevel, message: string, context?: DiagnosticContext, error?: unknown) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]${
      context?.component ? ` [${context.component}]` : ''
    }`;

    // Detailed console output
    if (level === 'error' || level === 'fatal') {
      console.error(`${prefix} ${message}`, { context, error });
    } else if (level === 'warn') {
      console.warn(`${prefix} ${message}`, { context });
    } else {
      console.info(`${prefix} ${message}`, { context });
    }

    // Telemetry / Toast Alerts for visible runtime tracking
    if (level === 'error' || level === 'fatal') {
      if (typeof window !== 'undefined') {
        // We dispatch a custom event that SystemHealthProvider will listen to
        const event = new CustomEvent('fillwell-diagnostic-error', {
          detail: { level, message, context, error },
        });
        window.dispatchEvent(event);
      }
    }
  }

  info(message: string, context?: DiagnosticContext) {
    this.log('info', message, context);
  }

  warn(message: string, context?: DiagnosticContext) {
    this.log('warn', message, context);
  }

  error(message: string, context?: DiagnosticContext, error?: unknown) {
    this.log('error', message, context, error);
  }

  fatal(message: string, context?: DiagnosticContext, error?: unknown): never {
    this.log('fatal', message, context, error);
    // Halt execution synchronously for fatal invariant failures
    throw new Error(`FATAL: ${message}`);
  }

  /**
   * Asserts an invariant condition. If the condition is false, throws a Fatal error.
   */
  invariant(condition: any, message: string, context?: DiagnosticContext): asserts condition {
    if (!condition) {
      this.fatal(`Invariant Violation: ${message}`, context);
    }
  }
}

export const Diagnostics: DiagnosticEngine = new DiagnosticEngine();

// =============================================================================
// GLOBAL LOGGING & UNHANDLED PROMISE REJECTION MONITORING (Vercel & Node.js)
// =============================================================================
if (typeof process !== 'undefined' && process.on) {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    Diagnostics.error(
      `Unhandled Promise Rejection: ${reason?.message || reason}`,
      { component: 'GlobalProcessMonitor', stack: reason?.stack },
      reason
    );
  });

  process.on('uncaughtException', (error: Error) => {
    Diagnostics.error(
      `Uncaught Exception: ${error?.message || error}`,
      { component: 'GlobalProcessMonitor', stack: error?.stack },
      error
    );
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    Diagnostics.error(
      `Browser Unhandled Rejection: ${event.reason?.message || event.reason}`,
      { component: 'BrowserMonitor' },
      event.reason
    );
  });
}
