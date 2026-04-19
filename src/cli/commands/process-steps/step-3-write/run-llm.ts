import * as l from '~/logger'
import type {
  LLMOptions,
  LLMTarget,
  StructuredRequestOptions,
  StructuredRunResult,
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
import { parseAndValidateStructured } from './structured-output/validator'
import { runCompatFallback } from './structured-output/compat-fallback'
import { renderToPlainText } from './structured-output/renderers'
import { readPromptFileText } from './text-input-utils'

const sanitizeModelName = (model: string): string =>
  model.replace(/[/\\:*?"<>|]/g, '-')

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
  const promptFileOnly = hasPromptFile && promptNames.length === 0
  const promptFileText = await readPromptFileText(options.promptFile)

  const instructionBase = await resolvePromptNames(promptNames, {
    exampleFormat: 'json',
    fallbackToDefault: !promptFileOnly
  })
  const structuredSchema = await resolveStructuredSchema(promptNames, {
    fallbackToFreeformEnvelope: promptFileOnly
  })

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

  const single = targets.length === 1

  const results: StructuredRunResult[] = []
  const failedTargets: string[] = []

  for (const target of targets) {
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
          2
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
        let validation = parseAndValidateStructured(structuredSchema.schema, response.result)

        const shouldRetryValidation = target.service === 'anthropic' || target.service === 'gemini'
        if (!validation.success && shouldRetryValidation) {
          l.warn(`Structured validation retry for ${target.label}/${target.model}: ${validation.issue ?? 'validation failed'}`)
          response = await target.run(prompt, target.model, structuredOpts)
          validation = parseAndValidateStructured(structuredSchema.schema, response.result)
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
      const filePath = `${options.outputDir}/${fileName}`
      await Bun.write(filePath, JSON.stringify(parsedJson, null, 2))

      results.push({
        metadata: {
          ...metadata,
          outputFileName: fileName,
          outputFormat: 'json',
          structuredMode,
          structuredPresetNames: structuredSchema.presetNames
        },
        renderedText,
        parsedJson
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      l.error(`Failed to run ${target.label} model ${target.model}: ${message}`)
      failedTargets.push(`${target.service}/${target.model}: ${message}`)
    }
  }

  if (results.length === 0) {
    const details = failedTargets.length > 0 ? failedTargets.join('; ') : 'No provider produced output'
    throw new Error(`No LLM outputs were generated. ${details}`)
  }

  if (failedTargets.length > 0) {
    l.warn(`LLM run completed with partial failures: ${failedTargets.join('; ')}`)
  }

  return results
}
