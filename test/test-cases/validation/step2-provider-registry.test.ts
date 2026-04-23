import { expect, test } from 'bun:test'
import {
  collectStep2ProviderSpecs,
  getStep2AllShortcutModelExpansions,
  getStep2BootstrapProviderId,
  getStep2ProviderConfigPathEntries,
  getStep2ProviderFlags,
  getStep2ProviderSelectionFlagNames,
  normalizeStep2ArgvAliases,
  normalizeStep2ProviderFlagName
} from '~/cli/commands/process-steps/step-2-shared/provider-registry'

test('step-2 OCR registry exposes canonical local and hosted provider flags', () => {
  const flags = getStep2ProviderFlags('ocr')
  const selectionFlags = getStep2ProviderSelectionFlagNames('ocr')

  expect(Object.keys(flags)).toEqual([
    'tesseract-ocr',
    'ocrmypdf',
    'paddle-ocr',
    'mistral-ocr',
    'glm-ocr',
    'openai-ocr',
    'anthropic-ocr',
    'gemini-ocr'
  ])
  expect(selectionFlags).toEqual([
    'tesseract-ocr',
    'ocrmypdf',
    'paddle-ocr',
    'mistral-ocr',
    'glm-ocr',
    'openai-ocr',
    'anthropic-ocr',
    'gemini-ocr'
  ])
})

test('step-2 all-shortcut expansions only include repeatable model providers', () => {
  const expansions = getStep2AllShortcutModelExpansions()

  expect(expansions['mistral-ocr']).toEqual({
    shortcut: 'all-ocr',
    supported: ['mistral-ocr-2512']
  })
  expect(expansions['openai-ocr']?.shortcut).toBe('all-ocr')
  expect(expansions['gcloud-stt']?.shortcut).toBe('all-stt')
  expect(expansions['tesseract-ocr']).toBeUndefined()
  expect(expansions['ocrmypdf']).toBeUndefined()
})

test('collectStep2ProviderSpecs preserves canonical OCR ordering and deduplicates repeated models', () => {
  expect(collectStep2ProviderSpecs('ocr', {
    useTesseract: true,
    useOcrmypdf: true,
    usePaddleOcr: true,
    mistralOcrModels: ['mistral-ocr-2512'],
    openaiOcrModels: ['gpt-5.4-nano', 'gpt-5.4-nano', 'gpt-5.4-mini'],
    anthropicOcrModel: 'claude-haiku-4-5'
  })).toEqual([
    { provider: 'tesseract', model: 'tesseract' },
    { provider: 'ocrmypdf', model: 'ocrmypdf' },
    { provider: 'paddle-ocr', model: 'paddle-ocr' },
    { provider: 'mistral-ocr', model: 'mistral-ocr-2512' },
    { provider: 'openai-ocr', model: 'gpt-5.4-nano' },
    { provider: 'openai-ocr', model: 'gpt-5.4-mini' },
    { provider: 'anthropic-ocr', model: 'claude-haiku-4-5' }
  ])
})

test('collectStep2ProviderSpecs honors shared selection origins for STT providers', () => {
  expect(collectStep2ProviderSpecs('stt', {
    useReverb: true,
    whisperModels: ['tiny', 'base'],
    deepgramSttModels: ['nova-3'],
    step2SelectionOrigins: {
      'reverb-stt': 'default',
      'deepgram-stt': 'default'
    }
  })).toEqual([
    { provider: 'reverb', model: 'reverb' },
    { provider: 'deepgram', model: 'nova-3' }
  ])

  expect(collectStep2ProviderSpecs('stt', {
    useReverb: true,
    whisperModels: ['tiny', 'base'],
    deepgramSttModels: ['nova-3'],
    step2SelectionOrigins: {
      'reverb-stt': 'default',
      'deepgram-stt': 'default',
      'whisper-stt': 'explicit'
    }
  })).toEqual([
    { provider: 'reverb', model: 'reverb' },
    { provider: 'deepgram', model: 'nova-3' },
    { provider: 'whisper', model: 'tiny' },
    { provider: 'whisper', model: 'base' }
  ])
})

test('step-2 registry exposes shared bootstrap IDs and config paths', () => {
  expect(getStep2BootstrapProviderId('ocr', 'tesseract')).toBe('tesseract')
  expect(getStep2BootstrapProviderId('ocr', 'openai')).toBe('openai-ocr')
  expect(getStep2BootstrapProviderId('stt', 'reverb')).toBe('reverb')

  const configPaths = Object.fromEntries(
    getStep2ProviderConfigPathEntries().map(({ flagName, configPath }) => [flagName, configPath.join('.')])
  )

  expect(configPaths['reverb-stt']).toBe('defaults.extract.stt.reverb')
  expect(configPaths['tesseract-ocr']).toBe('defaults.extract.ocr.tesseract')
  expect(configPaths['paddle-ocr']).toBe('defaults.extract.ocr.paddleOcr')
})

test('step-2 registry keeps legacy flag aliases normalized to preferred spellings', () => {
  expect(normalizeStep2ProviderFlagName('whisper')).toBe('whisper-stt')
  expect(normalizeStep2ProviderFlagName('reverb')).toBe('reverb-stt')
  expect(normalizeStep2ProviderFlagName('tesseract')).toBe('tesseract-ocr')
  expect(normalizeStep2ArgvAliases(['stt', 'file.mp3', '--whisper', 'base', '--reverb'])).toEqual([
    'stt',
    'file.mp3',
    '--whisper-stt',
    'base',
    '--reverb-stt'
  ])
})
