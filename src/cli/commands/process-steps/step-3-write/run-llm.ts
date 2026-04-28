import * as l from '~/utils/logger'
import type {
  LLMOptions,
  LLMTarget,
  StructuredRequestOptions,
  StructuredRunResult,
  StructuredValidationContext,
  TranscriptionResult,
  VideoMetadata
} from '~/types'
import { buildPrompt as buildPromptFromUtils } from './write-utils/prompt-utils'
import { resolvePromptNames } from '~/prompts/prompt-loader'
import { runLlamaModel } from './write-local/llama/run-llama'
import { runGroqModel } from './write-services/groq/run-groq'
import { runOpenAIModel } from './write-services/openai/run-openai'
import { runGeminiModel } from './write-services/gemini/run-gemini'
import { runAnthropicModel } from './write-services/anthropic/run-anthropic'
import { runMinimaxModel } from './write-services/minimax/run-minimax'
import { runGrokModel } from './write-services/grok/run-grok'
import { resolveStructuredStrategy, shouldApplyStrictMode } from './structured-output/capabilities'
import { buildStructuredInstructionSuffix, resolveStructuredSchema } from './structured-output/schema-resolver'
import { isSongLyricsPreset } from './structured-output/preset-registry'
import { parseAndValidateStructured } from './structured-output/validator'
import { runCompatFallback } from './structured-output/compat-fallback'
import { renderToPlainText } from './structured-output/renderers'
import { readPromptFile } from './text-input-utils'
import { runLlmProviderTargetPools } from './llm-provider-pool'

const sanitizeModelName = (model: string): string =>
  model.replace(/[/\\:*?"<>|]/g, '-')

type PendingStructuredRunResult = StructuredRunResult & {
  fileName: string
}

const collectTargets = (options: LLMOptions): LLMTarget[] => {
  const targets: LLMTarget[] = []
  const appendTargets = (
    service: LLMTarget['service'],
    label: string,
    models: string[] | undefined,
    fallback: string | undefined,
    run: LLMTarget['run']
  ): void => {
    for (const model of models ?? (fallback ? [fallback] : [])) {
      targets.push({ service, label, model, run })
    }
  }

  appendTargets('gemini', 'Gemini', options.geminiModels, options.geminiModel, runGeminiModel)
  appendTargets('anthropic', 'Anthropic', options.anthropicModels, options.anthropicModel, runAnthropicModel)
  appendTargets('openai', 'OpenAI', options.openaiModels, options.openaiModel, runOpenAIModel)
  appendTargets('groq', 'Groq', options.groqModels, options.groqModel, runGroqModel)
  appendTargets('minimax', 'MiniMax', options.minimaxModels, options.minimaxModel, runMinimaxModel)
  appendTargets('grok', 'Grok', options.grokModels, options.grokModel, runGrokModel)
  appendTargets('llama.cpp', 'llama.cpp', options.llamaModels, options.llamaModel, runLlamaModel)

  return targets
}

export const runLLM = async (
  meta: VideoMetadata,
  transcription: TranscriptionResult,
  options: LLMOptions,
  slug?: string
): Promise<StructuredRunResult[]> => {
  const targets = collectTargets(options)

  if (targets.length === 0) {
    throw new Error('No LLM provider configured')
  }

  const promptNames = options.prompts ?? []
  const hasPromptFile = typeof options.promptFile === 'string' && options.promptFile.length > 0
  const promptFileResult = await readPromptFile(options.promptFile)
  const isJsonPromptFile = promptFileResult?.kind === 'leaf'
  const promptFileOnly = hasPromptFile && promptNames.length === 0

  let promptFileText: string | undefined
  const extraLeaves: import('~/types').ResolvedLeafPrompt[] = []

  if (isJsonPromptFile) {
    const { leaf, name } = promptFileResult
    const leafInstruction = leaf.instruction.trim()
    const leafExample = leaf.examples.json.trim()
    const sections = [leafInstruction]
    if (leafExample.length > 0) {
      sections.push(`Example JSON output:\n\n${leafExample}`)
    }
    promptFileText = sections.join('\n\n')
    extraLeaves.push({ name, entry: leaf })
  } else if (promptFileResult?.kind === 'text') {
    promptFileText = promptFileResult.text
  }

  const instructionBase = await resolvePromptNames(promptNames, {
    exampleFormat: 'json',
    fallbackToDefault: !promptFileOnly
  })
  const structuredSchema = await resolveStructuredSchema(promptNames, {
    fallbackToFreeformEnvelope: promptFileOnly && !isJsonPromptFile,
    extraLeaves: extraLeaves.length > 0 ? extraLeaves : undefined
  })
  const songLyricsTitle = options.structuredContext?.songLyricsTitle ?? meta.title
  const normalizedSongLyricsTitle = songLyricsTitle.trim()
  const structuredValidationContext: StructuredValidationContext = {
    leafPromptNames: structuredSchema.leafPromptNames,
    presetNames: structuredSchema.presetNames,
    ...(structuredSchema.presetNames.some(isSongLyricsPreset) && normalizedSongLyricsTitle.length > 0
      ? { songLyricsTitle: normalizedSongLyricsTitle }
      : {})
  }

  const instructionSections = [
    promptFileText,
    instructionBase,
    buildStructuredInstructionSuffix(structuredSchema.leafPromptNames)
  ].filter((section): section is string => typeof section === 'string' && section.trim().length > 0)
  const instruction = instructionSections.join('\n\n')

  const prompt = options.promptBuilder
    ? options.promptBuilder(instruction)
    : buildPromptFromUtils(meta, transcription, instruction, slug)
  const promptPath = `${options.outputDir}/prompt.md`
  await Bun.write(promptPath, prompt)

  if (options.promptMd) {
    let mdPromptFileText: string | undefined
    if (isJsonPromptFile) {
      const { leaf } = promptFileResult
      const leafInstruction = leaf.instruction.trim()
      const leafExample = leaf.examples.markdown.trim()
      const mdSections = [leafInstruction]
      if (leafExample.length > 0) {
        mdSections.push(`Format the output like so:\n\n${leafExample}`)
      }
      mdPromptFileText = mdSections.join('\n\n')
    } else if (promptFileResult?.kind === 'text') {
      mdPromptFileText = promptFileResult.text
    }

    const mdInstructionBase = await resolvePromptNames(promptNames, {
      exampleFormat: 'markdown',
      fallbackToDefault: !promptFileOnly
    })

    const mdInstructionSections = [
      mdPromptFileText,
      mdInstructionBase
    ].filter((section): section is string => typeof section === 'string' && section.trim().length > 0)
    const mdInstruction = mdInstructionSections.join('\n\n')

    const mdPrompt = options.promptBuilder
      ? options.promptBuilder(mdInstruction)
      : buildPromptFromUtils(meta, transcription, mdInstruction, slug)
    await Bun.write(`${options.outputDir}/prompt-md.md`, mdPrompt)
  }

  const single = targets.length === 1

  const resultsByTargetIndex: Array<PendingStructuredRunResult | undefined> = []
  const failedTargetsByIndex: Array<string | undefined> = []

  await runLlmProviderTargetPools(targets, {
    provider: options.llmProviderConcurrency ?? 2,
    local: options.llmLocalConcurrency ?? 1
  }, async (index, target) => {
    try {
      const structuredMode = resolveStructuredStrategy(target.service)

      let parsedJson: unknown
      let metadata = undefined as StructuredRunResult['metadata'] | undefined

      if (structuredMode === 'schema-guided') {
        const compatResponse = await runCompatFallback(
          target,
          prompt,
          target.model,
          structuredSchema,
          2,
          structuredValidationContext
        )
        parsedJson = compatResponse.parsedJson
        metadata = compatResponse.metadata
      } else {
        const structuredOpts: StructuredRequestOptions = {
          schemaName: structuredSchema.schemaName,
          schema: structuredSchema.jsonSchema,
          strict: shouldApplyStrictMode(target.service, true),
          strategy: 'native'
        }

        let response = await target.run(prompt, target.model, structuredOpts)
        let validation = parseAndValidateStructured(structuredSchema.schema, response.result, structuredValidationContext)

        const shouldRetryValidation = target.service === 'anthropic' || target.service === 'gemini'
        if (!validation.success && shouldRetryValidation) {
          l.warn(`Structured validation retry for ${target.label}/${target.model}: ${validation.issue ?? 'validation failed'}`)
          response = await target.run(prompt, target.model, structuredOpts)
          validation = parseAndValidateStructured(structuredSchema.schema, response.result, structuredValidationContext)
        }

        if (validation.success) {
          parsedJson = validation.value
        } else {
          const issue = validation.issue ?? 'Schema validation failed'
          l.warn(`Structured validation fallback for ${target.label}/${target.model}: ${issue}`)
          parsedJson = {
            _raw: response.result,
            _validationError: issue
          }
        }

        metadata = response.metadata
      }

      const renderedText = renderToPlainText(parsedJson, structuredSchema.leafPromptNames)
      const fileName = single ? 'text.json' : `text-${sanitizeModelName(target.model)}.json`

      resultsByTargetIndex[index] = {
        fileName,
        metadata: {
          ...metadata,
          outputFileName: fileName,
          outputFormat: 'json',
          structuredMode,
          structuredPresetNames: structuredSchema.presetNames
        },
        renderedText,
        parsedJson
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      l.error(`Failed to run ${target.label} model ${target.model}: ${message}`)
      failedTargetsByIndex[index] = `${target.service}/${target.model}: ${message}`
    }
  })

  const results = resultsByTargetIndex.filter((result): result is PendingStructuredRunResult => result !== undefined)
  const failedTargets = failedTargetsByIndex.filter((failure): failure is string => failure !== undefined)

  if (results.length === 0) {
    const details = failedTargets.length > 0 ? failedTargets.join('; ') : 'No provider produced output'
    throw new Error(`No LLM outputs were generated. ${details}`)
  }

  for (const result of results) {
    const filePath = `${options.outputDir}/${result.fileName}`
    await Bun.write(filePath, JSON.stringify(result.parsedJson, null, 2))
  }

  if (failedTargets.length > 0) {
    l.warn(`LLM run completed with partial failures: ${failedTargets.join('; ')}`)
  }

  return results.map((result) => ({
    metadata: result.metadata,
    renderedText: result.renderedText,
    parsedJson: result.parsedJson
  }))
}
