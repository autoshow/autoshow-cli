import { defineCliCommand } from '~/cli/native'
import { ttsCommandFlags } from '~/cli/flags'
import { TTS_COMMAND_SELECTOR_FLAGS } from '~/cli/flags/tts-flags'
import { CLIUsageError } from '~/utils/error-handler'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { extractExplicitFlags } from '~/cli/commands/setup-and-utilities/config/config-merge'
import { normalizeCommandSelectorFlags } from '~/cli/commands/process-steps/service-selector-normalization'
import { runTts } from './run-tts'
import { buildEstimatedTtsTargets, buildTtsArtifactMap, collectTtsTargets, getTtsArtifactFileName } from './tts-targets'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeEstimatedCosts } from '~/utils/pricing/compute-estimated-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { runPreflight } from '~/utils/pricing/preflight'
import { buildProviderStepSummaries, createGenerationOutputDir, resolveMaxCentsFromFlags, writeGenerationMetadata } from '~/cli/commands/process-steps/generation-command-utils'
import * as l from '~/utils/logger'
import { runWithLogContext } from '~/utils/logger'
import { readEnv } from '~/utils/validate/env-utils'
import { ensureElevenLabsTtsSetup } from './tts-services/elevenlabs/elevenlabs-tts'
import {
  isElevenLabsTtsPvcSetupRequested,
  runElevenLabsTtsPvcSetup,
  writeElevenLabsTtsPvcStatusArtifact
} from './tts-services/elevenlabs/elevenlabs-pvc'
import { writeRunManifest } from '~/cli/commands/process-steps/manifest-utils'
import type { TtsOptions } from '~/types'
import {
  isDialogueTtsRequested,
  normalizeDialogueFromOptions
} from './dialogue-normalizer'

const clearElevenLabsPvcSetupOptions = <T extends TtsOptions>(
  options: T,
  pvcVoiceId: string
): T => ({
  ...options,
  elevenlabsTtsPvcVoice: pvcVoiceId,
  elevenlabsTtsPvcSamples: undefined,
  elevenlabsTtsPvcSampleDir: undefined,
  elevenlabsTtsPvcLanguage: undefined,
  elevenlabsTtsPvcDescription: undefined,
  elevenlabsTtsPvcCaptchaOut: undefined,
  elevenlabsTtsPvcVerifyAudio: undefined,
  elevenlabsTtsPvcWait: false
} as T)

export const ttsCommand = defineCliCommand({
  name: 'tts',
  description: 'Generate speech audio from a text file (.md or .txt)',
  parameters: [{ key: '<input>', description: 'Path to .md or .txt file' }],
  flags: ttsCommandFlags,
  help: {
    examples: [
      ['bun as tts input/examples/tts/1-tts.md --kitten kitten-tts-nano-0.8-int8', 'Generate speech with local Kitten TTS'],
      ['bun as tts input/examples/tts/1-tts.md --elevenlabs eleven_v3', 'Generate speech with ElevenLabs'],
      ['bun as tts input/examples/tts/1-tts.md --elevenlabs eleven_v3 --elevenlabs-tts-ref-audio input/examples/audio/anthony-voice.mp3', 'Clone a voice with ElevenLabs IVC'],
      ['bun as tts input/examples/tts/1-tts.md --elevenlabs eleven_v3 --elevenlabs-tts-pvc-voice pvc_voice_123', 'Generate speech with an ElevenLabs PVC voice'],
      ['bun as tts input/examples/tts/1-tts.md --minimax speech-2.8-turbo --minimax-tts-voice English_expressive_narrator', 'Use a MiniMax voice ID'],
      ['bun as tts input/examples/tts/1-tts.md --mistral voxtral-mini-tts-2603 --mistral-tts-ref-audio input/examples/audio/anthony-voice.mp3', 'Generate speech with Mistral Voxtral'],
      ['bun as tts input/examples/tts/1-tts.md --deapi Qwen3_TTS_12Hz_1_7B_Base --deapi-tts-ref-audio input/examples/audio/0-audio-short.mp3', 'Clone a voice with deAPI']
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
  const explicitFlags = extractExplicitFlags(Bun.argv.slice(2))
  const normalized = normalizeCommandSelectorFlags(flags as Record<string, unknown>, explicitFlags, TTS_COMMAND_SELECTOR_FLAGS)
  const ttsOptions = buildOptsFromFlags(true, normalized.flags, [], { defaultTtsEngine: 'kitten' }, normalized.explicitFlags, Bun.argv.slice(2))
  const targets = collectTtsTargets(ttsOptions)
  const pvcSetupRequested = isElevenLabsTtsPvcSetupRequested(ttsOptions)
  const dialogueRequested = isDialogueTtsRequested(ttsOptions)
  const dialoguePreview = dialogueRequested ? normalizeDialogueFromOptions(text, ttsOptions) : undefined
  const ttsCharacterCount = dialoguePreview?.spokenCharacterCount ?? text.length

  const { shouldExit } = await runPreflight('tts', inputPath, ttsOptions, maxCents, ttsCharacterCount)
  if (shouldExit) {
    l.report.expectedOutput(
      './output/<timestamp>_<label>/',
      dialogueRequested
        ? ['dialogue-normalized.txt', 'segments/', 'speech.wav', 'run.json']
        : pvcSetupRequested && ttsOptions.elevenlabsTtsPvcWait !== true
          ? ['elevenlabs-pvc-status.json', 'run.json']
          : [...targets.map((target) => getTtsArtifactFileName(target, targets.length === 1)), 'run.json']
    )
    return
  }

  const baseName = inputPath.replace(/\.[^/.]+$/, '').split('/').pop() || 'tts'
  const outputDir = await createGenerationOutputDir(baseName)

  let effectiveTtsOptions = ttsOptions
  let effectiveTargets = targets
  let pvcStatusFileName: string | undefined
  if (pvcSetupRequested) {
    const apiKey = readEnv('ELEVENLABS_API_KEY')
    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY environment variable is required for ElevenLabs PVC setup')
    }
    const elevenLabsTarget = targets.find((target) => target.service === 'elevenlabs')
    if (!elevenLabsTarget) {
      throw CLIUsageError('ElevenLabs PVC setup requires --elevenlabs-tts <model>.')
    }
    await ensureElevenLabsTtsSetup()
    const baseURL = readEnv('ELEVENLABS_BASE_URL') ?? 'https://api.elevenlabs.io/v1'
    const setupResult = await runWithLogContext({ step: 'step-4-tts' }, async () =>
      await runElevenLabsTtsPvcSetup(baseURL, apiKey, {
        model: elevenLabsTarget.model,
        pvcVoiceId: ttsOptions.elevenlabsTtsPvcVoice,
        samplePaths: ttsOptions.elevenlabsTtsPvcSamples,
        sampleDir: ttsOptions.elevenlabsTtsPvcSampleDir,
        voiceName: ttsOptions.elevenlabsTtsVoiceName,
        language: ttsOptions.elevenlabsTtsPvcLanguage,
        description: ttsOptions.elevenlabsTtsPvcDescription,
        captchaOut: ttsOptions.elevenlabsTtsPvcCaptchaOut,
        verifyAudioPath: ttsOptions.elevenlabsTtsPvcVerifyAudio,
        wait: ttsOptions.elevenlabsTtsPvcWait
      })
    )
    const statusArtifact = await writeElevenLabsTtsPvcStatusArtifact(outputDir, setupResult)
    pvcStatusFileName = statusArtifact.statusFileName

    if (ttsOptions.elevenlabsTtsPvcWait !== true || !setupResult.readyForSynthesis) {
      await writeRunManifest(outputDir, 'tts', {
        elevenlabsPvc: statusArtifact,
        input: text,
        requestedProviders: targets.map((t) => ({ service: t.service, model: t.model }))
      })
      l.report.complete(
        outputDir,
        {
          elevenlabsPvc: statusArtifact.statusFileName,
          ...(statusArtifact.captchaPath ? { captcha: statusArtifact.captchaPath } : {}),
          run: 'run.json'
        },
        {
          steps: [],
          totalTimeMs: 0,
          totalCost: 0
        }
      )
      return
    }

    effectiveTtsOptions = clearElevenLabsPvcSetupOptions(ttsOptions, setupResult.voiceId)
    effectiveTargets = collectTtsTargets(effectiveTtsOptions)
  }

  const { metadata } = await runWithLogContext({ step: 'step-4-tts' }, async () =>
    await runTts(text, outputDir, effectiveTtsOptions)
  )

  const estimatedTtsTargets = buildEstimatedTtsTargets(effectiveTargets)
  const estimated = computeEstimatedCosts({
    applyCostMultipliers: false,
    ttsTargets: estimatedTtsTargets,
    ttsCharacterCount
  })
  const actual = computeActualCosts({
    step4: metadata,
    ttsCharacterCount
  })
  const cost = { estimated, actual }
  const timing = {
    estimated: computeEstimatedProcessingTimes({
      ttsTargets: estimatedTtsTargets,
      ttsCharacterCount,
    }),
    actual: computeActualProcessingTimes({
      step4: metadata,
      ttsCharacterCount,
    }),
  }

  await writeGenerationMetadata(outputDir, 'tts', metadata, cost, timing, {
    input: text,
    requestedProviders: effectiveTargets.map((t) => ({ service: t.service, model: t.model }))
  })

  l.report.complete(
    outputDir,
    {
      ...buildTtsArtifactMap(metadata, 'audio'),
      ...(dialogueRequested ? { dialogue: 'dialogue-normalized.txt', segments: 'segments/' } : {}),
      ...(pvcStatusFileName ? { elevenlabsPvc: pvcStatusFileName } : {}),
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
      totalCost: actual.totalCost
    }
  )
})
