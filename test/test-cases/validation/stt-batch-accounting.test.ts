import { afterEach, expect, test } from 'bun:test'
import { mkdir, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { processBatch } from '~/cli/commands/process-steps/step-1-download/targets/target-utils'
import { SttPartialCompletionError } from '~/cli/commands/process-steps/process-stt'
import { readBatchItems, writeRunManifestFixture } from '../../test-utils/manifest-helpers'

const createdBatchDirs: string[] = []

afterEach(async () => {
  await Promise.all(createdBatchDirs.splice(0).map(async (dir) => {
    await rm(dir, { recursive: true, force: true })
  }))
})

test('processBatch counts incomplete STT items separately and preserves outputDir in batch.json', async () => {
  const batchLabel = `stt-batch-accounting-${Date.now()}`
  const opts = buildOptsFromFlags(false, {
    'mistral-stt': 'voxtral-mini-latest'
  })

  const result = await processBatch(
    ['example.mp3'],
    batchLabel,
    'stt',
    opts,
    async (_command, item, batchDir) => {
      const outputDir = join(batchDir, 'item-1')
      await mkdir(outputDir, { recursive: true })
      await writeRunManifestFixture(outputDir, 'stt', {
        step1: {
          title: item,
          slug: 'example',
          url: 'file:///tmp/example.mp3'
        },
        completionStatus: 'incomplete',
        requestedProviders: [
          { service: 'mistral', model: 'voxtral-mini-latest', local: false },
          { service: 'soniox', model: 'stt-async-v4', local: false }
        ],
        providerStates: [
          {
            service: 'mistral',
            model: 'voxtral-mini-latest',
            local: false,
            artifactDir: 'providers/mistral-voxtral-mini-latest',
            status: 'succeeded',
            attempts: 1
          },
          {
            service: 'soniox',
            model: 'stt-async-v4',
            local: false,
            artifactDir: 'providers/soniox-stt-async-v4',
            status: 'failed',
            attempts: 1,
            retryable: true,
            lastError: {
              message: 'socket closed',
              retryable: true,
              errorFile: 'providers/soniox-stt-async-v4/error.json'
            }
          }
        ],
        missingProviders: [
          { service: 'soniox', model: 'stt-async-v4', local: false }
        ],
        errors: [
          {
            service: 'soniox',
            model: 'stt-async-v4',
            message: 'socket closed',
            retryable: true,
            errorFile: 'providers/soniox-stt-async-v4/error.json'
          }
        ]
      })

      throw new SttPartialCompletionError(
        outputDir,
        'incomplete',
        [{ service: 'soniox', model: 'stt-async-v4', local: false }],
        'Missing STT provider outputs: soniox/stt-async-v4'
      )
    }
  )

  expect(result.ok).toBe(0)
  expect(result.incomplete).toBe(1)
  expect(result.fail).toBe(0)
  expect(result.failureExitCode).toBe(2)

  const outputDirs = await readdir('./output', { withFileTypes: true })
  const batchDir = outputDirs
    .filter((entry) => entry.isDirectory() && entry.name.includes(batchLabel))
    .map((entry) => join('./output', entry.name))
    .sort()
    .at(-1)

  expect(batchDir).toBeDefined()
  if (!batchDir) {
    return
  }
  createdBatchDirs.push(batchDir)

  const info = await readBatchItems(batchDir)
  expect(info[0]).toEqual(expect.objectContaining({
    completionStatus: 'incomplete',
    outputDir: join(batchDir, 'item-1')
  }))
})
