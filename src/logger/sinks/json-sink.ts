import type { LogSink } from '~/logger/types'

const serializeEvent = (event: Parameters<LogSink>[0]): string => {
  const payload: Record<string, unknown> = {
    timestamp: event.timestamp,
    level: event.level,
    category: event.category,
    runId: event.runId,
    message: event.message
  }

  if (event.command) {
    payload['command'] = event.command
  }

  if (event.step) {
    payload['step'] = event.step
  }

  if (event.context && Object.keys(event.context).length > 0) {
    payload['context'] = event.context
  }

  if (event.metadata && Object.keys(event.metadata).length > 0) {
    payload['metadata'] = event.metadata
  }

  if (event.args.length > 0) {
    payload['args'] = event.args
  }

  return JSON.stringify(payload)
}

export const createJsonSink = (): LogSink => {
  return (event) => {
    const line = serializeEvent(event)
    console.error(line)
  }
}
