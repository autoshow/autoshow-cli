import { expect, test } from 'bun:test'
import { formatRenderedLlmLabel } from '~/cli/commands/process-steps/step-3-write/text-input-utils'

test('rendered text track headers use model display names', () => {
  expect(formatRenderedLlmLabel({
    llmService: 'gemini',
    llmModel: 'gemini-3.1-pro-preview'
  })).toBe('Gemini 3.1 Pro')

  expect(formatRenderedLlmLabel({
    llmService: 'llama.cpp',
    llmModel: 'ggml-org/gemma-3-270m-it-GGUF'
  })).toBe('Gemma 3 270M Instruct')

  expect(formatRenderedLlmLabel({
    llmService: 'grok',
    llmModel: 'grok-4.20-reasoning'
  })).toBe('Grok 4.2 Reasoning')
})
