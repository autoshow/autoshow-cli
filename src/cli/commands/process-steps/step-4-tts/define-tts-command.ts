import { defineCommand } from 'clerc'
import { ttsFlags } from '~/cli/flags'
import { CLIUsageError } from '~/utils/error-handler'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { runTts } from './run-tts'
import {
  validateKittenTtsModel,
  validateElevenlabsTtsModel,
  validateMinimaxTtsModel,
  validateGroqTtsModel,
  validateOpenAITtsModel,
  validateGeminiTtsModel,
  validateGroqTtsVoice,
  validateKittenTtsSpeaker
} from '~/cli/commands/models/model-options'
import { computeActualCosts, computeEstimatedCosts } from '~/utils/pricing/compute-costs'
import { runPreflight } from '~/utils/pricing/preflight'
import { ensureDirectory } from '~/utils/cli-utils'
import { createUniqueDirectoryName } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { resolveConfigPath, loadConfig } from '~/cli/commands/config/config-loader'
import * as l from '~/logger'
import { runWithLogContext } from '~/logger'

const DEFAULT_KITTEN_TTS_MODEL = 'kitten-tts-nano-0.8-int8'
const DEFAULT_KITTEN_TTS_SPEAKER = 'Jasper'

export const ttsCommand = defineCommand({
  name: 'tts',
  description: 'Generate speech audio from a text file (.md or .txt)',
  parameters: [{ key: '<input>', description: 'Path to .md or .txt file' }],
  flags: ttsFlags
}, async (ctx) => {
  const inputPath = ctx.parameters.input
  const flags = ctx.flags

  if (!inputPath.endsWith('.md') && !inputPath.endsWith('.txt')) {
    throw CLIUsageError(`tts only accepts .md or .txt files. Got: ${inputPath}`)
  }

  const inputFile = Bun.file(inputPath)
  if (!await inputFile.exists()) {
    throw CLIUsageError(`File not found: ${inputPath}`)
  }

  const text = await inputFile.text()
  if (!text.trim()) {
    throw CLIUsageError(`Input file is empty: ${inputPath}`)
  }

  const kittenModelRaw = typeof flags['kitten-tts'] === 'string' ? flags['kitten-tts'] : undefined
  const elevenlabsModelRaw = typeof flags['elevenlabs-tts'] === 'string' ? flags['elevenlabs-tts'] : undefined
  const minimaxModelRaw = typeof flags['minimax-tts'] === 'string' ? flags['minimax-tts'] : undefined
  const minimaxVoiceRaw = typeof flags['minimax-tts-voice'] === 'string' ? flags['minimax-tts-voice'] : undefined
  const groqModelRaw = typeof flags['groq-tts'] === 'string' ? flags['groq-tts'] : undefined
  const groqVoiceRaw = typeof flags['groq-voice'] === 'string' ? flags['groq-voice'] : undefined
  const openaiModelRaw = typeof flags['openai-tts'] === 'string' ? flags['openai-tts'] : undefined
  const openaiVoiceRaw = typeof flags['openai-voice'] === 'string' ? flags['openai-voice'] : undefined
  const geminiModelRaw = typeof flags['gemini-tts'] === 'string' ? flags['gemini-tts'] : undefined
  const geminiVoiceRaw = typeof flags['gemini-voice'] === 'string' ? flags['gemini-voice'] : undefined

  const engineCount = [kittenModelRaw, elevenlabsModelRaw, minimaxModelRaw, groqModelRaw, openaiModelRaw, geminiModelRaw].filter(Boolean).length
  if (engineCount > 1) {
    throw CLIUsageError('Cannot use more than one TTS engine at the same time (--kitten-tts, --elevenlabs-tts, --minimax-tts, --groq-tts, --openai-tts, --gemini-tts)')
  }

  const configPathOverride = typeof flags['config-path'] === 'string' ? flags['config-path'] : undefined
  const resolvedConfigPath = await resolveConfigPath(configPathOverride)
  const config = await loadConfig(resolvedConfigPath)
  const maxCents = config.pricing?.maxCents ?? (config.pricing?.maxUsd !== undefined ? config.pricing.maxUsd * 100 : undefined)
  const ttsOpts = buildOptsFromFlags(true, flags as Record<string, unknown>, [], { defaultTtsEngine: 'kitten' })
  const { shouldExit } = await runPreflight('tts', inputPath, ttsOpts, maxCents, text.length)
  if (shouldExit) {
    l.report.expectedOutput('./output/<timestamp>_<label>/', ['speech.wav', 'metadata.json'])
    return
  }

  const baseName = inputPath.replace(/\.[^/.]+$/, '').split('/').pop() || 'tts'
  const uniqueDirName = createUniqueDirectoryName(baseName)
  const outputDir = `./output/${uniqueDirName}`
  await ensureDirectory(outputDir)
  l.info(`Output directory: ${outputDir}`)

  let ttsOptions: Parameters<typeof runTts>[2]

  if (kittenModelRaw || engineCount === 0) {
    const model = validateKittenTtsModel(kittenModelRaw ?? DEFAULT_KITTEN_TTS_MODEL)

    const rawSpeaker = typeof flags['tts-speaker'] === 'string' ? flags['tts-speaker'] : DEFAULT_KITTEN_TTS_SPEAKER
    const speakerRaw = rawSpeaker === 'Ryan' ? DEFAULT_KITTEN_TTS_SPEAKER : rawSpeaker
    const speaker = validateKittenTtsSpeaker(speakerRaw)

    ttsOptions = {
      kittenTtsModel: model,
      ttsSpeaker: speaker
    }
  } else if (elevenlabsModelRaw) {
    const model = validateElevenlabsTtsModel(elevenlabsModelRaw)
    const voiceIdRaw = typeof flags['elevenlabs-voice'] === 'string' ? flags['elevenlabs-voice'].trim() : undefined

    ttsOptions = {
      elevenlabsTtsModel: model,
      elevenlabsVoiceId: voiceIdRaw && voiceIdRaw.length > 0 ? voiceIdRaw : undefined
    }
  } else if (minimaxModelRaw) {
    const model = validateMinimaxTtsModel(minimaxModelRaw)
    ttsOptions = {
      minimaxTtsModel: model,
      minimaxTtsVoice: minimaxVoiceRaw
    }
  } else if (groqModelRaw) {
    const model = validateGroqTtsModel(groqModelRaw)
    const voiceRaw = groqVoiceRaw?.trim()
    const voice = voiceRaw && voiceRaw.length > 0 ? validateGroqTtsVoice(voiceRaw) : undefined
    ttsOptions = {
      groqTtsModel: model,
      groqVoiceId: voice
    }
  } else if (openaiModelRaw) {
    const model = validateOpenAITtsModel(openaiModelRaw)
    const voiceRaw = openaiVoiceRaw?.trim()
    ttsOptions = {
      openaiTtsModel: model,
      openaiVoiceId: voiceRaw && voiceRaw.length > 0 ? voiceRaw : undefined
    }
  } else if (geminiModelRaw) {
    const model = validateGeminiTtsModel(geminiModelRaw)
    const voiceRaw = geminiVoiceRaw?.trim()
    ttsOptions = {
      geminiTtsModel: model,
      geminiVoiceId: voiceRaw && voiceRaw.length > 0 ? voiceRaw : undefined
    }
  } else {
    throw new Error('Unreachable TTS engine selection')
  }

  const { audioPath, metadata } = await runWithLogContext({ step: 'step-4-tts' }, async () =>
    await runTts(text, outputDir, ttsOptions)
  )

  const ttsService = metadata.ttsService
  const ttsModel = metadata.ttsModel

  const estimated = computeEstimatedCosts({ ttsService, ttsModel, ttsCharacterCount: text.length })
  const actual = computeActualCosts({
    step4: metadata,
    ttsCharacterCount: text.length
  })
  const cost = { estimated, actual }

  const metadataPath = `${outputDir}/metadata.json`
  await Bun.write(metadataPath, JSON.stringify({ tts: metadata, cost }, null, 2))

  l.report.complete(
    outputDir,
    { audio: audioPath.split('/').pop() as string, metadata: 'metadata.json' },
    { metrics: { chunks: String(metadata.chunkCount), approxDuration: `${(metadata.audioFileSize / (metadata.chunkCount * 1000)).toFixed(1)}s` } }
  )
})
