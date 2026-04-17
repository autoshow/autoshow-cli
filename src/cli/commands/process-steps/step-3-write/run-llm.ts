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
import { resolveStructuredMode, shouldApplyStrictMode } from './structured-output/capabilities'
import { buildStructuredInstructionSuffix, resolveStructuredSchema } from './structured-output/schema-resolver'
import { parseAndValidateStructured } from './structured-output/validator'
import { runCompatFallback } from './structured-output/compat-fallback'
import { renderToPlainText } from './structured-output/renderers'

const sanitizeModelName = (model: string): string =>
  model.replace(/[/\\:*?"<>|]/g, '-')

const collectTargets = (options: LLMOptions): LLMTarget[] => {
  const targets: LLMTarget[] = []

  if (options.useGemini && options.geminiModel) {
    targets.push({ service: 'gemini', label: 'Gemini', model: options.geminiModel, run: runGeminiModel })
  }

  if (options.useAnthropic && options.anthropicModel) {
    targets.push({ service: 'anthropic', label: 'Anthropic', model: options.anthropicModel, run: runAnthropicModel })
  }

  if (options.useOpenAI && options.openaiModel) {
    targets.push({ service: 'openai', label: 'OpenAI', model: options.openaiModel, run: runOpenAIModel })
  }

  if (options.groqModel) {
    targets.push({ service: 'groq', label: 'Groq', model: options.groqModel, run: runGroqModel })
  }

  if (options.minimaxModel) {
    targets.push({ service: 'minimax', label: 'MiniMax', model: options.minimaxModel, run: runMinimaxModel })
  }

  if (options.grokModel) {
    targets.push({ service: 'grok', label: 'Grok', model: options.grokModel, run: runGrokModel })
  }

  if (options.llamaModel) {
    targets.push({ service: 'llama.cpp', label: 'llama.cpp', model: options.llamaModel, run: runLlamaModel })
  }

  return targets
}

const markdownFallback = '# Summary\n\n(No output generated)\n'

export const runLLM = async (
  meta: VideoMetadata,
  transcription: TranscriptionResult,
  options: LLMOptions,
  slug?: string
): Promise<StructuredRunResult[]> => {
  const structuredEnabled = options.structured !== false
  const targets = collectTargets(options)

  if (targets.length === 0) {
    throw new Error('No LLM provider configured')
  }

  const hasStructuredTarget = targets.some((target) => resolveStructuredMode(target.service, structuredEnabled) !== 'off')
  const instructionBase = await resolvePromptNames(options.prompts ?? [], {
    exampleFormat: structuredEnabled ? 'json' : 'markdown'
  })
  const structuredSchema = hasStructuredTarget
    ? await resolveStructuredSchema(options.prompts ?? [])
    : undefined

  const instruction = structuredSchema
    ? `${instructionBase}\n\n${buildStructuredInstructionSuffix(structuredSchema.leafPromptNames)}`
    : instructionBase

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
      const structuredMode = resolveStructuredMode(target.service, structuredEnabled)

      if (structuredMode === 'off' || !structuredSchema) {
        const response = await target.run(prompt, target.model)
        const text = response.result.trim().length > 0 ? response.result : markdownFallback
        const fileName = single ? 'text.md' : `text-${sanitizeModelName(target.model)}.md`
        const filePath = `${options.outputDir}/${fileName}`
        await Bun.write(filePath, text)

        results.push({
          metadata: {
            ...response.metadata,
            outputFileName: fileName,
            outputFormat: 'markdown',
            structuredMode: 'off',
            structuredPresetNames: []
          },
          renderedText: text,
          parsedJson: text
        })
        continue
      }

      let parsedJson: unknown
      let metadata = undefined as StructuredRunResult['metadata'] | undefined

      if (structuredMode === 'compat') {
        const compatResponse = await runCompatFallback(
          target,
          prompt,
          target.model,
          structuredSchema,
          options.structuredCompatRetries ?? 2
        )
        parsedJson = compatResponse.parsedJson
        metadata = compatResponse.metadata
      } else {
        const structuredOpts: StructuredRequestOptions = {
          schemaName: structuredSchema.schemaName,
          schema: structuredSchema.jsonSchema,
          strict: shouldApplyStrictMode(target.service, options.structuredStrict !== false),
          modeHint: 'native'
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
