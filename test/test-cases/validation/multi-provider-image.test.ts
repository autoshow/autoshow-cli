import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import type { Step5Metadata } from '~/types'
import {
  buildImageArtifactMap,
  collectImageTargets,
  getExpectedImageArtifactFileNames,
} from '~/cli/commands/process-steps/step-5-image/image-targets'
import { runImageTargets } from '~/cli/commands/process-steps/step-5-image/run-image-gen'
import { computeActualCosts, computeEstimatedCosts } from '~/utils/pricing/compute-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'

describe('multi-provider image helpers', () => {
  test('collects multiple image targets in provider order', () => {
    const targets = collectImageTargets({
      geminiImageModel: 'imagen-4.0-generate-001',
      openaiImageModel: 'gpt-image-1-mini',
      minimaxImageModel: 'image-01',
      imagenCount: 2,
      imageFormat: 'jpeg'
    })

    expect(targets.map((target) => `${target.service}:${target.model}`)).toEqual([
      'gemini:imagen-4.0-generate-001',
      'openai:gpt-image-1-mini',
      'minimax:image-01'
    ])
  })

  test('predicts provider-native output filenames for single and multi-provider runs', () => {
    const [geminiTarget] = collectImageTargets({
      geminiImageModel: 'imagen-4.0-generate-001',
      imagenCount: 2
    })
    const [openaiTarget] = collectImageTargets({
      openaiImageModel: 'gpt-image-1-mini',
      imageFormat: 'jpeg'
    })

    expect(getExpectedImageArtifactFileNames(geminiTarget!, {
      geminiImageModel: 'imagen-4.0-generate-001',
      imagenCount: 2
    }, true)).toEqual([
      'generated-image.png',
      'generated-image-2.png'
    ])

    expect(getExpectedImageArtifactFileNames(openaiTarget!, {
      openaiImageModel: 'gpt-image-1-mini',
      imageFormat: 'jpeg'
    }, false)).toEqual([
      'generated-image-openai-gpt-image-1-mini.jpg'
    ])
  })

  test('builds artifact maps for multi-provider image metadata', () => {
    const metadata: Step5Metadata[] = [
      {
        imageService: 'gemini',
        imageModel: 'imagen-4.0-generate-001',
        processingTime: 1200,
        imageCount: 2,
        imageFileNames: [
          'generated-image-gemini-imagen-4.0-generate-001.png',
          'generated-image-gemini-imagen-4.0-generate-001-2.png'
        ],
        imageFileSize: 1234,
        imageWidth: undefined,
        imageHeight: undefined
      },
      {
        imageService: 'openai',
        imageModel: 'gpt-image-1-mini',
        processingTime: 900,
        imageCount: 1,
        imageFileNames: ['generated-image-openai-gpt-image-1-mini.jpg'],
        imageFileSize: 567,
        imageWidth: undefined,
        imageHeight: undefined
      }
    ]

    expect(buildImageArtifactMap(metadata)).toEqual({
      'image-gemini-imagen-4.0-generate-001': 'generated-image-gemini-imagen-4.0-generate-001.png',
      'image-gemini-imagen-4.0-generate-001-2': 'generated-image-gemini-imagen-4.0-generate-001-2.png',
      'image-openai-gpt-image-1-mini': 'generated-image-openai-gpt-image-1-mini.jpg'
    })
  })

  test('cost and timing helpers emit one image step per provider', () => {
    const step5: Step5Metadata[] = [
      {
        imageService: 'gemini',
        imageModel: 'imagen-4.0-generate-001',
        processingTime: 1500,
        imageCount: 2,
        imageFileNames: [
          'generated-image-gemini-imagen-4.0-generate-001.png',
          'generated-image-gemini-imagen-4.0-generate-001-2.png'
        ],
        imageFileSize: 1200,
        imageWidth: undefined,
        imageHeight: undefined
      },
      {
        imageService: 'openai',
        imageModel: 'gpt-image-1-mini',
        processingTime: 800,
        imageCount: 1,
        imageFileNames: ['generated-image-openai-gpt-image-1-mini.jpg'],
        imageFileSize: 800,
        imageWidth: undefined,
        imageHeight: undefined
      }
    ]

    const estimatedCost = computeEstimatedCosts({
      imageTargets: [
        { service: 'gemini', model: 'imagen-4.0-generate-001', count: 2 },
        { service: 'openai', model: 'gpt-image-1-mini', count: 1 }
      ]
    })
    const actualCost = computeActualCosts({ step5 })
    const estimatedTiming = computeEstimatedProcessingTimes({
      imageTargets: [
        { service: 'gemini', model: 'imagen-4.0-generate-001', count: 2 },
        { service: 'openai', model: 'gpt-image-1-mini', count: 1 }
      ]
    })
    const actualTiming = computeActualProcessingTimes({ step5 })

    expect(estimatedCost.steps.filter((step) => step.step === 'image')).toHaveLength(2)
    expect(actualCost.steps.filter((step) => step.step === 'image')).toHaveLength(2)
    expect(estimatedTiming.steps.filter((step) => step.step === 'image')).toHaveLength(2)
    expect(actualTiming.steps.filter((step) => step.step === 'image')).toHaveLength(2)
  })

  test('runImageTargets preserves successful provider outputs after partial failures', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'autoshow-multi-image-'))

    try {
      const result = await runImageTargets([
        {
          service: 'openai',
          model: 'gpt-image-1-mini',
          run: async (_prompt, workspaceDir) => {
            await mkdir(workspaceDir, { recursive: true })
            const imagePath = join(workspaceDir, 'generated-image.jpg')
            await Bun.write(imagePath, new Uint8Array([1, 2, 3]))
            return {
              imagePaths: [imagePath],
              metadata: {
                imageService: 'openai',
                imageModel: 'gpt-image-1-mini',
                processingTime: 100,
                imageCount: 1,
                imageFileNames: ['generated-image.jpg'],
                imageFileSize: 3,
                imageWidth: undefined,
                imageHeight: undefined
              }
            }
          }
        },
        {
          service: 'minimax',
          model: 'image-01',
          run: async () => {
            throw new Error('simulated failure')
          }
        }
      ], 'a cat', outputDir, {})

      expect(result.metadata).toHaveLength(1)
      expect(result.imagePaths).toHaveLength(1)
      expect(result.metadata[0]?.imageFileNames[0]).toBe('generated-image-openai-gpt-image-1-mini.jpg')
      expect(await Bun.file(result.imagePaths[0]!).exists()).toBe(true)
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })
})
