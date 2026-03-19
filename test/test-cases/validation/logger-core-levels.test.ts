import { test, expect } from 'bun:test'
import { createLogger } from '~/logger/core'
import type { LogSinkEvent } from '~/logger/types'

const collectEvents = (): { events: LogSinkEvent[], sink: (event: LogSinkEvent) => void } => {
  const events: LogSinkEvent[] = []
  return {
    events,
    sink: (event) => {
      events.push(event)
    }
  }
}

test('logger minLevel=warn emits warn/error only', () => {
  const { events, sink } = collectEvents()
  const logger = createLogger({ minLevel: 'warn', sinks: [sink] })

  logger.debug('debug')
  logger.info('info')
  logger.success('success')
  logger.warn('warn')
  logger.error('error')

  expect(events.map(event => event.level)).toEqual(['warn', 'error'])
})

test('logger minLevel=debug emits all levels', () => {
  const { events, sink } = collectEvents()
  const logger = createLogger({ minLevel: 'debug', sinks: [sink] })

  logger.debug('debug')
  logger.info('info')
  logger.success('success')
  logger.warn('warn')
  logger.error('error')

  expect(events.map(event => event.level)).toEqual(['debug', 'info', 'success', 'warn', 'error'])
})
