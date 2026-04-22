import { defineCommand } from 'clerc'
import { ttsFlags } from '~/cli/flags'
import { CLIUsageError } from '~/utils/error-handler'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { runTts } from './run-tts'
import { buildTtsArtifactMap, collectTtsTargets, getTtsArtifactFileName } from './tts-targets'
import { computeActualCosts, computeEstimatedCosts } from '~/utils/pricing/compute-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { runPreflight } from '~/utils/pricing/preflight'
import { buildProviderStepSummaries, createGenerationOutputDir, resolveMaxCentsFromFlags, writeGenerationMetadata } from '~/cli/commands/process-steps/generation-command-utils'
import * as l from '~/logger'
import { runWithLogContext } from '~/logger'

export const ttsCommand = defineCommand({
  name: 'tts',
  description: 'Generate speech audio from a text file (.md or .txt)',
  parameters: [{ key: '<input>', description: 'Path to .md or .txt file' }],
  flags: ttsFlags,
  help: {
    examples: [
      ['bun as tts input/examples/tts/1-tts.md --kitten-tts kitten-tts-nano-0.8-int8', 'Generate speech with local Kitten TTS'],
      ['bun as tts input/examples/tts/1-tts.md --elevenlabs-tts eleven_v3', 'Generate speech with ElevenLabs']
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
  const ttsOptions = buildOptsFromFlags(true, flags as Record<string, unknown>, [], { defaultTtsEngine: 'kitten' }, new Set(), Bun.argv.slice(2))
  const targets = collectTtsTargets(ttsOptions)

  const { shouldExit } = await runPreflight('tts', inputPath, ttsOptions, maxCents, text.length)
  if (shouldExit) {
    l.report.expectedOutput(
      './output/<timestamp>_<label>/',
      [...targets.map((target) => getTtsArtifactFileName(target, targets.length === 1)), 'run.json']
    )
    return
  }

  const baseName = inputPath.replace(/\.[^/.]+$/, '').split('/').pop() || 'tts'
  const outputDir = await createGenerationOutputDir(baseName)

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

  await writeGenerationMetadata(outputDir, 'tts', metadata, cost, timing)

  l.report.complete(
    outputDir,
    {
      ...buildTtsArtifactMap(metadata, 'audio'),
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
