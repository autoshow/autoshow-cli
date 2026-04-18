import { describe, expect, test } from 'bun:test'
import * as v from 'valibot'
import type { Step3Metadata } from '~/types'
import { runCompatFallback } from '~/cli/commands/process-steps/step-3-write/structured-output/compat-fallback'
import { parseAndValidateStructured } from '~/cli/commands/process-steps/step-3-write/structured-output/validator'
import { getStructuredCapability, resolveStructuredStrategy, shouldApplyStrictMode } from '~/cli/commands/process-steps/step-3-write/structured-output/capabilities'
import { renderToPlainText } from '~/cli/commands/process-steps/step-3-write/structured-output/renderers'
import { getStructuredPresetSchema, hasStructuredPreset } from '~/cli/commands/process-steps/step-3-write/structured-output/preset-registry'
import { resolveStructuredSchema } from '~/cli/commands/process-steps/step-3-write/structured-output/schema-resolver'

const compatMetadata: Step3Metadata = {
  llmService: 'llama.cpp',
  llmModel: 'ggml-org/Qwen3-0.6B-GGUF',
  processingTime: 123,
  inputTokenCount: 45,
  outputTokenCount: 67,
  outputFileName: 'text.json',
  outputFormat: 'json',
  structuredMode: 'schema-guided',
  structuredPresetNames: ['shortSummary', 'longSummary', 'chapters']
}

describe('parseAndValidateStructured', () => {
  const TestSchema = v.object({
    title: v.string(),
    count: v.number()
  })

  test('parses valid JSON', () => {
    const result = parseAndValidateStructured(TestSchema, '{"title": "hello", "count": 5}')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.value).toEqual({ title: 'hello', count: 5 })
    }
  })

  test('strips markdown code fences before parsing', () => {
    const result = parseAndValidateStructured(TestSchema, '```json\n{"title": "hello", "count": 5}\n```')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.value).toEqual({ title: 'hello', count: 5 })
    }
  })

  test('strips bare code fences without language tag', () => {
    const result = parseAndValidateStructured(TestSchema, '```\n{"title": "test", "count": 1}\n```')
    expect(result.success).toBe(true)
  })

  test('extracts JSON from surrounding text', () => {
    const result = parseAndValidateStructured(TestSchema, 'Here is the result: {"title": "extracted", "count": 0} done.')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.value).toEqual({ title: 'extracted', count: 0 })
    }
  })

  test('returns failure for completely invalid JSON', () => {
    const result = parseAndValidateStructured(TestSchema, 'this is not json at all')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.issue).toContain('not valid JSON')
    }
  })

  test('returns failure when JSON is valid but schema fails', () => {
    const result = parseAndValidateStructured(TestSchema, '{"title": 123, "count": "not a number"}')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.issue).toBeDefined()
    }
  })

  test('returns failure for missing required fields', () => {
    const result = parseAndValidateStructured(TestSchema, '{"title": "hello"}')
    expect(result.success).toBe(false)
  })
})

describe('getStructuredCapability', () => {
  test('openai has native structured output and strict mode', () => {
    const cap = getStructuredCapability('openai')
    expect(cap.nativeStructuredOutput).toBe(true)
    expect(cap.strictMode).toBe(true)
  })

  test('anthropic has native output but no strict mode', () => {
    const cap = getStructuredCapability('anthropic')
    expect(cap.nativeStructuredOutput).toBe(true)
    expect(cap.strictMode).toBe(false)
  })

  test('minimax does not have native structured output', () => {
    const cap = getStructuredCapability('minimax')
    expect(cap.nativeStructuredOutput).toBe(false)
  })

  test('llama.cpp does not have native structured output', () => {
    const cap = getStructuredCapability('llama.cpp')
    expect(cap.nativeStructuredOutput).toBe(false)
    expect(cap.strictMode).toBe(false)
  })
})

describe('resolveStructuredStrategy', () => {
  test('returns native for providers with native schema output', () => {
    expect(resolveStructuredStrategy('openai')).toBe('native')
  })

  test('returns schema-guided for llama.cpp', () => {
    expect(resolveStructuredStrategy('llama.cpp')).toBe('schema-guided')
  })

  test('returns schema-guided for minimax', () => {
    expect(resolveStructuredStrategy('minimax')).toBe('schema-guided')
  })
})

describe('shouldApplyStrictMode', () => {
  test('returns true for openai when requested', () => {
    expect(shouldApplyStrictMode('openai', true)).toBe(true)
  })

  test('returns false for openai when not requested', () => {
    expect(shouldApplyStrictMode('openai', false)).toBe(false)
  })

  test('returns false for anthropic even when requested', () => {
    expect(shouldApplyStrictMode('anthropic', true)).toBe(false)
  })
})

describe('renderToPlainText', () => {
  test('renders string value directly', () => {
    expect(renderToPlainText('hello world', [])).toBe('hello world')
  })

  test('renders object with content field', () => {
    expect(renderToPlainText({ content: 'the body text' }, [])).toBe('the body text')
  })

  test('renders object fields as markdown headings', () => {
    const result = renderToPlainText({ title: 'My Title', summary: 'A summary' }, [])
    expect(result).toContain('## Title')
    expect(result).toContain('My Title')
    expect(result).toContain('## Summary')
    expect(result).toContain('A summary')
  })

  test('renders arrays as lists', () => {
    const result = renderToPlainText({ items: ['one', 'two', 'three'] }, [])
    expect(result).toContain('- one')
    expect(result).toContain('- two')
    expect(result).toContain('- three')
  })

  test('renders multi-prompt structure sectioned by prompt names', () => {
    const result = renderToPlainText(
      { shortSummary: 'brief', longSummary: 'detailed' },
      ['shortSummary', 'longSummary']
    )
    expect(result).toContain('## Short Summary')
    expect(result).toContain('brief')
    expect(result).toContain('## Long Summary')
    expect(result).toContain('detailed')
  })

  test('renders fallback content envelopes directly even for multi-prompt runs', () => {
    const result = renderToPlainText(
      { content: 'raw model output', _validationError: 'missing chapters' },
      ['shortSummary', 'longSummary', 'chapters']
    )
    expect(result).toBe('raw model output')
  })

  test('handles null/undefined input', () => {
    expect(renderToPlainText(null, [])).toBe('(No output generated)')
    expect(renderToPlainText(undefined, [])).toBe('(No output generated)')
  })
})

describe('runCompatFallback', () => {
  test('falls back to a raw content envelope after invalid JSON exhausts retries', async () => {
    const schema = await resolveStructuredSchema(['default'])
    let attempts = 0

    const result = await runCompatFallback({
      service: 'llama.cpp',
      label: 'llama.cpp',
      model: compatMetadata.llmModel,
      run: async () => {
        attempts += 1
        return {
          result: 'this is not valid json',
          metadata: compatMetadata
        }
      }
    }, 'Prompt text', compatMetadata.llmModel, schema, 2)

    expect(attempts).toBe(3)
    expect(result.metadata).toEqual(compatMetadata)
    expect(result.rawResponse).toBe('this is not valid json')
    expect(result.parsedJson).toEqual({
      content: 'this is not valid json',
      _validationError: 'Response was not valid JSON'
    })
  })

  test('falls back to a raw content envelope after schema validation exhausts retries', async () => {
    const schema = await resolveStructuredSchema(['default'])
    const rawResponse = JSON.stringify({
      shortSummary: {
        episodeDescription: 'Short summary'
      },
      longSummary: {
        episodeSummary: 'Long summary'
      }
    })

    const result = await runCompatFallback({
      service: 'llama.cpp',
      label: 'llama.cpp',
      model: compatMetadata.llmModel,
      run: async () => ({
        result: rawResponse,
        metadata: compatMetadata
      })
    }, 'Prompt text', compatMetadata.llmModel, schema, 1)

    expect(result.rawResponse).toBe(rawResponse)
    expect(result.parsedJson).toMatchObject({
      content: rawResponse
    })
    expect((result.parsedJson as { _validationError?: string })._validationError).toContain('chapters')
  })
})

describe('preset-registry', () => {
  test('hasStructuredPreset returns true for known presets', () => {
    expect(hasStructuredPreset('shortSummary')).toBe(true)
    expect(hasStructuredPreset('chapters')).toBe(true)
    expect(hasStructuredPreset('faq')).toBe(true)
    expect(hasStructuredPreset('blog')).toBe(true)
  })

  test('hasStructuredPreset returns false for unknown presets', () => {
    expect(hasStructuredPreset('nonexistent')).toBe(false)
  })

  test('getStructuredPresetSchema throws for unknown preset', () => {
    expect(() => getStructuredPresetSchema('nonexistent')).toThrow('Unknown structured preset')
  })

  test('shortSummary schema validates correct data', () => {
    const schema = getStructuredPresetSchema('shortSummary')
    const result = v.safeParse(schema, { episodeDescription: 'A show about testing' })
    expect(result.success).toBe(true)
  })

  test('shortSummary schema rejects empty description', () => {
    const schema = getStructuredPresetSchema('shortSummary')
    const result = v.safeParse(schema, { episodeDescription: '' })
    expect(result.success).toBe(false)
  })

  test('chapters schema validates correct data', () => {
    const schema = getStructuredPresetSchema('chapters')
    const result = v.safeParse(schema, {
      chapters: [{ timestamp: '00:00', title: 'Intro', description: 'Opening' }]
    })
    expect(result.success).toBe(true)
  })

  test('faq schema validates correct data', () => {
    const schema = getStructuredPresetSchema('faq')
    const result = v.safeParse(schema, {
      faq: [{ question: 'What?', answer: 'This.' }]
    })
    expect(result.success).toBe(true)
  })
})

describe('resolveStructuredSchema', () => {
  test('falls back to the freeform envelope for prompt-file-only runs', async () => {
    const resolved = await resolveStructuredSchema([], { fallbackToFreeformEnvelope: true })

    expect(resolved.schemaName).toBe('prompt_content')
    expect(resolved.leafPromptNames).toEqual(['content'])
    expect(resolved.presetNames).toEqual(['freeformEnvelope'])
    expect(v.safeParse(resolved.schema, { content: 'Rendered song lyrics' }).success).toBe(true)
  })
})
