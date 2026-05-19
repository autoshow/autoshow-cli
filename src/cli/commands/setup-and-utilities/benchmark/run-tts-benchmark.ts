import { stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { CLIUsageError } from '~/utils/error-handler'
import * as l from '~/utils/logger'
import { createKeyValueTable } from '~/utils/logger/human-table'
import {
  loadTtsRunJson,
  type TtsRunJson,
} from './tts-eval-lib'
import {
  writeVoiceQualityReport,
  type VoiceQualityReportMode,
  type VoiceQualityReportOptions,
} from './tts-voice-quality-report'
import type { BenchmarkFlags } from './benchmark-types'

type TtsInputTextSource = {
  inputText?: string
  inputTextPath?: string
  inputTextLabel: string
}

const DEFAULT_AUDIO_JUDGE_MODEL = 'gpt-audio'

const readTextFlagValue = async (value: string): Promise<TtsInputTextSource> => {
  const trimmed = value.trim()
  if (!trimmed) {
    throw CLIUsageError('--tts-input-text cannot be empty')
  }

  const candidatePath = resolve(value)
  try {
    const fileStat = await stat(candidatePath)
    if (fileStat.isFile()) {
      return {
        inputTextPath: candidatePath,
        inputTextLabel: candidatePath,
      }
    }
  } catch {
  }

  return {
    inputText: value,
    inputTextLabel: '--tts-input-text',
  }
}

const resolveTtsInputText = async (
  runJson: TtsRunJson,
  flags: BenchmarkFlags
): Promise<TtsInputTextSource> => {
  if (flags['tts-input-text']) {
    return await readTextFlagValue(flags['tts-input-text'])
  }

  const metadataInput = runJson.metadata.input?.trim()
  if (metadataInput) {
    return {
      inputText: metadataInput,
      inputTextLabel: 'metadata.input',
    }
  }

  throw CLIUsageError(
    'TTS benchmark source text is missing. This run.json does not contain metadata.input; pass --tts-input-text with the original text or a text file path.'
  )
}

const resolveTtsMode = (value: string | undefined): VoiceQualityReportMode => {
  const mode = value ?? 'full'
  if (mode !== 'local' && mode !== 'full') {
    throw CLIUsageError(`Invalid --tts-mode value "${mode}". Expected "local" or "full".`)
  }
  return mode
}

const loadBenchmarkTtsRunJson = async (runDir: string): Promise<TtsRunJson> => {
  try {
    const dirStat = await stat(runDir)
    if (!dirStat.isDirectory()) {
      throw CLIUsageError(`TTS benchmark input must be a run directory: ${runDir}`)
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'CLIUsageError') {
      throw error
    }
    throw CLIUsageError(`TTS run directory not found: ${runDir}`)
  }

  const runJsonPath = join(runDir, 'run.json')
  try {
    await stat(runJsonPath)
  } catch {
    throw CLIUsageError(`TTS run directory is missing run.json: ${runJsonPath}`)
  }

  try {
    return loadTtsRunJson(runDir)
  } catch (error) {
    throw CLIUsageError(error instanceof Error ? error.message : String(error))
  }
}

export const runTtsBenchmark = async (
  input: string | undefined,
  flags: BenchmarkFlags
): Promise<void> => {
  if (!input) {
    throw CLIUsageError('TTS run directory is required. Usage: bun as benchmark <tts-run-dir> --tts')
  }

  const runDir = resolve(input)
  const runJson = await loadBenchmarkTtsRunJson(runDir)
  const mode = resolveTtsMode(flags['tts-mode'])
  const inputTextSource = await resolveTtsInputText(runJson, flags)

  const options: VoiceQualityReportOptions = {
    runDir,
    ...('inputTextPath' in inputTextSource ? { inputTextPath: inputTextSource.inputTextPath } : {}),
    ...('inputText' in inputTextSource ? { inputText: inputTextSource.inputText } : {}),
    inputTextLabel: inputTextSource.inputTextLabel,
    mode,
    allowPaid: mode === 'full',
    metricFixturesPath: flags['tts-metric-fixtures'] ? resolve(flags['tts-metric-fixtures']) : null,
    roundtripDir: flags['tts-roundtrip-dir'] ? resolve(flags['tts-roundtrip-dir']) : null,
    markdownOut: null,
    jsonOut: null,
    keepTemp: flags['tts-keep-temp'] === true,
    audioJudgeModel: flags['tts-audio-judge-model'] ?? DEFAULT_AUDIO_JUDGE_MODEL,
  }

  const { jsonOut, markdownOut, warnings } = await writeVoiceQualityReport(options)

  l.write('info', 'TTS Benchmark Report', {
    category: 'artifact',
    humanTable: createKeyValueTable([
      ['runDir', runDir],
      ['mode', mode],
      ['providers', runJson.metadata.tts.length],
      ['json', jsonOut],
      ['markdown', markdownOut],
      ['warnings', warnings.length],
    ]),
    metadata: {
      runDir,
      mode,
      providerCount: runJson.metadata.tts.length,
      jsonOut,
      markdownOut,
      warningCount: warnings.length,
    },
  })
}
