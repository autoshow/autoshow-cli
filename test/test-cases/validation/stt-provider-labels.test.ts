import { describe, expect, test } from 'bun:test'
import { buildProviderModelLabel, buildTimingProviderModelLabel } from '~/cli/commands/process-steps/process-stt'

describe('buildProviderModelLabel', () => {
  test('normalizes local whisper model descriptors to the model name', () => {
    expect(buildProviderModelLabel({
      transcriptionService: 'whisper',
      transcriptionModel: '/tmp/runtime/models/whisper/ggml-tiny.bin | coreml:/tmp/runtime/models/whisper/ggml-tiny-encoder.mlmodelc'
    })).toBe('whisper.cpp/tiny')
  })

  test('preserves non-whisper provider/model labels', () => {
    expect(buildProviderModelLabel({
      transcriptionService: 'groq',
      transcriptionModel: 'whisper-large-v3-turbo'
    })).toBe('groq/whisper-large-v3-turbo')
  })

  test('uses a compact whisper timing label without filesystem paths', () => {
    expect(buildTimingProviderModelLabel({
      transcriptionService: 'whisper',
      transcriptionModel: '/tmp/runtime/models/whisper/ggml-tiny.bin | coreml:/tmp/runtime/models/whisper/ggml-tiny-encoder.mlmodelc'
    })).toBe('whisper/ggml-tiny.bin')
  })

  test('reuses the standard label for non-whisper timing rows', () => {
    expect(buildTimingProviderModelLabel({
      transcriptionService: 'groq',
      transcriptionModel: 'whisper-large-v3-turbo'
    })).toBe('groq/whisper-large-v3-turbo')
  })
})
