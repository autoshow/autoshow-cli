import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runProviderTargetScheduler } from '~/cli/commands/process-steps/provider-target-scheduler'
import { runImageTargets } from '~/cli/commands/process-steps/step-5-image/run-image-gen'
import type { ImageTarget, Step5Metadata, TargetPoolKind } from '~/types'

type SchedulerTestTarget = {
  service: string
  model: string
  pool: TargetPoolKind
  delayMs: number
  priority?: number | undefined
  fail?: boolean | undefined
}

const imageMetadata = (target: ImageTarget, fileName: string): Step5Metadata => ({
  imageService: target.service,
  imageModel: target.model,
  processingTime: 1,
  imageFileNames: [fileName],
  imageCount: 1,
  imageFileSize: 0,
  imageWidth: undefined,
  imageHeight: undefined,
  requestMode: 'generation'
})

describe('target scheduler contracts', () => {
  test('scheduler enforces hosted/local caps, preserves result slots, and collects partial failures', async () => {
    const targets: SchedulerTestTarget[] = [
      { service: 'local', model: 'a', pool: 'local', delayMs: 8 },
      { service: 'hosted', model: 'a', pool: 'hosted', delayMs: 8 },
      { service: 'hosted', model: 'b', pool: 'hosted', delayMs: 8, fail: true },
      { service: 'local', model: 'b', pool: 'local', delayMs: 8 },
      { service: 'hosted', model: 'c', pool: 'hosted', delayMs: 8 }
    ]
    const active = { hosted: 0, local: 0, total: 0 }
    const max = { hosted: 0, local: 0, total: 0 }

    const scheduled = await runProviderTargetScheduler<SchedulerTestTarget, string>({
      entries: targets.map((target, index) => ({ index, target })),
      concurrency: { provider: 2, local: 1 },
      getPool: (target) => target.pool,
      runTarget: async (_index, target) => {
        active[target.pool] += 1
        active.total += 1
        max[target.pool] = Math.max(max[target.pool], active[target.pool])
        max.total = Math.max(max.total, active.total)
        await Bun.sleep(target.delayMs)
        active[target.pool] -= 1
        active.total -= 1
        if (target.fail) {
          throw new Error(`${target.model} failed`)
        }
        return target.model
      }
    })

    expect(max.hosted).toBe(2)
    expect(max.local).toBe(1)
    expect(max.total).toBe(3)
    expect(scheduled.results).toEqual(['a', 'a', undefined, 'b', 'c'])
    expect(scheduled.failures).toEqual([{
      index: 2,
      target: targets[2] as SchedulerTestTarget,
      message: 'b failed'
    }])
  })

  test('scheduler priority changes execution order without changing output order', async () => {
    const targets: SchedulerTestTarget[] = [
      { service: 'hosted', model: 'slow-first', pool: 'hosted', delayMs: 1, priority: 100 },
      { service: 'hosted', model: 'normal-second', pool: 'hosted', delayMs: 1, priority: 0 },
      { service: 'hosted', model: 'medium-third', pool: 'hosted', delayMs: 1, priority: 50 }
    ]
    const started: string[] = []

    const scheduled = await runProviderTargetScheduler<SchedulerTestTarget, string>({
      entries: targets.map((target, index) => ({ index, target, priority: target.priority })),
      concurrency: { provider: 1, local: 1 },
      getPool: (target) => target.pool,
      onLifecycle: (event) => {
        if (event.status === 'started') {
          started.push(event.target.model)
        }
      },
      runTarget: async (_index, target) => target.model
    })

    expect(started).toEqual(['slow-first', 'medium-third', 'normal-second'])
    expect(scheduled.results).toEqual(['slow-first', 'normal-second', 'medium-third'])
  })

  test('image target runner executes multiple hosted targets concurrently with stable artifact names', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'autoshow-image-target-runner-'))
    try {
      const active = { hosted: 0 }
      let maxHosted = 0
      const makeTarget = (model: string): ImageTarget => ({
        service: 'openai',
        model,
        run: async (_prompt, workspaceDir) => {
          active.hosted += 1
          maxHosted = Math.max(maxHosted, active.hosted)
          await Bun.sleep(10)
          const filePath = join(workspaceDir, `${model}.png`)
          await writeFile(filePath, new Uint8Array([1, 2, 3]))
          active.hosted -= 1
          return {
            imagePaths: [filePath],
            metadata: imageMetadata({ service: 'openai', model } as ImageTarget, `${model}.png`)
          }
        }
      })

      const result = await runImageTargets(
        [makeTarget('model-a'), makeTarget('model-b')],
        'prompt',
        outputDir,
        {
          openaiImageModels: ['model-a', 'model-b'],
          openaiImageModel: undefined,
          geminiImageModels: undefined,
          geminiImageModel: undefined,
          minimaxImageModels: undefined,
          minimaxImageModel: undefined,
          glmImageModels: undefined,
          glmImageModel: undefined,
          grokImageModels: undefined,
          grokImageModel: undefined,
          runwayImageModels: undefined,
          runwayImageModel: undefined,
          bflImageModels: undefined,
          bflImageModel: undefined,
          deapiImageModels: undefined,
          deapiImageModel: undefined,
          imageAspectRatio: undefined,
          imageSize: undefined,
          imageQuality: undefined,
          imageFormat: undefined,
          imageBackground: undefined,
          imageCount: undefined,
          imageInputs: undefined,
          imageMask: undefined,
          imageResponseMode: undefined,
          geminiPersonGeneration: undefined,
          geminiSearchGrounding: undefined,
          imageCompression: undefined,
          imageProviderConcurrency: 2,
          imageLocalConcurrency: 1
        }
      )

      expect(maxHosted).toBe(2)
      expect(result.metadata.map((entry) => entry.imageFileNames)).toEqual([
        ['generated-image-openai-model-a.png'],
        ['generated-image-openai-model-b.png']
      ])
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })
})
