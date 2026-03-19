import { test, expect } from 'bun:test'
import { createLogger } from '~/logger/core'
import { runWithLogContext } from '~/logger/context-store'
import type { LogSinkEvent } from '~/logger/types'

const createCollector = (): { events: LogSinkEvent[], logger: ReturnType<typeof createLogger> } => {
  const events: LogSinkEvent[] = []
  const logger = createLogger({
    minLevel: 'debug',
    sinks: [event => {
      events.push(event)
    }]
  })
  return { events, logger }
}

test('runWithLogContext attaches context to events', async () => {
  const { events, logger } = createCollector()

  await runWithLogContext({ command: 'write', step: 'step-2-stt', requestId: 'req-1' }, async () => {
    logger.info('event')
  })

  const first = events[0]
  expect(first?.command).toBe('write')
  expect(first?.step).toBe('step-2-stt')
  expect(first?.context?.['requestId']).toBe('req-1')
})

test('nested runWithLogContext merges parent and child fields', async () => {
  const { events, logger } = createCollector()

  await runWithLogContext({ command: 'write', batchId: 'batch-1' }, async () => {
    await runWithLogContext({ itemIndex: 2 }, async () => {
      logger.info('event')
    })
  })

  const first = events[0]
  expect(first?.context?.['batchId']).toBe('batch-1')
  expect(first?.context?.['itemIndex']).toBe(2)
})

test('runWithLogContext isolates concurrent async branches', async () => {
  const { events, logger } = createCollector()

  await Promise.all([
    runWithLogContext({ batchId: 'A' }, async () => {
      await Bun.sleep(20)
      logger.info('a')
    }),
    runWithLogContext({ batchId: 'B' }, async () => {
      logger.info('b')
    })
  ])

  const batchIds = events
    .map(event => event.context?.['batchId'])
    .filter((id): id is string => typeof id === 'string')
    .sort()

  expect(batchIds).toEqual(['A', 'B'])
})
