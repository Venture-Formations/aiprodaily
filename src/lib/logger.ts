import pino from 'pino'
import { randomUUID } from 'crypto'

/**
 * Structured logging with pino.
 * JSON output for Vercel log ingestion.
 * Backward compatible: existing console.log calls keep working.
 */

// Base logger — JSON to stdout, no fancy transports (Vercel-friendly)
const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  // Vercel captures stdout as structured JSON automatically
  formatters: {
    level(label) {
      return { level: label }
    },
  },
  // Reduce noise: omit pid/hostname in serverless
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
})

export interface LoggerContext {
  correlationId?: string
  publicationId?: string
  issueId?: string
  cronName?: string
  workflowStep?: string | number
  [key: string]: unknown
}

export interface Logger extends pino.Logger {
  correlationId: string
}

/**
 * Create a child logger bound to a specific context.
 *
 * Usage:
 *   const log = createLogger({ cronName: 'trigger-workflow', publicationId: '...' })
 *   log.info('Starting workflow')
 *   log.error({ err }, 'Step failed')
 */
export function createLogger(context: LoggerContext = {}): Logger {
  const correlationId = context.correlationId || randomUUID()

  const child = baseLogger.child({
    correlationId,
    ...(context.publicationId && { publicationId: context.publicationId }),
    ...(context.issueId && { issueId: context.issueId }),
    ...(context.cronName && { cronName: context.cronName }),
    ...(context.workflowStep !== undefined && { workflowStep: context.workflowStep }),
  }) as Logger

  // Attach correlationId for downstream passing
  child.correlationId = correlationId

  return child
}

/**
 * Quick one-off logger for modules that don't need full context.
 * Prefixes messages with the given tag, similar to existing [Tag] pattern.
 */
export function getModuleLogger(moduleName: string): Logger {
  return createLogger({ module: moduleName } as LoggerContext) as Logger
}

export { baseLogger }
