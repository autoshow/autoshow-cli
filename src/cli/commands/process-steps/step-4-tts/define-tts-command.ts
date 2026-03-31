import { defineCommand } from 'clerc'
import { ttsFlags } from '~/cli/flags'
import { CLIUsageError } from '~/utils/error-handler'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { runTts } from './run-tts'
import { collectTtsTargets, getTtsArtifactFileName, sanitizeTtsModelName } from './tts-targets'
import { computeActualCosts, computeEstimatedCosts } from '~/utils/pricing/compute-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { runPreflight } from '~/utils/pricing/preflight'
import { ensureDirectory } from '~/utils/cli-utils'
import { createUniqueDirectoryName } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { resolveConfigPath, loadConfig } from '~/cli/commands/config/config-loader'
import * as l from '~/logger'
import { runWithLogContext } from '~/logger'
import type { Step4Metadata } from '~/types'

const serializeOneOrMany = <T,>(items: T[]): T | T[] => items.length === 1 ? items[0] as T : items

const buildSpeechArtifactMap = (metadata: Step4Metadata[]): Record<string, string> => {
  if (metadata.length === 1) {
    return { audio: metadata[0]!.audioFileName }
  }

  return Object.fromEntries(
    metadata.map((entry) => [
      `speech-${entry.ttsService}-${sanitizeTtsModelName(entry.ttsModel)}`,
      entry.audioFileName
    ])
  )
}

export const ttsCommand = defineCommand({
  name: 'tts',
  description: 'Generate speech audio from a text file (.md or .txt)',
  parameters: [{ key: '<input>', description: 'Path to .md or .txt file' }],
  flags: ttsFlags,
  help: {
    examples: [
      ['bun as tts output/text.md --kitten-tts', 'Generate speech with local Kitten TTS'],
      ['bun as tts output/text.md --elevenlabs-tts', 'Generate speech with ElevenLabs']
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

  const configPathOverride = typeof flags['config-path'] === 'string' ? flags['config-path'] : undefined
  const resolvedConfigPath = await resolveConfigPath(configPathOverride)
  const config = await loadConfig(resolvedConfigPath)
  const maxCents = config.pricing?.maxCents ?? (config.pricing?.maxUsd !== undefined ? config.pricing.maxUsd * 100 : undefined)
  const ttsOptions = buildOptsFromFlags(true, flags as Record<string, unknown>, [], { defaultTtsEngine: 'kitten' })
  const targets = collectTtsTargets(ttsOptions)

  const { shouldExit } = await runPreflight('tts', inputPath, ttsOptions, maxCents, text.length)
  if (shouldExit) {
    l.report.expectedOutput(
      './output/<timestamp>_<label>/',
      [...targets.map((target) => getTtsArtifactFileName(target, targets.length === 1)), 'metadata.json']
    )
    return
  }

  const baseName = inputPath.replace(/\.[^/.]+$/, '').split('/').pop() || 'tts'
  const uniqueDirName = createUniqueDirectoryName(baseName)
  const outputDir = `./output/${uniqueDirName}`
  await ensureDirectory(outputDir)
  l.info(`Output directory: ${outputDir}`)

  const { metadata } = await runWithLogContext({ step: 'step-4-tts' }, async () =>
    await runTts(text, outputDir, ttsOptions)
  )

  const estimatedTtsTargets = targets.map((target) => ({ service: target.service, model: target.model }))
  const estimated = computeEstimatedCosts({
    ttsTargets: estimatedTtsTargets,
    ttsCharacterCount: text.length
  })
  const actual = computeActualCosts({
    step4: metadata,
    ttsCharacterCount: text.length
  })
  const cost = { estimated, actual }
  const timing = {
    estimated: computeEstimatedProcessingTimes({
      ttsTargets: estimatedTtsTargets,
      ttsCharacterCount: text.length,
    }),
    actual: computeActualProcessingTimes({
      step4: metadata,
      ttsCharacterCount: text.length,
    }),
  }

  const metadataPath = `${outputDir}/metadata.json`
  await Bun.write(metadataPath, JSON.stringify({ tts: serializeOneOrMany(metadata), cost, timing }, null, 2))

  const ttsSteps = actual.steps.filter((step) => step.step === 'tts')
  l.report.complete(
    outputDir,
    {
      ...buildSpeechArtifactMap(metadata),
      metadata: 'metadata.json'
    },
    {
      steps: metadata.map((entry, index) => ({
        label: 'TTS',
        providerModel: `${entry.ttsService}/${entry.ttsModel}`,
        processingTime: entry.processingTime,
        cost: ttsSteps[index]?.cost ?? 0
      })),
      totalTimeMs: metadata.reduce((sum, entry) => sum + entry.processingTime, 0),
      totalCost: actual.totalCost
    }
  )
})
