import { expect } from 'bun:test'
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  cleanupTestOutput,
  STABLE_TTS_MD_PATH,
  STABLE_TTS_MD_TITLE,
} from './test-helpers'
import { budgetedTest } from './budget'
import {
  defineInvalidModelTest,
  definePriceEstimateTest,
  shouldSkipMissingEnv,
  withOutputLifecycle
} from './service-test-kit'

const stripAnsi = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, '')

const isTransientMinimaxTtsFailure = (output: string): boolean => {
  const clean = stripAnsi(output)
  return (
    /minimax-tts-chunk-\d+: deadline exceeded/i.test(clean) ||
    /MiniMax TTS (task creation|task query|download) failed \((408|425|429|500|502|503|504)\)/i.test(clean) ||
    /fetch failed|network error|econnreset|econnrefused|etimedout|socket hang up|dns/i.test(clean)
  )
}

export const defineTTSServiceTest = ({
  models,
  cliFlag,
  ttsService,
  envVarKey,
  envVarDescription,
  extraArgs,
  resolveExpectedSpeaker,
}: {
  models: readonly string[]
  cliFlag: string
  ttsService: string
  envVarKey: string
  envVarDescription: string
  extraArgs?: string[]
  resolveExpectedSpeaker?: () => Promise<string>
}): void => {
  withOutputLifecycle(STABLE_TTS_MD_TITLE)

  defineInvalidModelTest(`rejects invalid ${ttsService} model`, [
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    cliFlag,
    'invalid-model'
  ])

  for (const model of models) {
    const budgetKey = `tts-${ttsService}-${model}`

    definePriceEstimateTest(budgetKey, `--price prints estimate for ${model}`, [
      'src/cli/create-cli.ts',
      'tts',
      STABLE_TTS_MD_PATH,
      cliFlag,
      model,
      '--price'
    ])
  }

  for (const model of models) {
    const budgetKey = `tts-${ttsService}-${model}`

    budgetedTest(budgetKey, `${model} generates speech.wav`, async () => {
      if (await shouldSkipMissingEnv(envVarKey, `${envVarKey} is required for ${envVarDescription}`)) {
        return
      }

      await cleanupTestOutput(STABLE_TTS_MD_TITLE)

      const args = [
        'src/cli/create-cli.ts',
        'tts',
        STABLE_TTS_MD_PATH,
        cliFlag,
        model,
        ...(extraArgs ?? [])
      ]
      let result = await runCommand(args)

      if (result.exitCode !== 0 && ttsService === 'minimax') {
        const combinedOutput = `${result.stdout}\n${result.stderr}`
        if (isTransientMinimaxTtsFailure(combinedOutput)) {
          console.log(`Retrying once after transient MiniMax TTS error for ${model}`)
          await Bun.sleep(2_000)
          result = await runCommand(args)

          if (result.exitCode !== 0) {
            const retryOutput = `${result.stdout}\n${result.stderr}`
            if (isTransientMinimaxTtsFailure(retryOutput)) {
              console.log(`Skipping: MiniMax transient TTS error persisted for ${model}`)
              return
            }
          }
        }
      }

      expect(result.exitCode).toBe(0)

      const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_TTS_MD_TITLE)
      expect(outputDir).not.toBeNull()

      if (outputDir) {
        const audioExists = await fileExists(`${outputDir}/speech.wav`)
        expect(audioExists).toBe(true)

        const audioFile = Bun.file(`${outputDir}/speech.wav`)
        expect(audioFile.size).toBeGreaterThan(0)

        const metadata = await Bun.file(`${outputDir}/metadata.json`).json() as {
          tts?: { ttsService?: string, ttsModel?: string, speaker?: string, audioFileName?: string }
        }
        expect(metadata.tts?.ttsService).toBe(ttsService)
        expect(metadata.tts?.ttsModel).toBe(model)
        if (resolveExpectedSpeaker) {
          const expectedSpeaker = await resolveExpectedSpeaker()
          expect(metadata.tts?.speaker).toBe(expectedSpeaker)
        }
        expect(metadata.tts?.audioFileName).toBe('speech.wav')
      }
    })
  }
}
