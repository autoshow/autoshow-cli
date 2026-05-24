import { join } from 'node:path'
import { expect } from 'bun:test'
import { budgetedTest, E2E_TEST_TIMEOUT_MS } from '../../../../../test-utils/budget'
import {
  fileExists,
} from '../../../../../test-utils/test-helpers'
import { readRunMetadata } from '../../../../../test-utils/manifest-helpers'
import { requireConfiguredEnvVar, runCommandAndExpectOutputDir } from '../../../../../test-utils/service-test-kit'

const YOUTUBE_TRANSCRIPT_URL = 'https://www.youtube.com/watch?v=MORMZXEaONk'
const YOUTUBE_TRANSCRIPT_TITLE = 'MORMZXEaONk'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const toRecordArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isRecord) : []

const findStep2Metadata = (
  metadata: Record<string, unknown>,
  service: string,
  model: string
): Record<string, unknown> | undefined => {
  const step2 = metadata['step2']
  if (isRecord(step2)) {
    return step2
  }
  return toRecordArray(step2).find((entry) =>
    entry['transcriptionService'] === service && entry['transcriptionModel'] === model
  )
}

const resolveTranscriptArtifactDir = async (
  outputDir: string,
  metadata: Record<string, unknown>,
  service: string,
  model: string
): Promise<string> => {
  const providerState = toRecordArray(metadata['providerStates']).find((entry) =>
    entry['service'] === service && entry['model'] === model
  )
  const artifactDir = providerState && typeof providerState['artifactDir'] === 'string'
    ? providerState['artifactDir']
    : undefined

  if (artifactDir) {
    return join(outputDir, artifactDir)
  }

  if (await fileExists(join(outputDir, 'transcription.txt'))) {
    return outputDir
  }

  return join(outputDir, 'providers', `${service}-${model}`)
}

export const defineUrlTranscriptServiceTest = ({
  service,
  model,
  provider,
  envVarKey,
  envVarDescription,
}: {
  service: string
  model: string
  provider: string
  envVarKey: string
  envVarDescription: string
}): void => {
  const budgetKey = `transcribe-${service}-${model}`

  budgetedTest(budgetKey, `${service} ${model} retrieves YouTube URL transcript`, async () => {
    await requireConfiguredEnvVar(envVarKey, `${envVarKey} is required for ${envVarDescription}`)

    const outputDir = await runCommandAndExpectOutputDir(YOUTUBE_TRANSCRIPT_TITLE, [
      'src/cli/create-cli.ts',
      'extract',
      YOUTUBE_TRANSCRIPT_URL,
      '--provider',
      `${provider}=${model}`
    ])

    expect(await fileExists(join(outputDir, 'run.json'))).toBe(true)

    const metadata = await readRunMetadata(outputDir)
    const step2 = findStep2Metadata(metadata, service, model)
    expect(step2?.['transcriptionService']).toBe(service)
    expect(step2?.['transcriptionModel']).toBe(model)

    const artifactDir = await resolveTranscriptArtifactDir(outputDir, metadata, service, model)
    const transcriptPath = join(artifactDir, 'transcription.txt')
    expect(await fileExists(transcriptPath)).toBe(true)
    expect((await Bun.file(transcriptPath).text()).length).toBeGreaterThan(0)
    expect(await fileExists(join(artifactDir, 'result.json'))).toBe(true)
  }, E2E_TEST_TIMEOUT_MS)
}
