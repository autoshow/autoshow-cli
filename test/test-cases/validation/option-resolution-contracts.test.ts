import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, truncate, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { collectExplicitOcrTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-targets'
import { runOcrProviderTargetPools, isLocalOcrTarget } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-provider-pool'
import { runLlmProviderTargetPools, isLocalLlmTarget } from '~/cli/commands/process-steps/step-3-write/llm-provider-pool'
import { collectSttTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-targets'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { buildExtractionCallOpts } from '~/cli/commands/process-steps/step-1-download/targets/single/document-write'
import { validateDeapiTtsReferenceAudio } from '~/cli/commands/process-steps/step-4-tts/tts-services/deapi/run-deapi-tts'
import { runElevenLabsTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/elevenlabs/run-elevenlabs-tts'
import {
  createElevenLabsTtsIvcContext,
  ELEVENLABS_TTS_IVC_SETUP_MS,
  validateElevenLabsTtsIvcAudio
} from '~/cli/commands/process-steps/step-4-tts/tts-services/elevenlabs/elevenlabs-ivc'
import {
  ELEVENLABS_TTS_PVC_ENGLISH_SETUP_MS,
  runElevenLabsTtsPvcSetup,
  validateElevenLabsTtsPvcAudio,
  validateElevenLabsTtsPvcSamples,
  writeElevenLabsTtsPvcStatusArtifact
} from '~/cli/commands/process-steps/step-4-tts/tts-services/elevenlabs/elevenlabs-pvc'
import {
  createMinimaxTtsCloneContext,
  MINIMAX_TTS_CLONE_COST_CENTS,
  MINIMAX_TTS_CLONE_SETUP_MS,
  runMinimaxTts,
  validateMinimaxTtsCloneAudio,
  validateMinimaxTtsCloneVoiceId
} from '~/cli/commands/process-steps/step-4-tts/tts-services/minimax/run-minimax-tts'
import { runOpenAITts } from '~/cli/commands/process-steps/step-4-tts/tts-services/openai/run-openai-tts'
import {
  createOpenAITtsCustomVoiceContext,
  OPENAI_TTS_CLONE_SETUP_MS,
  validateOpenAITtsCustomVoiceAudio
} from '~/cli/commands/process-steps/step-4-tts/tts-services/openai/openai-custom-voices'
import {
  SPEECHIFY_TTS_CUSTOM_VOICE_SETUP_MS
} from '~/cli/commands/process-steps/step-4-tts/tts-services/speechify/speechify-custom-voices'
import { getStep2AllShortcutModelExpansions } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'
import { resolveCheapestModelForFlag } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import {
  DEEPGRAM_DEFAULT_VOICE,
  GCLOUD_DEFAULT_TTS_VOICES,
  GROK_DEFAULT_TTS_VOICE,
  SUPPORTED_GCLOUD_PREBUILT_TTS_MODELS,
  SUPPORTED_SPEECHIFY_TTS_MODELS
} from '~/cli/commands/setup-and-utilities/models/model-options'
import type { LLMTarget, OcrTarget, Step3Metadata } from '~/types'

describe('option resolution contracts', () => {
  test('buildOptsFromFlags maps representative CLI flags to runtime options', () => {
    const opts = buildOptsFromFlags(false, {
      openai: 'gpt-5.4-mini',
      glm: 'glm-5.1',
      kimi: 'kimi-k2.6',
      'openai-stt': 'gpt-4o-mini-transcribe',
      'grok-stt': 'speech-to-text',
      'together-stt': 'openai/whisper-large-v3',
      'deepgram-stt': 'nova-3',
      'grok-tts': 'grok-tts',
      'grok-tts-voice': 'EVE',
      'mistral-tts': 'voxtral-mini-tts-2603',
      'mistral-tts-voice': 'voice_abc123',
      'deapi-tts': 'Qwen3_TTS_12Hz_1_7B_Base',
      'deapi-tts-ref-audio': 'input/examples/audio/0-audio-short.mp3',
      'deapi-tts-ref-text': 'Reference transcript.',
      'runway-tts': 'eleven_multilingual_v2',
      'runway-tts-voice': 'Leslie',
      'speechify-tts': 'simba-english',
      'speechify-voice': 'narrator_voice',
      'gcloud-tts': 'neural2',
      'gcloud-tts-voice': 'en-US-Neural2-C',
      'gcloud-tts-language': 'en-US',
      'deepinfra-ocr': 'Qwen/Qwen3-VL-30B-A3B-Instruct',
      'kimi-ocr': 'kimi-k2.6',
      'tesseract-ocr': true,
      'youtube-captions': true,
      'best-quality': true,
      'batch-limit': '9',
      'stt-provider-concurrency': '3',
      'ocr-provider-concurrency': '4',
      'ocr-local-concurrency': '2',
      'llm-provider-concurrency': '5',
      'llm-local-concurrency': '3',
      'openai-voice': 'alloy',
      'openai-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
      'openai-tts-consent-id': 'cons_123',
      'openai-tts-consent-language': 'en-US',
      'openai-tts-consent-name': 'Anthony Consent',
      'openai-tts-voice-name': 'AutoShow Anthony'
    })

    expect(opts.openaiModel).toBe('gpt-5.4-mini')
    expect(opts.glmModel).toBe('glm-5.1')
    expect(opts.kimiModel).toBe('kimi-k2.6')
    expect(opts.openaiSttModel).toBe('gpt-4o-mini-transcribe')
    expect(opts.grokSttModel).toBe('speech-to-text')
    expect(opts.togetherSttModel).toBe('openai/whisper-large-v3')
    expect(opts.deepgramSttModel).toBe('nova-3')
    expect(opts.grokTtsModel).toBe('grok-tts')
    expect(opts.grokTtsVoice).toBe('eve')
    expect(opts.mistralTtsModel).toBe('voxtral-mini-tts-2603')
    expect(opts.mistralTtsVoice).toBe('voice_abc123')
    expect(opts.minimaxTtsRefAudio).toBeUndefined()
    expect(opts.deapiTtsModel).toBe('Qwen3_TTS_12Hz_1_7B_Base')
    expect(opts.deapiTtsRefAudio).toBe('input/examples/audio/0-audio-short.mp3')
    expect(opts.deapiTtsRefText).toBe('Reference transcript.')
    expect(opts.runwayTtsModel).toBe('eleven_multilingual_v2')
    expect(opts.runwayTtsVoice).toBe('Leslie')
    expect(opts.speechifyTtsModel).toBe('simba-english')
    expect(opts.speechifyVoice).toBe('narrator_voice')
    expect(opts.gcloudTtsModel).toBe('neural2')
    expect(opts.gcloudTtsVoice).toBe('en-US-Neural2-C')
    expect(opts.gcloudTtsLanguage).toBe('en-US')
    expect(opts.deepinfraOcrModel).toBe('Qwen/Qwen3-VL-30B-A3B-Instruct')
    expect(opts.kimiOcrModel).toBe('kimi-k2.6')
    expect(opts.useTesseract).toBe(true)
    expect(opts.youtubeCaptions).toBe(true)
    expect(opts.bestQuality).toBe(true)
    expect(opts.batchLimit).toBe(9)
    expect(opts.sttProviderConcurrency).toBe(3)
    expect(opts.ocrProviderConcurrency).toBe(4)
    expect(opts.ocrLocalConcurrency).toBe(2)
    expect(opts.llmProviderConcurrency).toBe(5)
    expect(opts.llmLocalConcurrency).toBe(3)
    expect(opts.openaiVoiceId).toBe('alloy')
    expect(opts.openaiTtsRefAudio).toBe('input/examples/audio/anthony-voice.mp3')
    expect(opts.openaiTtsConsentId).toBe('cons_123')
    expect(opts.openaiTtsConsentLanguage).toBe('en-US')
    expect(opts.openaiTtsConsentName).toBe('Anthony Consent')
    expect(opts.openaiTtsVoiceName).toBe('AutoShow Anthony')
  })

  test('AWS region and bucket flags reach OCR extraction options', () => {
    const opts = buildOptsFromFlags(false, {
      'aws-textract': 'detect-text',
      'aws-region': 'us-west-2',
      'aws-bucket': 'autoshow-textract-existing'
    })
    const extractionOpts = buildExtractionCallOpts('input/examples/document/1-document.pdf', 'output/test', opts)

    expect(opts.awsRegion).toBe('us-west-2')
    expect(opts.awsBucket).toBe('autoshow-textract-existing')
    expect(extractionOpts.awsTextractModel).toBe('detect-text')
    expect(extractionOpts.awsRegion).toBe('us-west-2')
    expect(extractionOpts.awsBucket).toBe('autoshow-textract-existing')
  })

  test('buildOptsFromFlags only accepts canonical flags before the positional separator', () => {
    const camelCaseFlags = buildOptsFromFlags(false, {
      openaiStt: 'gpt-4o-mini-transcribe',
      deepinfraOcr: 'Qwen/Qwen3-VL-30B-A3B-Instruct'
    })
    const separatedFlags = buildOptsFromFlags(false, {}, [
      '--openai-stt',
      'gpt-4o-mini-transcribe'
    ], {}, new Set(), [
      'extract',
      'input/examples/audio/1-audio.mp3',
      '--',
      '--openai-stt',
      'gpt-4o-mini-transcribe',
      '--speechify-tts-voice-name',
      'AfterSeparator'
    ])
    const canonicalFlags = buildOptsFromFlags(false, {
      'openai-stt': 'gpt-4o-mini-transcribe',
      'deepinfra-ocr': 'Qwen/Qwen3-VL-30B-A3B-Instruct'
    })

    expect(camelCaseFlags.openaiSttModel).toBeUndefined()
    expect(camelCaseFlags.deepinfraOcrModel).toBeUndefined()
    expect(separatedFlags.openaiSttModel).toBeUndefined()
    expect(separatedFlags.speechifyTtsVoiceName).toBeUndefined()
    expect(canonicalFlags.openaiSttModel).toBe('gpt-4o-mini-transcribe')
    expect(canonicalFlags.deepinfraOcrModel).toBe('Qwen/Qwen3-VL-30B-A3B-Instruct')
  })

  test('OCR provider concurrency defaults, falls back, and clamps like STT concurrency flags', () => {
    const defaults = buildOptsFromFlags(false, {})
    const fallback = buildOptsFromFlags(false, {
      'ocr-provider-concurrency': 'not-a-number',
      'ocr-local-concurrency': 'nope'
    })
    const clamped = buildOptsFromFlags(false, {
      'ocr-provider-concurrency': '0',
      'ocr-local-concurrency': '-4'
    })

    expect(defaults.ocrProviderConcurrency).toBe(2)
    expect(defaults.ocrLocalConcurrency).toBe(1)
    expect(fallback.ocrProviderConcurrency).toBe(2)
    expect(fallback.ocrLocalConcurrency).toBe(1)
    expect(clamped.ocrProviderConcurrency).toBe(1)
    expect(clamped.ocrLocalConcurrency).toBe(1)
  })

  test('buildOptsFromFlags maps repeatable dialogue speaker reference audio flags', () => {
    const opts = buildOptsFromFlags(false, {
      'mistral-tts': 'voxtral-mini-tts-2603',
      'tts-dialogue-format': 'screenplay',
      'tts-speaker-ref-audio': [
        'DUCO=input/examples/audio/anthony-voice.mp3',
        'CHAT=input/examples/audio/0-audio-short.mp3'
      ]
    })

    expect(opts.ttsDialogueFormat).toBe('screenplay')
    expect(opts.ttsSpeakerRefAudios).toEqual([
      'DUCO=input/examples/audio/anthony-voice.mp3',
      'CHAT=input/examples/audio/0-audio-short.mp3'
    ])
  })

  test('LLM provider concurrency defaults, falls back, and clamps like STT/OCR concurrency flags', () => {
    const defaults = buildOptsFromFlags(false, {})
    const fallback = buildOptsFromFlags(false, {
      'llm-provider-concurrency': 'not-a-number',
      'llm-local-concurrency': 'nope'
    })
    const clamped = buildOptsFromFlags(false, {
      'llm-provider-concurrency': '0',
      'llm-local-concurrency': '-4'
    })

    expect(defaults.llmProviderConcurrency).toBe(2)
    expect(defaults.llmLocalConcurrency).toBe(1)
    expect(fallback.llmProviderConcurrency).toBe(2)
    expect(fallback.llmLocalConcurrency).toBe(1)
    expect(clamped.llmProviderConcurrency).toBe(1)
    expect(clamped.llmLocalConcurrency).toBe(1)
  })

  test('bare provider flags resolve to cheapest defaults', () => {
    const openaiDefault = resolveCheapestModelForFlag('openai')
    const glmDefault = resolveCheapestModelForFlag('glm')
    const kimiDefault = resolveCheapestModelForFlag('kimi')
    const deepgramDefault = resolveCheapestModelForFlag('deepgram-stt')
    const deepinfraOcrDefault = resolveCheapestModelForFlag('deepinfra-ocr')
    const kimiOcrDefault = resolveCheapestModelForFlag('kimi-ocr')
    const speechifyTtsDefault = resolveCheapestModelForFlag('speechify-tts')
    const gcloudTtsDefault = resolveCheapestModelForFlag('gcloud-tts')
    const opts = buildOptsFromFlags(false, {
      openai: true,
      glm: true,
      kimi: true,
      'deepgram-stt': true,
      'deepinfra-ocr': true,
      'kimi-ocr': true,
      'speechify-tts': true,
      'gcloud-tts': true
    })

    expect(openaiDefault).toBeDefined()
    expect(glmDefault).toBeDefined()
    expect(kimiDefault).toBe('kimi-k2.6')
    expect(deepgramDefault).toBeDefined()
    expect(deepinfraOcrDefault).toBe('Qwen/Qwen3-VL-30B-A3B-Instruct')
    expect(kimiOcrDefault).toBe('kimi-k2.6')
    expect(speechifyTtsDefault).toBe('simba-english')
    expect(gcloudTtsDefault).toBe('standard')
    expect(opts.openaiModel).toBe(openaiDefault)
    expect(opts.glmModel).toBe(glmDefault)
    expect(opts.kimiModel).toBe(kimiDefault)
    expect(opts.deepgramSttModel).toBe(deepgramDefault)
    expect(opts.deepinfraOcrModel).toBe(deepinfraOcrDefault)
    expect(opts.kimiOcrModel).toBe(kimiOcrDefault)
    expect(opts.speechifyTtsModel).toBe(speechifyTtsDefault)
    expect(opts.gcloudTtsModel).toBe(gcloudTtsDefault)
  })

  test('--all-llm expands GLM and Kimi to their supported models', () => {
    const opts = buildOptsFromFlags(false, { 'all-llm': true })

    expect(opts.glmModels).toEqual(['glm-5.1'])
    expect(opts.kimiModels).toEqual(['kimi-k2.6'])
  })

  test('--all-stt and --all-ocr expand to non-empty expected provider lists', () => {
    const expansions = getStep2AllShortcutModelExpansions()
    const sttOpts = buildOptsFromFlags(false, { 'all-stt': true })
    const ocrOpts = buildOptsFromFlags(false, { 'all-ocr': true })

    expect(expansions['deepgram-stt']?.shortcut).toBe('all-stt')
    expect(expansions['grok-stt']?.shortcut).toBe('all-stt')
    expect(expansions['openai-stt']?.shortcut).toBe('all-stt')
    expect(expansions['cloudflare-stt']?.shortcut).toBe('all-stt')
    expect(expansions['openai-ocr']?.shortcut).toBe('all-ocr')
    expect(expansions['kimi-ocr']?.shortcut).toBe('all-ocr')
    expect(expansions['deepinfra-ocr']?.shortcut).toBe('all-ocr')
    expect(collectSttTargets(sttOpts).map((target) => target.service)).toContain('deepgram')
    expect(collectSttTargets(sttOpts).map((target) => target.service)).toContain('grok')
    expect(collectSttTargets(sttOpts).map((target) => target.service)).toContain('openai-stt')
    expect(collectSttTargets(sttOpts).map((target) => target.service)).toContain('cloudflare')
    expect(collectSttTargets(sttOpts).map((target) => target.service)).toContain('whisper')
    expect(collectExplicitOcrTargets(ocrOpts).map((target) => target.service)).toContain('tesseract')
    expect(collectExplicitOcrTargets(ocrOpts).map((target) => target.service)).toContain('openai')
    expect(collectExplicitOcrTargets(ocrOpts).map((target) => target.service)).toContain('kimi')
    expect(collectExplicitOcrTargets(ocrOpts).map((target) => target.service)).toContain('deepinfra')
  })

  test('--all-tts expands hosted TTS defaults and excludes Google instant custom voice', () => {
    const opts = buildOptsFromFlags(false, { 'all-tts': true })
    const deepgramTargets = collectTtsTargets(opts).filter((target) => target.service === 'deepgram')
    const runwayTargets = collectTtsTargets(opts).filter((target) => target.service === 'runway')
    const grokTargets = collectTtsTargets(opts).filter((target) => target.service === 'grok')
    const mistralTargets = collectTtsTargets(opts).filter((target) => target.service === 'mistral')
    const speechifyTargets = collectTtsTargets(opts).filter((target) => target.service === 'speechify')
    const gcloudTargets = collectTtsTargets(opts).filter((target) => target.service === 'gcloud')

    expect(opts.deepgramTtsModels).toEqual([DEEPGRAM_DEFAULT_VOICE])
    expect(deepgramTargets.map((target) => target.model)).toEqual([DEEPGRAM_DEFAULT_VOICE])
    expect(opts.runwayTtsModels).toEqual(['eleven_multilingual_v2'])
    expect(runwayTargets.map((target) => target.model)).toEqual(['eleven_multilingual_v2'])
    expect(opts.grokTtsModels).toEqual(['grok-tts'])
    expect(grokTargets.map((target) => target.model)).toEqual(['grok-tts'])
    expect(grokTargets.map((target) => target.voice)).toEqual([undefined])
    expect(opts.mistralTtsModels).toEqual(['voxtral-mini-tts-2603'])
    expect(mistralTargets.map((target) => target.model)).toEqual(['voxtral-mini-tts-2603'])
    expect(mistralTargets.map((target) => target.voice)).toEqual([undefined])
    expect(opts.speechifyTtsModels).toEqual([...SUPPORTED_SPEECHIFY_TTS_MODELS])
    expect(speechifyTargets.map((target) => target.model)).toEqual([...SUPPORTED_SPEECHIFY_TTS_MODELS])
    expect(opts.gcloudTtsModels).toEqual([...SUPPORTED_GCLOUD_PREBUILT_TTS_MODELS])
    expect(gcloudTargets.map((target) => target.model)).toEqual([...SUPPORTED_GCLOUD_PREBUILT_TTS_MODELS])
    expect(gcloudTargets.map((target) => target.voice)).toEqual(
      SUPPORTED_GCLOUD_PREBUILT_TTS_MODELS.map((model) => GCLOUD_DEFAULT_TTS_VOICES[model])
    )
    expect(gcloudTargets.map((target) => target.model)).not.toContain('instant-custom-voice')
  })

  test('Google Cloud instant custom voice flags validate model and key generation mode', () => {
    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'gcloud-tts-ref-audio': 'input/examples/audio/0-audio-short.mp3',
      'gcloud-tts-consent-audio': 'input/examples/audio/0-audio-short.mp3'
    }))).toThrow('require --gcloud-tts instant-custom-voice')

    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'gcloud-tts': 'neural2',
      'gcloud-tts-ref-audio': 'input/examples/audio/0-audio-short.mp3',
      'gcloud-tts-consent-audio': 'input/examples/audio/0-audio-short.mp3'
    }))).toThrow('require --gcloud-tts instant-custom-voice')

    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'gcloud-tts': 'instant-custom-voice'
    }))).toThrow('requires --gcloud-tts-voice-cloning-key or both --gcloud-tts-ref-audio and --gcloud-tts-consent-audio')

    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'gcloud-tts': 'instant-custom-voice',
      'gcloud-tts-voice-cloning-key': 'existing-key',
      'gcloud-tts-ref-audio': 'input/examples/audio/0-audio-short.mp3',
      'gcloud-tts-consent-audio': 'input/examples/audio/0-audio-short.mp3'
    }))).toThrow('cannot be combined with key generation flags')

    expect(collectTtsTargets(buildOptsFromFlags(false, {
      'gcloud-tts': 'instant-custom-voice',
      'gcloud-tts-voice-cloning-key': 'existing-key'
    })).map((target) => ({
      service: target.service,
      model: target.model,
      voice: target.voice
    }))).toEqual([{
      service: 'gcloud',
      model: 'instant-custom-voice',
      voice: 'instant-custom-voice'
    }])

    expect(collectTtsTargets(buildOptsFromFlags(false, {
      'gcloud-tts': ['standard', 'instant-custom-voice'],
      'gcloud-tts-voice-cloning-key': 'existing-key'
    })).map((target) => ({
      service: target.service,
      model: target.model,
      voice: target.voice
    }))).toEqual([
      {
        service: 'gcloud',
        model: 'standard',
        voice: GCLOUD_DEFAULT_TTS_VOICES.standard
      },
      {
        service: 'gcloud',
        model: 'instant-custom-voice',
        voice: 'instant-custom-voice'
      }
    ])
  })

  test('Speechify custom voice flags build reference-audio targets and validate required consent', () => {
    const opts = buildOptsFromFlags(false, {
      'speechify-tts': ['simba-english', 'simba-multilingual'],
      'speechify-tts-ref-audio': 'input/voices/my-voice-sample.mp3',
      'speechify-tts-voice-name': 'FallbackName',
      'speechify-tts-consent-name': 'Fallback Consent',
      'speechify-tts-consent-email': 'anthony@example.com',
      'speechify-tts-voice-locale': 'en-US',
      'speechify-tts-voice-gender': 'notSpecified'
    }, [], {}, new Set(), [
      '--speechify-tts-voice-name',
      'AutoShow Anthony',
      '--speechify-tts-consent-name',
      'Anthony Example'
    ])
    const speechifyTargets = collectTtsTargets(opts).filter((target) => target.service === 'speechify')

    expect(opts.speechifyTtsRefAudio).toBe('input/voices/my-voice-sample.mp3')
    expect(opts.speechifyTtsVoiceName).toBe('AutoShow Anthony')
    expect(opts.speechifyTtsConsentName).toBe('Anthony Example')
    expect(opts.speechifyTtsConsentEmail).toBe('anthony@example.com')
    expect(opts.speechifyTtsVoiceLocale).toBe('en-US')
    expect(opts.speechifyTtsVoiceGender).toBe('notSpecified')
    expect(speechifyTargets.map((target) => ({
      model: target.model,
      voice: target.voice,
      setupCostCents: target.setupCostCents,
      setupTimeMs: target.setupTimeMs,
      setupNote: target.setupNote
    }))).toEqual([
      {
        model: 'simba-english',
        voice: 'ref_audio:my-voice-sample.mp3',
        setupCostCents: 0,
        setupTimeMs: SPEECHIFY_TTS_CUSTOM_VOICE_SETUP_MS,
        setupNote: 'Speechify custom voice creation setup'
      },
      {
        model: 'simba-multilingual',
        voice: 'ref_audio:my-voice-sample.mp3',
        setupCostCents: undefined,
        setupTimeMs: undefined,
        setupNote: undefined
      }
    ])

    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'speechify-tts-ref-audio': 'input/voices/my-voice-sample.mp3',
      'speechify-tts-consent-name': 'Anthony Example',
      'speechify-tts-consent-email': 'anthony@example.com'
    }))).toThrow('require --speechify-tts <model>')

    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'speechify-tts': 'simba-english',
      'speechify-tts-voice-name': 'AutoShow Anthony',
      'speechify-tts-consent-name': 'Anthony Example',
      'speechify-tts-consent-email': 'anthony@example.com'
    }))).toThrow('requires --speechify-tts-ref-audio')

    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'speechify-tts': 'simba-english',
      'speechify-voice': 'george',
      'speechify-tts-ref-audio': 'input/voices/my-voice-sample.mp3',
      'speechify-tts-consent-name': 'Anthony Example',
      'speechify-tts-consent-email': 'anthony@example.com'
    }))).toThrow('cannot be combined with --speechify-voice')

    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'speechify-tts': 'simba-english',
      'speechify-tts-ref-audio': 'input/voices/my-voice-sample.mp3',
      'speechify-tts-consent-email': 'anthony@example.com'
    }))).toThrow('requires --speechify-tts-consent-name')

    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'speechify-tts': 'simba-english',
      'speechify-tts-ref-audio': 'input/voices/my-voice-sample.mp3',
      'speechify-tts-consent-name': 'Anthony Example',
      'speechify-tts-consent-email': 'anthony@example.com',
      'speechify-tts-voice-gender': 'unknown'
    }))).toThrow('Invalid --speechify-tts-voice-gender')
  })

  test('elevenlabs voice clone target records reference audio speaker and setup estimate', () => {
    const opts = buildOptsFromFlags(false, {
      'elevenlabs-tts': ['eleven_flash_v2_5', 'eleven_v3'],
      'elevenlabs-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
      'elevenlabs-tts-voice-name': 'AutoShow Anthony',
      'elevenlabs-tts-clone-remove-background-noise': true
    }, [], {}, new Set(), [
      '--elevenlabs-tts',
      'eleven_flash_v2_5',
      '--elevenlabs-tts',
      'eleven_v3',
      '--elevenlabs-tts-ref-audio',
      'input/examples/audio/anthony-voice.mp3',
      '--elevenlabs-tts-voice-name',
      'AutoShow Anthony',
      '--elevenlabs-tts-clone-remove-background-noise'
    ])
    const targets = collectTtsTargets(opts).filter((target) => target.service === 'elevenlabs')

    expect(opts.elevenlabsTtsRefAudio).toBe('input/examples/audio/anthony-voice.mp3')
    expect(opts.elevenlabsTtsVoiceName).toBe('AutoShow Anthony')
    expect(opts.elevenlabsTtsCloneRemoveBackgroundNoise).toBe(true)
    expect(targets.map((target) => ({
      model: target.model,
      voice: target.voice,
      setupCostCents: target.setupCostCents,
      setupTimeMs: target.setupTimeMs,
      setupNote: target.setupNote
    }))).toEqual([
      {
        model: 'eleven_flash_v2_5',
        voice: 'ref_audio:anthony-voice.mp3',
        setupCostCents: 0,
        setupTimeMs: ELEVENLABS_TTS_IVC_SETUP_MS,
        setupNote: 'ElevenLabs instant voice clone setup'
      },
      {
        model: 'eleven_v3',
        voice: 'ref_audio:anthony-voice.mp3',
        setupCostCents: undefined,
        setupTimeMs: undefined,
        setupNote: undefined
      }
    ])
  })

  test('elevenlabs clone options validate provider selection and voice reuse', () => {
    const missingElevenLabsModel = buildOptsFromFlags(false, {
      'elevenlabs-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3'
    })
    const voiceNameWithoutReference = buildOptsFromFlags(false, {
      'elevenlabs-tts': 'eleven_flash_v2_5',
      'elevenlabs-tts-voice-name': 'AutoShow Anthony'
    })
    const voiceWithClone = buildOptsFromFlags(false, {
      'elevenlabs-tts': 'eleven_flash_v2_5',
      'elevenlabs-voice': 'voice_existing123',
      'elevenlabs-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3'
    })
    const existingVoice = buildOptsFromFlags(false, {
      'elevenlabs-tts': 'eleven_flash_v2_5',
      'elevenlabs-voice': 'voice_existing123'
    })

    expect(() => collectTtsTargets(missingElevenLabsModel)).toThrow('require --elevenlabs-tts <model> or --all-tts')
    expect(() => collectTtsTargets(voiceNameWithoutReference)).toThrow('requires --elevenlabs-tts-ref-audio')
    expect(() => collectTtsTargets(voiceWithClone)).toThrow('cannot be combined with --elevenlabs-voice')
    expect(collectTtsTargets(existingVoice).map((target) => target.voice)).toEqual(['voice_existing123'])
  })

  test('elevenlabs clone audio validation enforces file and extension while warning on duration guidance', async () => {
    const sample = await validateElevenLabsTtsIvcAudio('input/examples/audio/anthony-voice.mp3')
    expect(sample.basename).toBe('anthony-voice.mp3')
    expect(sample.mimeType).toBe('audio/mpeg')

    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-elevenlabs-ref-audio-'))
    const emptyPath = join(tempDir, 'empty.mp3')
    const textPath = join(tempDir, 'not-audio.txt')
    await writeFile(emptyPath, '')
    await writeFile(textPath, 'hello')

    try {
      await expect(validateElevenLabsTtsIvcAudio('input/examples/audio/missing.mp3')).rejects.toThrow('not found')
      await expect(validateElevenLabsTtsIvcAudio(textPath)).rejects.toThrow('mp3/mpeg, wav, m4a/mp4, ogg, flac, aac, or webm')
      await expect(validateElevenLabsTtsIvcAudio(emptyPath)).rejects.toThrow('is empty')
      await expect(validateElevenLabsTtsIvcAudio('input/examples/audio/0-audio-short.mp3')).resolves.toMatchObject({
        basename: '0-audio-short.mp3'
      })
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('elevenlabs clone flow creates once and reuses cloned voice across models', async () => {
    const previousKey = process.env['ELEVENLABS_API_KEY']
    const previousBaseUrl = process.env['ELEVENLABS_BASE_URL']
    const previousFetch = globalThis.fetch
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-elevenlabs-clone-flow-'))
    const calls: Array<{ url: string, method: string, body?: unknown }> = []

    try {
      process.env['ELEVENLABS_API_KEY'] = 'test-key'
      process.env['ELEVENLABS_BASE_URL'] = 'https://mock.elevenlabs.local/v1'
      const audioBytes = await Bun.file('input/examples/audio/0-audio-short.mp3').arrayBuffer()

      globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const url = String(input)
        const method = init?.method ?? 'GET'
        const body = init?.body

        if (url.endsWith('/v1/voices/add') && body instanceof FormData) {
          calls.push({
            url,
            method,
            body: {
              name: body.get('name'),
              hasFile: body.get('files') instanceof Blob,
              removeBackgroundNoise: body.get('remove_background_noise')
            }
          })
          return new Response(JSON.stringify({
            voice_id: 'voice_elevenlabs_mock',
            requires_verification: false
          }), { status: 200, headers: { 'content-type': 'application/json' } })
        }
        if (url.includes('/v1/text-to-speech/')) {
          const parsed = JSON.parse(String(body ?? '{}')) as unknown
          calls.push({ url, method, body: parsed })
          return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
        }
        throw new Error(`Unexpected ElevenLabs mock fetch: ${method} ${url}`)
      }) as typeof fetch

      const context = createElevenLabsTtsIvcContext()
      const firstDir = join(tempDir, 'first')
      const secondDir = join(tempDir, 'second')
      await mkdir(firstDir, { recursive: true })
      await mkdir(secondDir, { recursive: true })
      const clone = {
        refAudioPath: 'input/examples/audio/anthony-voice.mp3',
        voiceName: 'AutoShowTestVoice',
        removeBackgroundNoise: true,
        context
      }
      const first = await runElevenLabsTts('Hello from the first model.', firstDir, {
        model: 'eleven_flash_v2_5',
        clone
      })
      const second = await runElevenLabsTts('Hello from the second model.', secondDir, {
        model: 'eleven_v3',
        clone
      })

      expect(await Bun.file(first.audioPath).exists()).toBe(true)
      expect(await Bun.file(second.audioPath).exists()).toBe(true)
      expect(calls.filter((call) => call.url.endsWith('/v1/voices/add'))).toHaveLength(1)
      expect(calls.filter((call) => call.url.includes('/v1/text-to-speech/'))).toHaveLength(2)
      expect(calls.find((call) => call.url.endsWith('/v1/voices/add'))?.body).toEqual({
        name: 'AutoShowTestVoice',
        hasFile: true,
        removeBackgroundNoise: 'true'
      })
      expect(calls.filter((call) => call.url.includes('/v1/text-to-speech/')).map((call) => ({
        url: call.url,
        body: call.body
      }))).toEqual([
        {
          url: 'https://mock.elevenlabs.local/v1/text-to-speech/voice_elevenlabs_mock?output_format=mp3_44100_128',
          body: { text: 'Hello from the first model.', model_id: 'eleven_flash_v2_5' }
        },
        {
          url: 'https://mock.elevenlabs.local/v1/text-to-speech/voice_elevenlabs_mock?output_format=mp3_44100_128',
          body: { text: 'Hello from the second model.', model_id: 'eleven_v3' }
        }
      ])
      expect(first.metadata).toMatchObject({
        speaker: 'ref_audio:anthony-voice.mp3',
        clonedVoiceId: 'voice_elevenlabs_mock',
        cloneCostCents: 0
      })
      expect(second.metadata).toMatchObject({
        speaker: 'ref_audio:anthony-voice.mp3',
        clonedVoiceId: 'voice_elevenlabs_mock',
        cloneCostCents: 0
      })
    } finally {
      globalThis.fetch = previousFetch
      if (previousKey === undefined) delete process.env['ELEVENLABS_API_KEY']
      else process.env['ELEVENLABS_API_KEY'] = previousKey
      if (previousBaseUrl === undefined) delete process.env['ELEVENLABS_BASE_URL']
      else process.env['ELEVENLABS_BASE_URL'] = previousBaseUrl
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('elevenlabs clone flow fails clearly when verification is required', async () => {
    const previousKey = process.env['ELEVENLABS_API_KEY']
    const previousBaseUrl = process.env['ELEVENLABS_BASE_URL']
    const previousFetch = globalThis.fetch
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-elevenlabs-verify-'))

    try {
      process.env['ELEVENLABS_API_KEY'] = 'test-key'
      process.env['ELEVENLABS_BASE_URL'] = 'https://mock.elevenlabs.local/v1'
      globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const url = String(input)
        if (url.endsWith('/v1/voices/add')) {
          return new Response(JSON.stringify({
            voice_id: 'voice_requires_verify',
            requires_verification: true
          }), { status: 200, headers: { 'content-type': 'application/json' } })
        }
        throw new Error(`Unexpected ElevenLabs verification mock fetch: ${init?.method ?? 'GET'} ${url}`)
      }) as typeof fetch

      await expect(runElevenLabsTts('Hello.', tempDir, {
        model: 'eleven_flash_v2_5',
        clone: {
          refAudioPath: 'input/examples/audio/anthony-voice.mp3',
          context: createElevenLabsTtsIvcContext()
        }
      })).rejects.toThrow('Verify it in ElevenLabs, then rerun with --elevenlabs-voice voice_requires_verify')
    } finally {
      globalThis.fetch = previousFetch
      if (previousKey === undefined) delete process.env['ELEVENLABS_API_KEY']
      else process.env['ELEVENLABS_API_KEY'] = previousKey
      if (previousBaseUrl === undefined) delete process.env['ELEVENLABS_BASE_URL']
      else process.env['ELEVENLABS_BASE_URL'] = previousBaseUrl
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('elevenlabs clone flow surfaces API errors without synthesis', async () => {
    const previousKey = process.env['ELEVENLABS_API_KEY']
    const previousBaseUrl = process.env['ELEVENLABS_BASE_URL']
    const previousFetch = globalThis.fetch
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-elevenlabs-error-'))
    let synthesisCalls = 0

    try {
      process.env['ELEVENLABS_API_KEY'] = 'test-key'
      process.env['ELEVENLABS_BASE_URL'] = 'https://mock.elevenlabs.local/v1'
      globalThis.fetch = (async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
        const url = String(input)
        if (url.endsWith('/v1/voices/add')) {
          return new Response(JSON.stringify({ detail: { message: 'bad reference audio' } }), {
            status: 400,
            headers: { 'content-type': 'application/json' }
          })
        }
        if (url.includes('/v1/text-to-speech/')) {
          synthesisCalls += 1
        }
        throw new Error(`Unexpected ElevenLabs error mock fetch: ${url}`)
      }) as typeof fetch

      await expect(runElevenLabsTts('Hello.', tempDir, {
        model: 'eleven_flash_v2_5',
        clone: {
          refAudioPath: 'input/examples/audio/anthony-voice.mp3',
          context: createElevenLabsTtsIvcContext()
        }
      })).rejects.toThrow('ElevenLabs IVC voice creation failed (400): bad reference audio')
      expect(synthesisCalls).toBe(0)
    } finally {
      globalThis.fetch = previousFetch
      if (previousKey === undefined) delete process.env['ELEVENLABS_API_KEY']
      else process.env['ELEVENLABS_API_KEY'] = previousKey
      if (previousBaseUrl === undefined) delete process.env['ELEVENLABS_BASE_URL']
      else process.env['ELEVENLABS_BASE_URL'] = previousBaseUrl
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('elevenlabs PVC ready voice maps to synthesis speaker and rejects conflicting voice modes', () => {
    const readyPvc = buildOptsFromFlags(false, {
      'elevenlabs-tts': 'eleven_flash_v2_5',
      'elevenlabs-tts-pvc-voice': 'pvc_voice_123'
    })
    const targets = collectTtsTargets(readyPvc).filter((target) => target.service === 'elevenlabs')

    expect(readyPvc.elevenlabsTtsPvcVoice).toBe('pvc_voice_123')
    expect(targets.map((target) => ({
      model: target.model,
      voice: target.voice,
      setupCostCents: target.setupCostCents
    }))).toEqual([{
      model: 'eleven_flash_v2_5',
      voice: 'pvc:pvc_voice_123',
      setupCostCents: undefined
    }])

    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'elevenlabs-tts': 'eleven_flash_v2_5',
      'elevenlabs-voice': 'voice_existing123',
      'elevenlabs-tts-pvc-voice': 'pvc_voice_123'
    }))).toThrow('PVC voice cannot be combined with --elevenlabs-voice')

    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'elevenlabs-tts': 'eleven_flash_v2_5',
      'elevenlabs-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
      'elevenlabs-tts-pvc-voice': 'pvc_voice_123'
    }))).toThrow('PVC voice cannot be combined with ElevenLabs IVC flags')
  })

  test('elevenlabs PVC setup target records setup estimate and runtime-only setup flags', () => {
    const opts = buildOptsFromFlags(false, {
      'elevenlabs-tts': 'eleven_flash_v2_5',
      'elevenlabs-tts-pvc-sample': ['input/examples/audio/anthony-voice.mp3'],
      'elevenlabs-tts-voice-name': 'AutoShow PVC',
      'elevenlabs-tts-pvc-language': 'en',
      'elevenlabs-tts-pvc-description': 'Narration PVC',
      'elevenlabs-tts-pvc-captcha-out': '/tmp/autoshow-pvc-captcha.png',
      'elevenlabs-tts-pvc-wait': true
    }, [], {}, new Set(), [
      '--elevenlabs-tts',
      'eleven_flash_v2_5',
      '--elevenlabs-tts-pvc-sample',
      'input/examples/audio/anthony-voice.mp3',
      '--elevenlabs-tts-voice-name',
      'AutoShow PVC',
      '--elevenlabs-tts-pvc-language',
      'en',
      '--elevenlabs-tts-pvc-description',
      'Narration PVC',
      '--elevenlabs-tts-pvc-captcha-out',
      '/tmp/autoshow-pvc-captcha.png',
      '--elevenlabs-tts-pvc-wait'
    ])
    const targets = collectTtsTargets(opts).filter((target) => target.service === 'elevenlabs')

    expect(opts.elevenlabsTtsPvcSamples).toEqual(['input/examples/audio/anthony-voice.mp3'])
    expect(opts.elevenlabsTtsVoiceName).toBe('AutoShow PVC')
    expect(opts.elevenlabsTtsPvcLanguage).toBe('en')
    expect(opts.elevenlabsTtsPvcDescription).toBe('Narration PVC')
    expect(opts.elevenlabsTtsPvcCaptchaOut).toBe('/tmp/autoshow-pvc-captcha.png')
    expect(opts.elevenlabsTtsPvcWait).toBe(true)
    expect(targets.map((target) => ({
      model: target.model,
      voice: target.voice,
      setupCostCents: target.setupCostCents,
      setupTimeMs: target.setupTimeMs,
      setupNote: target.setupNote
    }))).toEqual([{
      model: 'eleven_flash_v2_5',
      voice: 'pvc_setup:AutoShow PVC',
      setupCostCents: 0,
      setupTimeMs: ELEVENLABS_TTS_PVC_ENGLISH_SETUP_MS,
      setupNote: 'ElevenLabs professional voice clone training'
    }])
  })

  test('elevenlabs PVC sample validation accepts directories and enforces file checks', async () => {
    const sample = await validateElevenLabsTtsPvcAudio('input/examples/audio/anthony-voice.mp3')
    expect(sample.basename).toBe('anthony-voice.mp3')
    expect(sample.mimeType).toBe('audio/mpeg')

    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-elevenlabs-pvc-samples-'))
    const emptyPath = join(tempDir, 'empty.mp3')
    const textPath = join(tempDir, 'not-audio.txt')
    const sampleCopyPath = join(tempDir, 'sample.mp3')
    await writeFile(emptyPath, '')
    await writeFile(textPath, 'hello')
    await writeFile(sampleCopyPath, new Uint8Array(await Bun.file('input/examples/audio/0-audio-short.mp3').arrayBuffer()))

    try {
      await expect(validateElevenLabsTtsPvcAudio('input/examples/audio/missing.mp3')).rejects.toThrow('not found')
      await expect(validateElevenLabsTtsPvcAudio(textPath)).rejects.toThrow('mp3/mpeg, wav, m4a/mp4, ogg, flac, aac, or webm')
      await expect(validateElevenLabsTtsPvcAudio(emptyPath)).rejects.toThrow('is empty')
      await rm(emptyPath, { force: true })
      const samples = await validateElevenLabsTtsPvcSamples(undefined, tempDir)
      expect(samples.map((entry) => entry.basename)).toEqual(['sample.mp3'])
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('elevenlabs PVC setup creates a voice, uploads samples, writes captcha and status artifact', async () => {
    const previousFetch = globalThis.fetch
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-elevenlabs-pvc-create-'))
    const calls: Array<{ url: string, method: string, body?: unknown }> = []

    try {
      globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const url = String(input)
        const method = init?.method ?? 'GET'
        const body = init?.body
        if (url.endsWith('/v1/voices/pvc')) {
          calls.push({ url, method, body: JSON.parse(String(body ?? '{}')) as unknown })
          return new Response(JSON.stringify({ voice_id: 'pvc_new_voice' }), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        }
        if (url.endsWith('/v1/voices/pvc/pvc_new_voice/samples') && body instanceof FormData) {
          calls.push({
            url,
            method,
            body: {
              hasFile: body.get('files') instanceof Blob,
              removeBackgroundNoise: body.get('remove_background_noise')
            }
          })
          return new Response(JSON.stringify([{
            sample_id: 'sample_1',
            file_name: '0-audio-short.mp3',
            mime_type: 'audio/mpeg',
            size_bytes: 10,
            duration_secs: 5
          }]), { status: 200, headers: { 'content-type': 'application/json' } })
        }
        if (url.endsWith('/v1/voices/pvc/pvc_new_voice/captcha')) {
          calls.push({ url, method })
          return new Response(Buffer.from('captcha-bytes').toString('base64'), {
            status: 200,
            headers: { 'content-type': 'text/plain' }
          })
        }
        throw new Error(`Unexpected ElevenLabs PVC create mock fetch: ${method} ${url}`)
      }) as typeof fetch

      const captchaPath = join(tempDir, 'captcha.png')
      const result = await runElevenLabsTtsPvcSetup('https://mock.elevenlabs.local/v1', 'test-key', {
        model: 'eleven_flash_v2_5',
        samplePaths: ['input/examples/audio/0-audio-short.mp3'],
        voiceName: 'AutoShow PVC',
        language: 'en',
        description: 'Narration PVC',
        captchaOut: captchaPath
      })
      const artifact = await writeElevenLabsTtsPvcStatusArtifact(tempDir, result)

      expect(result).toMatchObject({
        voiceId: 'pvc_new_voice',
        voiceName: 'AutoShow PVC',
        language: 'en',
        description: 'Narration PVC',
        createdVoice: true,
        readyForSynthesis: false,
        actions: ['create_voice', 'upload_samples', 'write_captcha']
      })
      expect(result.uploadedSamples).toEqual([{
        sampleId: 'sample_1',
        fileName: '0-audio-short.mp3',
        mimeType: 'audio/mpeg',
        sizeBytes: 10,
        durationSeconds: 5
      }])
      expect(await Bun.file(captchaPath).text()).toBe('captcha-bytes')
      expect(await Bun.file(join(tempDir, artifact.statusFileName)).exists()).toBe(true)
      expect(calls.map((call) => ({ url: call.url, method: call.method, body: call.body }))).toEqual([
        {
          url: 'https://mock.elevenlabs.local/v1/voices/pvc',
          method: 'POST',
          body: { name: 'AutoShow PVC', language: 'en', description: 'Narration PVC' }
        },
        {
          url: 'https://mock.elevenlabs.local/v1/voices/pvc/pvc_new_voice/samples',
          method: 'POST',
          body: { hasFile: true, removeBackgroundNoise: 'false' }
        },
        {
          url: 'https://mock.elevenlabs.local/v1/voices/pvc/pvc_new_voice/captcha',
          method: 'GET',
          body: undefined
        }
      ])
    } finally {
      globalThis.fetch = previousFetch
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('elevenlabs PVC setup verifies, trains, and waits for fine tuning', async () => {
    const previousFetch = globalThis.fetch
    const calls: Array<{ url: string, method: string, body?: unknown }> = []
    let statusPolls = 0

    try {
      globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const url = String(input)
        const method = init?.method ?? 'GET'
        const body = init?.body
        if (url.endsWith('/v1/voices/pvc/pvc_existing/captcha') && method === 'POST' && body instanceof FormData) {
          calls.push({ url, method, body: { hasRecording: body.get('recording') instanceof Blob } })
          return new Response(JSON.stringify({ status: 'ok' }), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        }
        if (url.endsWith('/v1/voices/pvc/pvc_existing/train')) {
          calls.push({ url, method, body: JSON.parse(String(body ?? '{}')) as unknown })
          return new Response(JSON.stringify({ status: 'ok' }), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        }
        if (url.endsWith('/v1/voices/pvc_existing')) {
          statusPolls += 1
          calls.push({ url, method })
          return new Response(JSON.stringify({
            voice_id: 'pvc_existing',
            fine_tuning: {
              state: {
                eleven_flash_v2_5: statusPolls === 1 ? 'fine_tuning' : 'fine_tuned'
              },
              progress: {
                eleven_flash_v2_5: statusPolls === 1 ? 0.5 : 1
              }
            }
          }), { status: 200, headers: { 'content-type': 'application/json' } })
        }
        throw new Error(`Unexpected ElevenLabs PVC verify mock fetch: ${method} ${url}`)
      }) as typeof fetch

      const result = await runElevenLabsTtsPvcSetup('https://mock.elevenlabs.local/v1', 'test-key', {
        model: 'eleven_flash_v2_5',
        pvcVoiceId: 'pvc_existing',
        verifyAudioPath: 'input/examples/audio/0-audio-short.mp3',
        wait: true,
        pollIntervalMs: 1,
        timeoutMs: 1000
      })

      expect(result).toMatchObject({
        voiceId: 'pvc_existing',
        verificationStatus: 'ok',
        trainingStatus: 'ok',
        fineTuningState: 'fine_tuned',
        fineTuningProgress: 1,
        readyForSynthesis: true,
        actions: ['verify_captcha', 'start_training', 'wait_for_training']
      })
      expect(calls.map((call) => ({ url: call.url, method: call.method, body: call.body }))).toEqual([
        {
          url: 'https://mock.elevenlabs.local/v1/voices/pvc/pvc_existing/captcha',
          method: 'POST',
          body: { hasRecording: true }
        },
        {
          url: 'https://mock.elevenlabs.local/v1/voices/pvc/pvc_existing/train',
          method: 'POST',
          body: { model_id: 'eleven_flash_v2_5' }
        },
        {
          url: 'https://mock.elevenlabs.local/v1/voices/pvc_existing',
          method: 'GET',
          body: undefined
        },
        {
          url: 'https://mock.elevenlabs.local/v1/voices/pvc_existing',
          method: 'GET',
          body: undefined
        }
      ])
    } finally {
      globalThis.fetch = previousFetch
    }
  })

  test('elevenlabs PVC setup surfaces failed training state', async () => {
    const previousFetch = globalThis.fetch

    try {
      globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const url = String(input)
        const method = init?.method ?? 'GET'
        if (url.endsWith('/v1/voices/pvc_failed')) {
          return new Response(JSON.stringify({
            voice_id: 'pvc_failed',
            fine_tuning: {
              state: {
                eleven_flash_v2_5: 'failed'
              }
            }
          }), { status: 200, headers: { 'content-type': 'application/json' } })
        }
        throw new Error(`Unexpected ElevenLabs PVC failed mock fetch: ${method} ${url}`)
      }) as typeof fetch

      await expect(runElevenLabsTtsPvcSetup('https://mock.elevenlabs.local/v1', 'test-key', {
        model: 'eleven_flash_v2_5',
        pvcVoiceId: 'pvc_failed',
        wait: true,
        pollIntervalMs: 1,
        timeoutMs: 100
      })).rejects.toThrow('ElevenLabs PVC training failed')
    } finally {
      globalThis.fetch = previousFetch
    }
  })

  test('elevenlabs ready PVC synthesis uses pvc speaker metadata', async () => {
    const previousKey = process.env['ELEVENLABS_API_KEY']
    const previousBaseUrl = process.env['ELEVENLABS_BASE_URL']
    const previousFetch = globalThis.fetch
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-elevenlabs-pvc-synthesis-'))
    const calls: Array<{ url: string, method: string, body?: unknown }> = []

    try {
      process.env['ELEVENLABS_API_KEY'] = 'test-key'
      process.env['ELEVENLABS_BASE_URL'] = 'https://mock.elevenlabs.local/v1'
      const audioBytes = await Bun.file('input/examples/audio/0-audio-short.mp3').arrayBuffer()

      globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const url = String(input)
        const method = init?.method ?? 'GET'
        const body = init?.body
        if (url.includes('/v1/text-to-speech/')) {
          calls.push({ url, method, body: JSON.parse(String(body ?? '{}')) as unknown })
          return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
        }
        throw new Error(`Unexpected ElevenLabs PVC synthesis mock fetch: ${method} ${url}`)
      }) as typeof fetch

      const result = await runElevenLabsTts('Hello from a PVC voice.', tempDir, {
        model: 'eleven_flash_v2_5',
        pvcVoiceId: 'pvc_voice_123'
      })

      expect(await Bun.file(result.audioPath).exists()).toBe(true)
      expect(result.metadata).toMatchObject({
        speaker: 'pvc:pvc_voice_123'
      })
      expect(calls).toEqual([{
        url: 'https://mock.elevenlabs.local/v1/text-to-speech/pvc_voice_123?output_format=mp3_44100_128',
        method: 'POST',
        body: { text: 'Hello from a PVC voice.', model_id: 'eleven_flash_v2_5' }
      }])
    } finally {
      globalThis.fetch = previousFetch
      if (previousKey === undefined) delete process.env['ELEVENLABS_API_KEY']
      else process.env['ELEVENLABS_API_KEY'] = previousKey
      if (previousBaseUrl === undefined) delete process.env['ELEVENLABS_BASE_URL']
      else process.env['ELEVENLABS_BASE_URL'] = previousBaseUrl
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('mistral tts voice and reference audio are mutually exclusive at target collection', () => {
    const opts = buildOptsFromFlags(false, {
      'mistral-tts': 'voxtral-mini-tts-2603',
      'mistral-tts-voice': 'voice_abc123',
      'mistral-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3'
    })

    expect(() => collectTtsTargets(opts)).toThrow('Use either --mistral-tts-voice or --mistral-tts-ref-audio, not both')
  })

  test('deapi voice clone target records reference audio speaker', () => {
    const opts = buildOptsFromFlags(false, {
      'deapi-tts': 'Qwen3_TTS_12Hz_1_7B_Base',
      'deapi-tts-ref-audio': 'input/examples/audio/0-audio-short.mp3'
    })
    const targets = collectTtsTargets(opts).filter((target) => target.service === 'deapi')

    expect(targets.map((target) => ({
      model: target.model,
      voice: target.voice
    }))).toEqual([{
      model: 'Qwen3_TTS_12Hz_1_7B_Base',
      voice: 'ref_audio:0-audio-short.mp3'
    }])
  })

  test('minimax voice clone target records reference audio speaker and setup estimates', () => {
    const opts = buildOptsFromFlags(false, {
      'minimax-tts': ['speech-2.8-turbo', 'speech-2.8-hd'],
      'minimax-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
      'minimax-tts-voice': 'AutoShowTestVoice',
      'minimax-tts-prompt-audio': 'input/examples/audio/0-audio-short.mp3',
      'minimax-tts-prompt-text': 'Reference transcript.',
      'minimax-tts-clone-noise-reduction': true,
      'minimax-tts-clone-volume-normalization': true
    })
    const targets = collectTtsTargets(opts).filter((target) => target.service === 'minimax')

    expect(opts.minimaxTtsRefAudio).toBe('input/examples/audio/anthony-voice.mp3')
    expect(opts.minimaxTtsPromptAudio).toBe('input/examples/audio/0-audio-short.mp3')
    expect(opts.minimaxTtsPromptText).toBe('Reference transcript.')
    expect(opts.minimaxTtsCloneNoiseReduction).toBe(true)
    expect(opts.minimaxTtsCloneVolumeNormalization).toBe(true)
    expect(targets.map((target) => ({
      model: target.model,
      voice: target.voice,
      setupCostCents: target.setupCostCents,
      setupTimeMs: target.setupTimeMs
    }))).toEqual([
      {
        model: 'speech-2.8-turbo',
        voice: 'ref_audio:anthony-voice.mp3',
        setupCostCents: MINIMAX_TTS_CLONE_COST_CENTS,
        setupTimeMs: MINIMAX_TTS_CLONE_SETUP_MS
      },
      {
        model: 'speech-2.8-hd',
        voice: 'ref_audio:anthony-voice.mp3',
        setupCostCents: undefined,
        setupTimeMs: undefined
      }
    ])
  })

  test('minimax clone options validate paired prompt inputs and clone voice_id rules', () => {
    expect(validateMinimaxTtsCloneVoiceId('AutoShow_123')).toBe('AutoShow_123')
    expect(() => validateMinimaxTtsCloneVoiceId('short')).toThrow('8-256')
    expect(() => validateMinimaxTtsCloneVoiceId('1AutoShow')).toThrow('start with an English letter')
    expect(() => validateMinimaxTtsCloneVoiceId('AutoShow!')).toThrow('only letters')
    expect(() => validateMinimaxTtsCloneVoiceId('AutoShow_')).toThrow('cannot end')

    const missingText = buildOptsFromFlags(false, {
      'minimax-tts': 'speech-2.8-turbo',
      'minimax-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
      'minimax-tts-prompt-audio': 'input/examples/audio/0-audio-short.mp3'
    })
    const missingAudio = buildOptsFromFlags(false, {
      'minimax-tts': 'speech-2.8-turbo',
      'minimax-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
      'minimax-tts-prompt-text': 'Reference transcript.'
    })
    const modifierWithoutClone = buildOptsFromFlags(false, {
      'minimax-tts': 'speech-2.8-turbo',
      'minimax-tts-clone-noise-reduction': true
    })

    expect(() => collectTtsTargets(missingText)).toThrow('requires --minimax-tts-prompt-text')
    expect(() => collectTtsTargets(missingAudio)).toThrow('requires --minimax-tts-prompt-audio')
    expect(() => collectTtsTargets(modifierWithoutClone)).toThrow('requires --minimax-tts-ref-audio')
  })

  test('minimax clone audio validation enforces file, extension, size, and duration', async () => {
    const source = await validateMinimaxTtsCloneAudio('input/examples/audio/anthony-voice.mp3', 'source')
    expect(source.basename).toBe('anthony-voice.mp3')
    expect(source.durationSeconds).toBeGreaterThanOrEqual(10)
    expect(source.durationSeconds).toBeLessThanOrEqual(5 * 60)

    const prompt = await validateMinimaxTtsCloneAudio('input/examples/audio/0-audio-short.mp3', 'prompt')
    expect(prompt.basename).toBe('0-audio-short.mp3')
    expect(prompt.durationSeconds).toBeLessThan(8)

    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-minimax-ref-audio-'))
    const emptyPath = join(tempDir, 'empty.mp3')
    const textPath = join(tempDir, 'not-audio.txt')
    const largePath = join(tempDir, 'large.mp3')
    await writeFile(emptyPath, '')
    await writeFile(textPath, 'hello')
    await writeFile(largePath, '')
    await truncate(largePath, 21 * 1024 * 1024)

    try {
      await expect(validateMinimaxTtsCloneAudio('input/examples/audio/missing.mp3', 'source')).rejects.toThrow('not found')
      await expect(validateMinimaxTtsCloneAudio(textPath, 'source')).rejects.toThrow('mp3, m4a, or wav')
      await expect(validateMinimaxTtsCloneAudio(emptyPath, 'source')).rejects.toThrow('is empty')
      await expect(validateMinimaxTtsCloneAudio(largePath, 'source')).rejects.toThrow('exceeds 20 MB')
      await expect(validateMinimaxTtsCloneAudio('input/examples/audio/0-audio-short.mp3', 'source')).rejects.toThrow('10 seconds to 5 minutes')
      await expect(validateMinimaxTtsCloneAudio('input/examples/audio/anthony-voice.mp3', 'prompt')).rejects.toThrow('less than 8 seconds')
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('minimax clone flow uploads once and reuses cloned voice across models', async () => {
    const previousKey = process.env['MINIMAX_API_KEY']
    const previousBaseUrl = process.env['MINIMAX_BASE_URL']
    const previousFetch = globalThis.fetch
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-minimax-clone-flow-'))
    const calls: Array<{ url: string, method: string, purpose?: string | undefined, body?: unknown }> = []

    try {
      process.env['MINIMAX_API_KEY'] = 'test-key'
      process.env['MINIMAX_BASE_URL'] = 'https://mock.minimax.local'
      const audioBytes = await Bun.file('input/examples/audio/0-audio-short.mp3').arrayBuffer()

      globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const url = String(input)
        const method = init?.method ?? 'GET'
        const body = init?.body
        if (url.endsWith('/v1/files/upload') && body instanceof FormData) {
          const purpose = String(body.get('purpose') ?? '')
          calls.push({ url, method, purpose })
          return new Response(JSON.stringify({
            file: { file_id: purpose === 'voice_clone' ? 'source-file-id' : 'prompt-file-id' },
            base_resp: { status_code: 0, status_msg: 'success' }
          }), { status: 200, headers: { 'content-type': 'application/json' } })
        }
        if (url.endsWith('/v1/voice_clone')) {
          const parsed = JSON.parse(String(body ?? '{}')) as unknown
          calls.push({ url, method, body: parsed })
          return new Response(JSON.stringify({
            demo_audio: '',
            base_resp: { status_code: 0, status_msg: 'success' }
          }), { status: 200, headers: { 'content-type': 'application/json' } })
        }
        if (url.endsWith('/v1/t2a_async_v2')) {
          const parsed = JSON.parse(String(body ?? '{}')) as unknown
          calls.push({ url, method, body: parsed })
          return new Response(JSON.stringify({
            task_id: `task-${calls.filter((call) => call.url.endsWith('/v1/t2a_async_v2')).length}`,
            base_resp: { status_code: 0, status_msg: 'success' }
          }), { status: 200, headers: { 'content-type': 'application/json' } })
        }
        if (url.includes('/v1/query/t2a_async_query_v2')) {
          calls.push({ url, method })
          return new Response(JSON.stringify({
            status: 2,
            file_id: 'speech-file-id',
            base_resp: { status_code: 0, status_msg: 'success' }
          }), { status: 200, headers: { 'content-type': 'application/json' } })
        }
        if (url.includes('/v1/files/retrieve_content')) {
          calls.push({ url, method })
          return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
        }
        throw new Error(`Unexpected MiniMax mock fetch: ${method} ${url}`)
      }) as typeof fetch

      const context = createMinimaxTtsCloneContext()
      const firstDir = join(tempDir, 'first')
      const secondDir = join(tempDir, 'second')
      await mkdir(firstDir, { recursive: true })
      await mkdir(secondDir, { recursive: true })
      const clone = {
        refAudioPath: 'input/examples/audio/anthony-voice.mp3',
        voiceId: 'AutoShowTestVoice',
        promptAudioPath: 'input/examples/audio/0-audio-short.mp3',
        promptText: 'Reference transcript.',
        needNoiseReduction: true,
        needVolumeNormalization: true,
        context
      }
      const first = await runMinimaxTts('Hello from the first model.', firstDir, {
        model: 'speech-2.8-turbo',
        clone
      })
      const second = await runMinimaxTts('Hello from the second model.', secondDir, {
        model: 'speech-2.8-hd',
        clone
      })

      expect(await Bun.file(first.audioPath).exists()).toBe(true)
      expect(await Bun.file(second.audioPath).exists()).toBe(true)
      expect(calls.filter((call) => call.url.endsWith('/v1/files/upload')).map((call) => call.purpose)).toEqual(['voice_clone', 'prompt_audio'])
      expect(calls.filter((call) => call.url.endsWith('/v1/voice_clone'))).toHaveLength(1)
      expect(calls.filter((call) => call.url.endsWith('/v1/t2a_async_v2'))).toHaveLength(2)
      expect(first.metadata).toMatchObject({
        speaker: 'ref_audio:anthony-voice.mp3',
        clonedVoiceId: 'AutoShowTestVoice',
        cloneCostCents: MINIMAX_TTS_CLONE_COST_CENTS
      })
      expect(second.metadata).toMatchObject({
        speaker: 'ref_audio:anthony-voice.mp3',
        clonedVoiceId: 'AutoShowTestVoice'
      })
      expect(second.metadata.cloneCostCents).toBeUndefined()

      const cloneRequest = calls.find((call) => call.url.endsWith('/v1/voice_clone'))?.body
      expect(cloneRequest).toEqual({
        file_id: 'source-file-id',
        voice_id: 'AutoShowTestVoice',
        clone_prompt: {
          prompt_audio: 'prompt-file-id',
          prompt_text: 'Reference transcript.'
        },
        need_noise_reduction: true,
        need_volume_normalization: true
      })
      expect(calls.filter((call) => call.url.endsWith('/v1/t2a_async_v2')).map((call) => call.body)).toEqual([
        expect.objectContaining({
          model: 'speech-2.8-turbo',
          voice_setting: { voice_id: 'AutoShowTestVoice' }
        }),
        expect.objectContaining({
          model: 'speech-2.8-hd',
          voice_setting: { voice_id: 'AutoShowTestVoice' }
        })
      ])
    } finally {
      globalThis.fetch = previousFetch
      if (previousKey === undefined) delete process.env['MINIMAX_API_KEY']
      else process.env['MINIMAX_API_KEY'] = previousKey
      if (previousBaseUrl === undefined) delete process.env['MINIMAX_BASE_URL']
      else process.env['MINIMAX_BASE_URL'] = previousBaseUrl
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('openai custom voice target records reference audio speaker and setup estimate', () => {
    const opts = buildOptsFromFlags(false, {
      'openai-tts': 'gpt-4o-mini-tts',
      'openai-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
      'openai-tts-consent-id': 'cons_123',
      'openai-tts-voice-name': 'AutoShowTestVoice'
    })
    const targets = collectTtsTargets(opts).filter((target) => target.service === 'openai')

    expect(opts.openaiTtsRefAudio).toBe('input/examples/audio/anthony-voice.mp3')
    expect(opts.openaiTtsConsentId).toBe('cons_123')
    expect(opts.openaiTtsVoiceName).toBe('AutoShowTestVoice')
    expect(targets.map((target) => ({
      model: target.model,
      voice: target.voice,
      setupCostCents: target.setupCostCents,
      setupTimeMs: target.setupTimeMs,
      setupNote: target.setupNote
    }))).toEqual([{
      model: 'gpt-4o-mini-tts',
      voice: 'ref_audio:anthony-voice.mp3',
      setupCostCents: 0,
      setupTimeMs: OPENAI_TTS_CLONE_SETUP_MS,
      setupNote: 'OpenAI custom voice creation setup'
    }])
  })

  test('openai custom voice options validate provider selection, consent source, and voice reuse', () => {
    const missingOpenAIModel = buildOptsFromFlags(false, {
      'openai-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
      'openai-tts-consent-id': 'cons_123'
    })
    const missingConsent = buildOptsFromFlags(false, {
      'openai-tts': 'gpt-4o-mini-tts',
      'openai-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3'
    })
    const tooManyConsentSources = buildOptsFromFlags(false, {
      'openai-tts': 'gpt-4o-mini-tts',
      'openai-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
      'openai-tts-consent-id': 'cons_123',
      'openai-tts-consent-audio': 'input/examples/audio/0-audio-short.mp3'
    })
    const voiceWithClone = buildOptsFromFlags(false, {
      'openai-tts': 'gpt-4o-mini-tts',
      'openai-voice': 'alloy',
      'openai-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
      'openai-tts-consent-id': 'cons_123'
    })
    const consentWithoutReference = buildOptsFromFlags(false, {
      'openai-tts': 'gpt-4o-mini-tts',
      'openai-tts-consent-id': 'cons_123'
    })
    const existingCustomVoice = buildOptsFromFlags(false, {
      'openai-tts': 'gpt-4o-mini-tts',
      'openai-voice': 'voice_existing123'
    })

    expect(() => collectTtsTargets(missingOpenAIModel)).toThrow('require --openai-tts <model> or --all-tts')
    expect(() => collectTtsTargets(missingConsent)).toThrow('requires exactly one of --openai-tts-consent-id or --openai-tts-consent-audio')
    expect(() => collectTtsTargets(tooManyConsentSources)).toThrow('requires exactly one of --openai-tts-consent-id or --openai-tts-consent-audio')
    expect(() => collectTtsTargets(voiceWithClone)).toThrow('cannot be combined with --openai-voice')
    expect(() => collectTtsTargets(consentWithoutReference)).toThrow('requires --openai-tts-ref-audio')
    expect(collectTtsTargets(existingCustomVoice).map((target) => target.voice)).toEqual(['voice_existing123'])
  })

  test('openai custom voice audio validation enforces file, extension, and size', async () => {
    const sample = await validateOpenAITtsCustomVoiceAudio('input/examples/audio/anthony-voice.mp3', 'sample audio')
    expect(sample.basename).toBe('anthony-voice.mp3')
    expect(sample.mimeType).toBe('audio/mpeg')

    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-openai-ref-audio-'))
    const emptyPath = join(tempDir, 'empty.mp3')
    const textPath = join(tempDir, 'not-audio.txt')
    const largePath = join(tempDir, 'large.mp3')
    await writeFile(emptyPath, '')
    await writeFile(textPath, 'hello')
    await writeFile(largePath, '')
    await truncate(largePath, 11 * 1024 * 1024)

    try {
      await expect(validateOpenAITtsCustomVoiceAudio('input/examples/audio/missing.mp3', 'sample audio')).rejects.toThrow('not found')
      await expect(validateOpenAITtsCustomVoiceAudio(textPath, 'sample audio')).rejects.toThrow('mp3/mpeg, wav, ogg, aac, flac, webm, mp4, or m4a')
      await expect(validateOpenAITtsCustomVoiceAudio(emptyPath, 'sample audio')).rejects.toThrow('is empty')
      await expect(validateOpenAITtsCustomVoiceAudio(largePath, 'sample audio')).rejects.toThrow('exceeds 10 MiB')
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('openai custom voice flow uploads consent once and reuses cloned voice across runs', async () => {
    const previousKey = process.env['OPENAI_API_KEY']
    const previousBaseUrl = process.env['OPENAI_BASE_URL']
    const previousFetch = globalThis.fetch
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-openai-clone-flow-'))
    const calls: Array<{ url: string, method: string, body?: unknown }> = []

    try {
      process.env['OPENAI_API_KEY'] = 'test-key'
      process.env['OPENAI_BASE_URL'] = 'https://mock.openai.local/v1'
      const audioBytes = await Bun.file('input/examples/audio/0-audio-short.mp3').arrayBuffer()

      globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const url = typeof input === 'string' || input instanceof URL ? String(input) : input.url
        const method = init?.method ?? 'GET'
        const body = init?.body

        if (url.endsWith('/audio/voice_consents') && body instanceof FormData) {
          calls.push({
            url,
            method,
            body: {
              name: body.get('name'),
              language: body.get('language'),
              hasRecording: body.get('recording') instanceof Blob
            }
          })
          return new Response(JSON.stringify({ id: 'cons_mock' }), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        }
        if (url.endsWith('/audio/voices') && body instanceof FormData) {
          calls.push({
            url,
            method,
            body: {
              name: body.get('name'),
              consent: body.get('consent'),
              hasAudioSample: body.get('audio_sample') instanceof Blob
            }
          })
          return new Response(JSON.stringify({
            id: 'voice_mock123',
            object: 'audio.voice',
            name: 'AutoShowTestVoice',
            created_at: 1
          }), { status: 200, headers: { 'content-type': 'application/json' } })
        }
        if (url.endsWith('/audio/speech')) {
          const parsed = JSON.parse(String(body ?? '{}')) as unknown
          calls.push({ url, method, body: parsed })
          return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
        }
        throw new Error(`Unexpected OpenAI mock fetch: ${method} ${url}`)
      }) as typeof fetch

      const context = createOpenAITtsCustomVoiceContext()
      const firstDir = join(tempDir, 'first')
      const secondDir = join(tempDir, 'second')
      await mkdir(firstDir, { recursive: true })
      await mkdir(secondDir, { recursive: true })
      const clone = {
        refAudioPath: 'input/examples/audio/anthony-voice.mp3',
        consentAudioPath: 'input/examples/audio/0-audio-short.mp3',
        consentLanguage: 'en-US',
        consentName: 'Consent Test',
        voiceName: 'AutoShowTestVoice',
        context
      }
      const first = await runOpenAITts('Hello from the first model.', firstDir, {
        model: 'gpt-4o-mini-tts',
        clone
      })
      const second = await runOpenAITts('Hello from the second model.', secondDir, {
        model: 'gpt-4o-mini-tts',
        clone
      })

      expect(await Bun.file(first.audioPath).exists()).toBe(true)
      expect(await Bun.file(second.audioPath).exists()).toBe(true)
      expect(calls.filter((call) => call.url.endsWith('/audio/voice_consents'))).toHaveLength(1)
      expect(calls.filter((call) => call.url.endsWith('/audio/voices'))).toHaveLength(1)
      expect(calls.filter((call) => call.url.endsWith('/audio/speech'))).toHaveLength(2)
      expect(calls.find((call) => call.url.endsWith('/audio/voice_consents'))?.body).toEqual({
        name: 'Consent Test',
        language: 'en-US',
        hasRecording: true
      })
      expect(calls.find((call) => call.url.endsWith('/audio/voices'))?.body).toEqual({
        name: 'AutoShowTestVoice',
        consent: 'cons_mock',
        hasAudioSample: true
      })
      expect(calls.filter((call) => call.url.endsWith('/audio/speech')).map((call) => call.body)).toEqual([
        expect.objectContaining({ model: 'gpt-4o-mini-tts', voice: { id: 'voice_mock123' } }),
        expect.objectContaining({ model: 'gpt-4o-mini-tts', voice: { id: 'voice_mock123' } })
      ])
      expect(first.metadata).toMatchObject({
        speaker: 'ref_audio:anthony-voice.mp3',
        clonedVoiceId: 'voice_mock123',
        cloneCostCents: 0
      })
      expect(second.metadata).toMatchObject({
        speaker: 'ref_audio:anthony-voice.mp3',
        clonedVoiceId: 'voice_mock123',
        cloneCostCents: 0
      })
    } finally {
      globalThis.fetch = previousFetch
      if (previousKey === undefined) delete process.env['OPENAI_API_KEY']
      else process.env['OPENAI_API_KEY'] = previousKey
      if (previousBaseUrl === undefined) delete process.env['OPENAI_BASE_URL']
      else process.env['OPENAI_BASE_URL'] = previousBaseUrl
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('deapi tts voice and reference audio are mutually exclusive at target collection', () => {
    const opts = buildOptsFromFlags(false, {
      'deapi-tts': 'Qwen3_TTS_12Hz_1_7B_Base',
      'deapi-tts-voice': 'Vivian',
      'deapi-tts-ref-audio': 'input/examples/audio/0-audio-short.mp3'
    })

    expect(() => collectTtsTargets(opts)).toThrow('Use either --deapi-tts-voice or --deapi-tts-ref-audio, not both')
  })

  test('deapi tts rejects unsupported clone model combinations', () => {
    const cloneWithPresetModel = buildOptsFromFlags(false, {
      'deapi-tts': 'Kokoro',
      'deapi-tts-ref-audio': 'input/examples/audio/0-audio-short.mp3'
    })
    const cloneWithoutAudio = buildOptsFromFlags(false, {
      'deapi-tts': 'Qwen3_TTS_12Hz_1_7B_Base'
    })
    const voiceDesign = buildOptsFromFlags(false, {
      'deapi-tts': 'Qwen3_TTS_12Hz_1_7B_VoiceDesign'
    })

    expect(() => collectTtsTargets(cloneWithPresetModel)).toThrow('voice cloning is only supported for Qwen3_TTS_12Hz_1_7B_Base')
    expect(() => collectTtsTargets(cloneWithoutAudio)).toThrow('requires --deapi-tts-ref-audio')
    expect(() => collectTtsTargets(voiceDesign)).toThrow('requires voice design instruction inputs')
  })

  test('deapi tts reference audio validation enforces file, extension, size, and duration', async () => {
    const valid = await validateDeapiTtsReferenceAudio('input/examples/audio/0-audio-short.mp3')
    expect(valid.basename).toBe('0-audio-short.mp3')
    expect(valid.durationSeconds).toBeGreaterThanOrEqual(3)
    expect(valid.durationSeconds).toBeLessThanOrEqual(10)

    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-deapi-ref-audio-'))
    const emptyPath = join(tempDir, 'empty.mp3')
    const textPath = join(tempDir, 'not-audio.txt')
    const largePath = join(tempDir, 'large.mp3')
    await writeFile(emptyPath, '')
    await writeFile(textPath, 'hello')
    await writeFile(largePath, '')
    await truncate(largePath, 11 * 1024 * 1024)

    try {
      await expect(validateDeapiTtsReferenceAudio('input/examples/audio/missing.mp3')).rejects.toThrow('not found')
      await expect(validateDeapiTtsReferenceAudio(textPath)).rejects.toThrow('mp3, wav, flac, ogg, or m4a')
      await expect(validateDeapiTtsReferenceAudio(emptyPath)).rejects.toThrow('is empty')
      await expect(validateDeapiTtsReferenceAudio(largePath)).rejects.toThrow('exceeds 10 MB')
      await expect(validateDeapiTtsReferenceAudio('input/examples/audio/anthony-voice.mp3')).rejects.toThrow('must be 3-10 seconds long')
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('grok tts voice validation normalizes case', () => {
    const opts = buildOptsFromFlags(false, {
      'grok-tts': ['grok-tts'],
      'grok-tts-voice': 'EVE'
    })
    const targets = collectTtsTargets(opts).filter((target) => target.service === 'grok')

    expect(opts.grokTtsVoice).toBe(GROK_DEFAULT_TTS_VOICE)
    expect(targets.map((target) => target.voice)).toEqual([GROK_DEFAULT_TTS_VOICE])
  })

  test('explicit deepgram tts flags can still select multiple voices', () => {
    const opts = buildOptsFromFlags(false, {
      'deepgram-tts': ['aura-2-thalia-en', 'aura-2-andromeda-en']
    })
    const deepgramTargets = collectTtsTargets(opts).filter((target) => target.service === 'deepgram')

    expect(opts.deepgramTtsModels).toEqual(['aura-2-thalia-en', 'aura-2-andromeda-en'])
    expect(deepgramTargets.map((target) => target.model)).toEqual(['aura-2-thalia-en', 'aura-2-andromeda-en'])
  })

  test('OCR provider pools enforce hosted and local limits independently', async () => {
    const targets: OcrTarget[] = [
      { service: 'tesseract', model: 'tesseract' },
      { service: 'mistral', model: 'mistral-ocr-2512' },
      { service: 'openai', model: 'gpt-5.4-nano' },
      { service: 'paddle-ocr', model: 'paddle-ocr' },
      { service: 'gemini', model: 'gemini-3.1-flash-lite-preview' }
    ]
    const active = { local: 0, hosted: 0, total: 0 }
    const max = { local: 0, hosted: 0, total: 0 }
    const completedIndices: number[] = []

    await runOcrProviderTargetPools(targets, targets, { provider: 2, local: 1 }, async (index, target) => {
      const group = isLocalOcrTarget(target) ? 'local' : 'hosted'
      active[group] += 1
      active.total += 1
      max[group] = Math.max(max[group], active[group])
      max.total = Math.max(max.total, active.total)

      await Bun.sleep(5)

      completedIndices.push(index)
      active[group] -= 1
      active.total -= 1
    })

    expect(max.local).toBe(1)
    expect(max.hosted).toBe(2)
    expect(max.total).toBe(3)
    expect([...completedIndices].sort((left, right) => left - right)).toEqual([0, 1, 2, 3, 4])
  })

  test('LLM provider pools enforce hosted and local limits independently and preserve target indexes', async () => {
    const metadata = (service: Step3Metadata['llmService'], model: string): Step3Metadata => ({
      llmService: service,
      llmModel: model,
      processingTime: 0,
      inputTokenCount: 0,
      outputTokenCount: 0,
      outputFileName: 'text.json',
      outputFormat: 'json',
      structuredMode: 'native',
      structuredPresetNames: []
    })
    const target = (service: Step3Metadata['llmService'], model: string): LLMTarget => ({
      service,
      model,
      label: service,
      run: async () => ({ result: '{}', metadata: metadata(service, model) })
    })
    const targets: LLMTarget[] = [
      target('llama.cpp', 'local-a'),
      target('openai', 'hosted-a'),
      target('groq', 'hosted-b'),
      target('glm', 'hosted-glm'),
      target('llama.cpp', 'local-b'),
      target('gemini', 'hosted-c')
    ]
    const active = { local: 0, hosted: 0, total: 0 }
    const max = { local: 0, hosted: 0, total: 0 }
    const orderedModels: string[] = []

    await runLlmProviderTargetPools(targets, { provider: 2, local: 1 }, async (index, llmTarget) => {
      const group = isLocalLlmTarget(llmTarget) ? 'local' : 'hosted'
      active[group] += 1
      active.total += 1
      max[group] = Math.max(max[group], active[group])
      max.total = Math.max(max.total, active.total)

      await Bun.sleep(5)

      orderedModels[index] = llmTarget.model
      active[group] -= 1
      active.total -= 1
    })

    expect(max.local).toBe(1)
    expect(max.hosted).toBe(2)
    expect(max.total).toBe(3)
    expect(orderedModels).toEqual(targets.map((entry) => entry.model))
  })
})
