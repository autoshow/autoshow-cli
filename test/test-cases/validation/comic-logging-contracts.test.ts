import { describe, expect, test } from 'bun:test'
import { draftScenesCommand } from '~/cli/commands/process-steps/step-8-comic/commands/draft-scenes/draft-scenes-command'
import { generateImagesCommand } from '~/cli/commands/process-steps/step-8-comic/commands/generate-images/generate-images-command'
import { comicLog } from '~/cli/commands/process-steps/step-8-comic/utils/logger'
import type {
  ImageRunStats,
} from '~/cli/commands/process-steps/step-8-comic/types'
import type {
  SourceCoverageReport,
} from '~/cli/commands/process-steps/step-8-comic/utils/source-coverage-utils'

const stripAnsi = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, '')

const captureConsole = async (fn: () => Promise<void>): Promise<{ stdout: string; stderr: string }> => {
  const stdout: string[] = []
  const stderr: string[] = []
  const originalLog = console.log
  const originalError = console.error

  console.log = (...args: unknown[]) => {
    stdout.push(stripAnsi(args.map(String).join(' ')))
  }
  console.error = (...args: unknown[]) => {
    stderr.push(stripAnsi(args.map(String).join(' ')))
  }

  try {
    await fn()
  } finally {
    console.log = originalLog
    console.error = originalError
  }

  return {
    stdout: stdout.join('\n'),
    stderr: stderr.join('\n'),
  }
}

const imageStats = (overrides: Partial<ImageRunStats> = {}): ImageRunStats => ({
  imagesGenerated: 0,
  imagesSkipped: 0,
  totalInputTokens: 0,
  totalInputTextTokens: 0,
  totalInputImageTokens: 0,
  totalInputUnattributedTokens: 0,
  totalOutputTokens: 0,
  totalOutputTextTokens: 0,
  totalOutputImageTokens: 0,
  totalOutputUnattributedTokens: 0,
  totalCost: 0,
  totalDurationMs: 0,
  ...overrides,
})

const coverageReport = (coveredSegments = 4, totalSegments = 4): SourceCoverageReport => ({
  complete: coveredSegments === totalSegments,
  totalSegments,
  coveredSegments,
  missingSegments: [],
  missingItems: [],
  promptFiles: ['output/comic/scene/panel-prompts/panel-01/scene-panel-1.md'],
})

const removedLogFragments = [
  'Step 1/1',
  'Step 2/2',
  '═',
  '━',
  'Initialization complete',
  'All operations completed',
  'Response ID',
  'Status:',
  'Character refs:',
  'Canonical refs:',
  'Sketch refs:',
  'Prior panel refs:',
  'Skipping existing output',
]

const expectRemovedFragmentsAbsent = (output: string): void => {
  for (const fragment of removedLogFragments) {
    expect(output).not.toContain(fragment)
  }
}

describe('comic compact logging contracts', () => {
  test('draft-scenes runs all stages with one header and final summary', async () => {
    const captured = await captureConsole(async () => {
      await draftScenesCommand({
        scriptPath: 'input/episode-scripts/01-script/01-co-work-smarter.md',
        sceneSlug: '01-co-work-smarter',
      }, {
        runStructureScripts: async () => comicLog.line('structured-script generated', ['path=structured-script.json']),
        runDraftPrompts: async () => comicLog.line('draft-prompt generated', ['path=draft-prompt.md']),
        runSceneDraft: async () => comicLog.line('scene-json generated', ['model=gpt-5.1', 'tokens=1,200', 'cost=$0.01', 'api=0.10s']),
        runPanelPrompts: async () => comicLog.line('panel-prompts generated', ['panels=4', 'coverage=4/4']),
      })
    })

    expect((captured.stdout.match(/comic draft-scenes/g) ?? [])).toHaveLength(1)
    expect(captured.stdout).toContain('stages=structure,prompt,scene,panel-prompts')
    expect(captured.stdout).toContain('structured-script generated')
    expect(captured.stdout).toContain('draft-prompt generated')
    expect(captured.stdout).toContain('scene-json generated')
    expect(captured.stdout).toContain('panel-prompts generated')
    expect(captured.stdout).toContain('summary stages=4')
    expect(captured.stdout).toContain('output directory: output/comic/01-co-work-smarter')
    expectRemovedFragmentsAbsent(captured.stdout)
  })

  test('generate-images target sketches logs compact prep, per-sketch output, and summary', async () => {
    const captured = await captureConsole(async () => {
      await generateImagesCommand({
        scriptPath: 'input/episode-scripts/01-script/01-co-work-smarter.md',
        sceneSlug: '01-co-work-smarter',
        target: 'sketches',
        panelsPerImage: 4,
      }, {
        checkScenesExist: async () => true,
        checkPromptsExist: async () => true,
        checkPanelPromptSourceCoverage: async () => coverageReport(),
        runSketches: async () => {
          comicLog.output('generated', 'sketch', [
            'id=panels-01-04',
            'panels=panel-01,panel-02,panel-03,panel-04',
            'model=gpt-image-2',
            'mode=edit',
            'refs=3',
            'cost=$0.02',
            'duration=0.20s',
            'path=output/comic/01-co-work-smarter/sketches/panels-01-04.png',
          ])
          return imageStats({
            imagesGenerated: 1,
            totalInputTokens: 10,
            totalOutputTokens: 20,
            totalCost: 0.02,
            totalDurationMs: 200,
          })
        },
      })
    })

    expect(captured.stdout).toContain('comic generate-images scene=01-co-work-smarter target=sketches')
    expect(captured.stdout).toContain('inputs ready draft=existing prompts=existing coverage=4/4')
    expect(captured.stdout).toContain('config target=sketches')
    expect(captured.stdout).toContain('generated sketch id=panels-01-04')
    expect(captured.stdout).toContain('summary generated=1 skipped=0 tokens=30 cost=$0.02 api=0.20s')
    expect(captured.stdout).toContain('output directory: output/comic/01-co-work-smarter')
    expectRemovedFragmentsAbsent(captured.stdout)
  })

  test('existing-output skips stay concise', async () => {
    const captured = await captureConsole(async () => {
      await generateImagesCommand({
        scriptPath: 'input/episode-scripts/01-script/01-co-work-smarter.md',
        sceneSlug: '01-co-work-smarter',
        target: 'sketches',
      }, {
        checkScenesExist: async () => true,
        checkPromptsExist: async () => true,
        checkPanelPromptSourceCoverage: async () => coverageReport(),
        runSketches: async () => {
          comicLog.output('skipped', 'sketch', [
            'id=panels-01-04',
            'panels=1-4',
            'model=gpt-image-2',
            'refs=3',
            'path=output/comic/01-co-work-smarter/sketches/panels-01-04.png',
          ])
          return imageStats({ imagesSkipped: 1 })
        },
      })
    })

    expect(captured.stdout).toContain('skipped sketch id=panels-01-04')
    expect(captured.stdout).toContain('summary generated=0 skipped=1')
    expect(captured.stdout).not.toContain('Sketch chunk:')
    expectRemovedFragmentsAbsent(captured.stdout)
  })

  test('coverage errors keep actionable context', async () => {
    const coverageError = 'Panel prompt source coverage incomplete: missing 1 source text item(s): beat-0001.text "Missing line"'
    let thrown: unknown

    await captureConsole(async () => {
      try {
        await generateImagesCommand({
          scriptPath: 'input/episode-scripts/01-script/01-co-work-smarter.md',
          sceneSlug: '01-co-work-smarter',
          target: 'sketches',
        }, {
          checkScenesExist: async () => true,
          checkPromptsExist: async () => true,
          checkPanelPromptSourceCoverage: async () => {
            throw new Error(coverageError)
          },
          runSketches: async () => imageStats(),
        })
      } catch (error) {
        thrown = error
      }
    })

    expect(thrown).toBeInstanceOf(Error)
    expect((thrown as Error).message).toContain('Panel prompt source coverage incomplete')
    expect((thrown as Error).message).toContain('beat-0001.text')
  })
})
