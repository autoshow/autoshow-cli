import { expect } from "bun:test"
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  STABLE_LOCAL_AUDIO_PATH,
  STABLE_LOCAL_AUDIO_TITLE,
} from "./test-helpers"
import { budgetedTest, E2E_TEST_TIMEOUT_MS } from './budget'
import { readRunMetadata } from './manifest-helpers'
import { shouldSkipMissingEnv, withOutputLifecycle } from './service-test-kit'

const stripAnsi = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, '')

const isGeminiTransientUnavailable = (output: string): boolean => {
  const clean = stripAnsi(output)
  return (
    /"code"\s*:\s*(408|425|429|500|502|503|504)\b/.test(clean) ||
    /"status"\s*:\s*"UNAVAILABLE"/.test(clean) ||
    /currently experiencing high demand/i.test(clean)
  )
}

const isMinimaxTransientUnavailable = (output: string): boolean => {
  const clean = stripAnsi(output)
  return (
    /overloaded_error/i.test(clean) ||
    /\b529\b/.test(clean) ||
    /server is overloaded/i.test(clean) ||
    /fetch failed|network error|econnreset|econnrefused|etimedout|socket hang up|dns/i.test(clean)
  )
}

export const defineLLMWriteTest = ({
  models,
  cliFlag,
  llmService,
  requiresEnvVar
}: {
  models: readonly string[]
  cliFlag: string
  llmService: string
  requiresEnvVar?: { key: string, description: string }
}): void => {
  withOutputLifecycle(STABLE_LOCAL_AUDIO_TITLE)

  for (const model of models) {
    const budgetKey = `write-${llmService}-${model}`
    budgetedTest(budgetKey, `${model} model generates summary`, async () => {
      if (requiresEnvVar && await shouldSkipMissingEnv(requiresEnvVar.key, `${requiresEnvVar.key} is required for ${requiresEnvVar.description}`)) {
        return
      }

      let result = await runCommand(["src/cli/create-cli.ts", "write", STABLE_LOCAL_AUDIO_PATH, cliFlag, model])

      if (result.exitCode !== 0 && llmService === 'gemini') {
        const combinedOutput = `${result.stdout}\n${result.stderr}`
        if (isGeminiTransientUnavailable(combinedOutput)) {
          console.log(`Retrying once after transient Gemini availability error for ${model}`)
          await Bun.sleep(2_000)
          result = await runCommand(["src/cli/create-cli.ts", "write", STABLE_LOCAL_AUDIO_PATH, cliFlag, model])

          if (result.exitCode !== 0) {
            const retryOutput = `${result.stdout}\n${result.stderr}`
            if (isGeminiTransientUnavailable(retryOutput)) {
              console.log(`Skipping: Gemini transient availability error persisted for ${model}`)
              return
            }
          }
        }
      }

      if (result.exitCode !== 0 && llmService === 'minimax') {
        const combinedOutput = `${result.stdout}\n${result.stderr}`
        if (isMinimaxTransientUnavailable(combinedOutput)) {
          console.log(`Retrying once after transient MiniMax availability error for ${model}`)
          await Bun.sleep(2_000)
          result = await runCommand(["src/cli/create-cli.ts", "write", STABLE_LOCAL_AUDIO_PATH, cliFlag, model])

          if (result.exitCode !== 0) {
            const retryOutput = `${result.stdout}\n${result.stderr}`
            if (isMinimaxTransientUnavailable(retryOutput)) {
              console.log(`Skipping: MiniMax transient availability error persisted for ${model}`)
              return
            }
          }
        }
      }

      expect(result.exitCode).toBe(0)

      const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_LOCAL_AUDIO_TITLE)
      expect(outputDir).not.toBeNull()

      if (outputDir) {
        const metadataExists = await fileExists(`${outputDir}/run.json`)
        expect(metadataExists).toBe(true)

        const metadata = await readRunMetadata(outputDir) as {
          step3?: { llmModel?: string; llmService?: string; outputFileName?: string }
        }
        const outputFileName = metadata.step3?.outputFileName ?? 'text.json'
        expect(await fileExists(`${outputDir}/${outputFileName}`)).toBe(true)

        if (outputFileName.endsWith('.json')) {
          const summaryJson = await Bun.file(`${outputDir}/${outputFileName}`).json() as unknown
          expect(summaryJson).toBeDefined()
        } else {
          const summaryContent = await Bun.file(`${outputDir}/${outputFileName}`).text()
          expect(summaryContent.length).toBeGreaterThan(0)
        }

        expect(metadata.step3?.llmModel).toBe(model)
        expect(metadata.step3?.llmService).toBe(llmService)
      }
    }, E2E_TEST_TIMEOUT_MS)
  }
}
