import { describe, expect, beforeAll, afterAll } from 'bun:test'
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  cleanupTestOutput,
  hasConfiguredEnvVar,
  STABLE_LOCAL_AUDIO_PATH,
  STABLE_LOCAL_AUDIO_TITLE,
} from '../../../../test-utils/test-helpers'
import { budgetedTest } from '../../../../test-utils/budget'

describe('write subcommand with services', () => {
  beforeAll(async () => {
    await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)
  })

  afterAll(async () => {
    await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)
  })

  const serviceCases = [
    {
      testName: 'write input/1-audio.mp3 --openai gpt-5.4',
      envVar: 'OPENAI_API_KEY',
      args: ['--openai', 'gpt-5.4'],
      expectedModel: 'gpt-5.4',
      expectedService: 'openai',
    },
    {
      testName: 'write input/1-audio.mp3 --anthropic claude-sonnet-4-6',
      envVar: 'ANTHROPIC_API_KEY',
      args: ['--anthropic', 'claude-sonnet-4-6'],
      expectedModel: 'claude-sonnet-4-6',
      expectedService: 'anthropic',
    },
    {
      testName: 'write input/1-audio.mp3 --gemini gemini-3.1-flash-lite-preview',
      envVar: 'GEMINI_API_KEY',
      args: ['--gemini', 'gemini-3.1-flash-lite-preview'],
      expectedModel: 'gemini-3.1-flash-lite-preview',
      expectedService: 'gemini',
    },
    {
      testName: 'write input/1-audio.mp3 --groq openai/gpt-oss-20b',
      envVar: 'GROQ_API_KEY',
      args: ['--groq', 'openai/gpt-oss-20b'],
      expectedModel: 'openai/gpt-oss-20b',
      expectedService: 'groq',
    },
    {
      testName: 'write input/1-audio.mp3 --minimax MiniMax-M2.5',
      envVar: 'MINIMAX_API_KEY',
      args: ['--minimax', 'MiniMax-M2.5'],
      expectedModel: 'MiniMax-M2.5',
      expectedService: 'minimax',
    },
    {
      testName: 'write input/1-audio.mp3 --grok grok-4.20-reasoning',
      envVar: 'XAI_API_KEY',
      args: ['--grok', 'grok-4.20-reasoning'],
      expectedModel: 'grok-4.20-reasoning',
      expectedService: 'grok',
    },
  ] as const

  for (const serviceCase of serviceCases) {
    const budgetKey = `write-${serviceCase.expectedService}-${serviceCase.expectedModel}`
    budgetedTest(budgetKey, serviceCase.testName, async () => {
      if (!await hasConfiguredEnvVar(serviceCase.envVar)) {
        console.log(`Skipping: ${serviceCase.envVar} is required`)
        return
      }

      await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)

      const result = await runCommand([
        'src/cli/create-cli.ts', 'write', STABLE_LOCAL_AUDIO_PATH, ...serviceCase.args
      ])

      expect(result.exitCode).toBe(0)

      const outputDir = await findLatestDirectory(STABLE_LOCAL_AUDIO_TITLE)
      expect(outputDir).not.toBeNull()

      if (outputDir) {
        const metadata = await Bun.file(`${outputDir}/metadata.json`).json() as {
          step3?: { llmModel?: string; llmService?: string; outputFileName?: string }
        }
        const outputFileName = metadata.step3?.outputFileName ?? 'text.md'
        expect(await fileExists(`${outputDir}/${outputFileName}`)).toBe(true)

        if (outputFileName.endsWith('.json')) {
          const summaryJson = await Bun.file(`${outputDir}/${outputFileName}`).json() as unknown
          expect(summaryJson).toBeDefined()
        } else {
          const summaryContent = await Bun.file(`${outputDir}/${outputFileName}`).text()
          expect(summaryContent.length).toBeGreaterThan(0)
        }

        expect(metadata.step3?.llmModel).toBe(serviceCase.expectedModel)
        expect(metadata.step3?.llmService).toBe(serviceCase.expectedService)
      }
    })
  }
})

describe('write subcommand --price', () => {
  budgetedTest('write-openai-gpt-5.4', 'write input/1-audio.mp3 --openai gpt-5.4 --price', async () => {
    const result = await runCommand([
      'src/cli/create-cli.ts', 'write', STABLE_LOCAL_AUDIO_PATH, '--openai', 'gpt-5.4', '--price'
    ])

    expect(result.exitCode).toBe(0)
  })
})
