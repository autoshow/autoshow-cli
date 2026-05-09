import type { AggregatedPriceEstimate, ProcessCommand, RuntimeOptions, StepEstimate } from '~/types'
import { isExtractCommand } from '~/cli/commands/process-steps/process-command-kinds'
import { resolveInputRoutingForCommand } from '~/cli/commands/process-steps/step-1-download/targets/target-utils'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { SUPADATA_STT_AGGREGATE_NOTE } from '~/utils/pricing/supadata-pricing'
import { buildArticleEstimates } from './aggregate-pricing/article-estimates'
import { buildExtractEstimates } from './aggregate-pricing/extract-estimates'
import { buildImageEstimates, buildMusicEstimates, buildVideoEstimates } from './aggregate-pricing/generation-estimates'
import { buildLlmEstimates } from './aggregate-pricing/llm-estimates'
import { buildSttEstimates } from './aggregate-pricing/stt-estimates'
import { buildAggregateTiming } from './aggregate-pricing/timing'
import { buildTtsEstimates, estimateTtsCharacterCountFromPrompts } from './aggregate-pricing/tts-estimates'

export const buildAggregatedPriceEstimate = async (
  command: ProcessCommand,
  resolvedTarget: string,
  opts: RuntimeOptions,
  characterCount?: number
): Promise<AggregatedPriceEstimate> => {
  const steps: StepEstimate[] = []
  let totalEstimatedCost = 0
  let ttsTimingCharacterCount: number | undefined
  const notes: string[] = []

  const addStep = (step: StepEstimate): void => {
    steps.push(step)
    totalEstimatedCost += step.totalCost
  }

  const routing = await resolveInputRoutingForCommand(command === 'download' || command === 'metadata' ? 'write' : command, resolvedTarget, opts)
  const documentTarget = routing.family === 'document' || routing.family === 'html_article'
  const resolvedStep2 = routing.resolvedStep2
  const extractRoute = routing.extractRoute
  const textInputWrite = command === 'write' && opts.textInput
  const documentWrite = command === 'write' && documentTarget && !textInputWrite
  const isRemoteTarget = /^https?:\/\//i.test(resolvedTarget)

  if (!textInputWrite && ((isExtractCommand(command) && extractRoute === 'media') || (command === 'write' && !documentWrite))) {
    for (const stt of await buildSttEstimates(resolvedTarget, opts)) {
      addStep(stt)
      if (typeof stt.note === 'string' && stt.note.length > 0) {
        notes.push(stt.note)
      }
    }
  }

  if (!textInputWrite && ((isExtractCommand(command) && extractRoute === 'document') || documentWrite) && resolvedStep2.route === 'ocr') {
    for (const extract of await buildExtractEstimates(resolvedTarget, resolvedStep2, opts)) {
      addStep(extract)
    }
  }

  if (resolvedStep2.route === 'article') {
    const article = buildArticleEstimates(resolvedStep2, opts, isRemoteTarget)
    for (const estimate of article.estimates) {
      addStep(estimate)
    }
    notes.push(...article.notes)
  }

  if (command === 'write') {
    const llmEstimates = await buildLlmEstimates(opts, false)
    for (const llm of llmEstimates) {
      addStep(llm)
    }

    const selectedTtsTargets = collectTtsTargets(opts)
    if (selectedTtsTargets.length > 0) {
      if (llmEstimates.length === 1) {
        const estimatedTtsCharacterCount = await estimateTtsCharacterCountFromPrompts(opts)
        ttsTimingCharacterCount = estimatedTtsCharacterCount
        const ttsEstimates = await buildTtsEstimates(opts, estimatedTtsCharacterCount)
        for (const tts of ttsEstimates) {
          addStep(tts)
        }
      } else {
        notes.push(
          llmEstimates.length > 1
            ? `TTS estimate omitted: step 4 only runs when write produces exactly one summary, but ${llmEstimates.length} LLM providers are selected.`
            : 'TTS estimate omitted: step 4 only runs when write produces exactly one summary, and this run skips summary generation.'
        )
      }
    }

    for (const image of buildImageEstimates(opts)) {
      addStep(image)
    }

    for (const video of buildVideoEstimates(opts)) {
      addStep(video)
    }

    for (const music of await buildMusicEstimates(opts)) {
      addStep(music)
    }
  }

  if (command === 'tts') {
    ttsTimingCharacterCount = typeof characterCount === 'number' ? characterCount : 0
    const ttsEstimates = await buildTtsEstimates(opts, ttsTimingCharacterCount)
    for (const tts of ttsEstimates) {
      addStep(tts)
    }
  }

  if (command === 'image') {
    for (const image of buildImageEstimates(opts)) {
      addStep(image)
    }
  }

  if (command === 'video') {
    for (const video of buildVideoEstimates(opts)) {
      addStep(video)
    }
  }

  if (command === 'music') {
    for (const music of await buildMusicEstimates(opts)) {
      addStep(music)
    }
  }

  if (steps.some((step) => step.step === 'stt' && step.provider === 'supadata')) {
    notes.push(SUPADATA_STT_AGGREGATE_NOTE)
  }

  const timing = buildAggregateTiming(steps, ttsTimingCharacterCount)

  return {
    steps,
    totalEstimatedCost,
    ...(timing && timing.steps.length > 0 ? { timing } : {}),
    ...(notes.length > 0 ? { notes } : {})
  }
}
