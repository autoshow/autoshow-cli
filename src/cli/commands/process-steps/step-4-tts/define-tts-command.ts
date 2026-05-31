import { defineCliCommand } from '~/cli/native'
import { ttsCommandFlags } from '~/cli/flags'
import { CLIUsageError } from '~/utils/error-handler'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { extractExplicitFlags } from '~/cli/commands/setup-and-utilities/config/config-merge'
import {
  normalizeLegacyMultiSpeakerFlags,
  normalizeGenericProviderSelectorFlags,
  normalizeGenericTtsOptionFlags,
  STANDALONE_TTS_PROVIDER_TARGETS
} from '~/cli/commands/process-steps/service-selector-normalization'
import { runTts } from './run-tts'
import { buildEstimatedTtsTargets, buildTtsArtifactMap, collectTtsTargets, getTtsArtifactFileName } from './tts-targets'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeEstimatedCosts } from '~/utils/pricing/compute-estimated-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { preflightToEstimated } from '~/utils/pricing/compute-costs'
import { runPreflight } from '~/utils/pricing/preflight'
import { buildProviderStepSummaries, createGenerationOutputDir, getGenerationExpectedOutputDir, resolveMaxCentsFromFlags, writeGenerationMetadata } from '~/cli/commands/process-steps/generation-command-utils'
import * as l from '~/utils/logger'
import { runWithLogContext } from '~/utils/logger'
import {
  isMultiSpeakerRequested,
  normalizeDialogueFromOptions
} from './dialogue-normalizer'

export const ttsCommand = defineCliCommand({
  name: 'tts',
  description: 'Generate speech audio from a text file (.md or .txt)',
  parameters: [{ key: '<input>', description: 'Path to .md or .txt file' }],
  flags: ttsCommandFlags,
  help: {
    examples: [
      ['bun as tts input/examples/tts/1-tts.md --provider kitten=kitten-tts-nano-0.8-int8', 'Generate speech with local Kitten TTS'],
      ['bun as tts input/examples/tts/1-tts.md --provider elevenlabs=eleven_v3', 'Generate speech with ElevenLabs'],
      ['bun as tts input/examples/tts/1-tts.md --provider elevenlabs=eleven_v3 --tts-ref-audio input/examples/audio/anthony-voice.mp3', 'Clone a voice with ElevenLabs IVC'],
      ['bun as tts input/examples/tts/1-tts.md --provider minimax=speech-2.8-turbo --tts-voice English_expressive_narrator', 'Use a MiniMax voice ID'],
      ['bun as tts input/examples/tts/1-tts.md --provider mistral=voxtral-mini-tts-2603 --tts-ref-audio input/examples/audio/anthony-voice.mp3', 'Generate speech with Mistral Voxtral']
    ]
  }
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

  const maxCents = await resolveMaxCentsFromFlags(flags as Record<string, unknown>)
  const rawArgs = Bun.argv.slice(2)
  const explicitFlags = extractExplicitFlags(rawArgs)
  const providerNormalized = normalizeGenericProviderSelectorFlags(
    flags as Record<string, unknown>,
    explicitFlags,
    'provider',
    STANDALONE_TTS_PROVIDER_TARGETS,
    { allProvidersTarget: 'all-tts', rawArgs }
  )
  const ttsNormalized = normalizeGenericTtsOptionFlags(
    providerNormalized.flags,
    providerNormalized.explicitFlags,
    'kitten'
  )
  const legacyNormalized = normalizeLegacyMultiSpeakerFlags(
    ttsNormalized.flags,
    ttsNormalized.explicitFlags
  )
  const ttsOptions = buildOptsFromFlags(
    true,
    legacyNormalized.flags,
    [],
    { defaultTtsEngine: 'kitten' },
    legacyNormalized.explicitFlags,
    providerNormalized.rawArgs ?? rawArgs
  )
  const targets = collectTtsTargets(ttsOptions)
  const dialogueRequested = isMultiSpeakerRequested(ttsOptions)
  const dialoguePreview = dialogueRequested ? normalizeDialogueFromOptions(text, ttsOptions) : undefined
  const ttsCharacterCount = dialoguePreview?.spokenCharacterCount ?? text.length
  const ttsTimingInputText = dialoguePreview
    ? dialoguePreview.turns.map((turn) => turn.text).join('\n')
    : text

  const { estimate: preflightEstimate, shouldExit } = await runPreflight('tts', inputPath, ttsOptions, maxCents, ttsCharacterCount, {
    ttsInputText: ttsTimingInputText
  })
  if (shouldExit) {
    l.report.expectedOutput(
      getGenerationExpectedOutputDir(flags as Record<string, unknown>, './output/<timestamp>_<label>/'),
      dialogueRequested
        ? ['dialogue-normalized.txt', 'segments/', 'speech.wav', 'run.json']
        : [...targets.map((target) => getTtsArtifactFileName(target, targets.length === 1)), 'run.json']
    )
    return
  }

  const baseName = inputPath.replace(/\.[^/.]+$/, '').split('/').pop() || 'tts'
  const outputDir = await createGenerationOutputDir(baseName, flags as Record<string, unknown>)

  const { metadata } = await runWithLogContext({ step: 'step-4-tts' }, async () =>
    await runTts(text, outputDir, ttsOptions)
  )

  const estimatedTtsTargets = buildEstimatedTtsTargets(targets)
  const observedEstimate = computeEstimatedCosts({
    applyCostMultipliers: false,
    ttsTargets: estimatedTtsTargets,
    ttsCharacterCount
  })
  const actual = computeActualCosts({
    step4: metadata,
    ttsCharacterCount
  })
  const cost = {
    estimated: preflightToEstimated(preflightEstimate),
    observedEstimate,
    actual
  }
  const timing = {
    estimated: computeEstimatedProcessingTimes({
      ttsTargets: estimatedTtsTargets,
      ttsCharacterCount,
      ttsInputText: ttsTimingInputText,
      ttsChunkConcurrency: ttsOptions.ttsChunkConcurrency,
    }),
    actual: computeActualProcessingTimes({
      step4: metadata,
      ttsCharacterCount,
    }),
  }

  await writeGenerationMetadata(outputDir, 'tts', metadata, cost, timing, {
    input: text,
    requestedProviders: targets.map((t) => ({ service: t.service, model: t.model }))
  })

  l.report.complete(
    outputDir,
    {
      ...buildTtsArtifactMap(metadata, 'audio'),
      ...(dialogueRequested ? { dialogue: 'dialogue-normalized.txt', segments: 'segments/' } : {}),
      run: 'run.json'
    },
    {
      steps: buildProviderStepSummaries(
        'TTS',
        'tts',
        metadata,
        actual.steps,
        (entry) => `${entry.ttsService}/${entry.ttsModel}`,
        (entry) => entry.processingTime
      ),
      totalTimeMs: metadata.reduce((sum, entry) => sum + entry.processingTime, 0),
      totalCost: actual.totalCost,
      includeOutputDir: false
    }
  )
})
