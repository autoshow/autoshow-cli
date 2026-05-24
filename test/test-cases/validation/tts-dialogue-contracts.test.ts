import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import {
  detectVoiceKind,
  normalizeDialogueText,
  parseSpeakerRefAudioMappings,
  parseSpeakerVoiceMappings
} from '~/cli/commands/process-steps/step-4-tts/dialogue-normalizer'

describe('TTS dialogue contracts', () => {
  test('screenplay normalization extracts configured speaker dialogue and omits directions', async () => {
    const input = await Bun.file('input/uss/chat-and-duco.txt').text()
    const registry = parseSpeakerRefAudioMappings([
      'DUCO=input/examples/audio/anthony-voice.mp3',
      'CHAT=https://ajc.pics/autoshow/examples/0-audio-short.mp3'
    ])
    const normalized = normalizeDialogueText(input, 'screenplay', registry)

    expect(normalized.turns.length).toBeGreaterThan(10)
    expect(normalized.normalizedText).toContain('DUCO: Okay, lets do this.')
    expect(normalized.normalizedText).toContain('DUCO: Hey, CHAT. What do you know about medical stuff?')
    expect(normalized.normalizedText).toContain('CHAT: Hello Duco! I possess a general, non-certified')
    expect(normalized.normalizedText).toContain('DUCO: Well, like')
    expect(normalized.normalizedText).not.toContain('(bright and friendly)')
    expect(normalized.normalizedText).not.toContain('(frowning)')
    expect(normalized.normalizedText).not.toContain('DUCO freezes')
    expect(normalized.normalizedText).not.toContain('DUCO: Duco sits down')
  })

  test('labeled normalization accepts canonical speaker lines and rejects unknown speakers', () => {
    const registry = parseSpeakerRefAudioMappings([
      'DUCO=input/examples/audio/anthony-voice.mp3'
    ])

    expect(normalizeDialogueText('DUCO: Hello there.', 'labeled', registry).normalizedText)
      .toBe('DUCO: Hello there.')
    expect(() => normalizeDialogueText('CHAT: Hello Duco.', 'labeled', registry))
      .toThrow('No --tts-speaker mapping found for speaker CHAT')
  })

  test('multi-speaker validates provider selection and speaker mappings', () => {
    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'tts-dialogue-format': 'screenplay',
      'tts-speaker-ref-audio': 'DUCO=input/examples/audio/anthony-voice.mp3'
    }))).toThrow('requires at least one TTS provider')

    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'mistral-tts': 'voxtral-mini-tts-2603',
      'tts-dialogue-format': 'screenplay'
    }))).toThrow('requires at least one --tts-speaker')

    // Multi-provider multi-speaker is now allowed
    const targets = collectTtsTargets(buildOptsFromFlags(false, {
      'mistral-tts': 'voxtral-mini-tts-2603',
      'openai-tts': 'gpt-4o-mini-tts',
      'tts-dialogue-format': 'labeled',
      'tts-speaker': ['DUCO=input/examples/audio/anthony-voice.mp3', 'CHAT=alloy']
    }))
    expect(targets.length).toBe(2)
    expect(targets.every((t) => t.multiSpeakerStrategy !== undefined)).toBe(true)
  })

  test('parseSpeakerVoiceMappings parses voice IDs and ref audio paths', () => {
    const registry = parseSpeakerVoiceMappings([
      'Host=Kore',
      'Guest=input/audio/voice.mp3'
    ])
    expect(registry.entries.length).toBe(2)
    expect(registry.entries[0]?.voiceKind).toBe('id')
    expect(registry.entries[0]?.voice).toBe('Kore')
    expect(registry.entries[1]?.voiceKind).toBe('ref-audio')
    expect(registry.entries[1]?.voice).toBe('input/audio/voice.mp3')
  })

  test('detectVoiceKind classifies voice IDs and ref audio paths', () => {
    expect(detectVoiceKind('Kore')).toBe('id')
    expect(detectVoiceKind('alloy')).toBe('id')
    expect(detectVoiceKind('input/audio/voice.mp3')).toBe('ref-audio')
    expect(detectVoiceKind('voice.wav')).toBe('ref-audio')
    expect(detectVoiceKind('https://example.com/audio.mp3')).toBe('ref-audio')
    expect(detectVoiceKind('C:\\audio\\voice.m4a')).toBe('ref-audio')
  })

  test('new --tts-speaker flag works with voice IDs for multi-speaker', () => {
    const targets = collectTtsTargets(buildOptsFromFlags(false, {
      'openai-tts': 'gpt-4o-mini-tts',
      'tts-dialogue-format': 'labeled',
      'tts-speaker': ['Alice=alloy', 'Bob=onyx']
    }))
    expect(targets.length).toBe(1)
    expect(targets[0]?.service).toBe('openai')
    expect(targets[0]?.multiSpeakerStrategy).toBe('segment-and-concat')
  })

  test('ref-audio speakers rejected for providers that do not support ref audio', () => {
    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'groq-tts': 'canopylabs/orpheus-v1-english',
      'tts-dialogue-format': 'labeled',
      'tts-speaker': ['DUCO=input/examples/audio/anthony-voice.mp3', 'CHAT=input/examples/audio/voice.mp3']
    }))).toThrow('does not support reference audio')
  })
})
