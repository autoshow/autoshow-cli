import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import {
  normalizeDialogueText,
  parseSpeakerRefAudioMappings
} from '~/cli/commands/process-steps/step-4-tts/dialogue-normalizer'

describe('TTS dialogue contracts', () => {
  test('screenplay normalization extracts configured speaker dialogue and omits directions', async () => {
    const input = await Bun.file('input/chat-and-duco.txt').text()
    const registry = parseSpeakerRefAudioMappings([
      'DUCO=input/examples/audio/anthony-voice.mp3',
      'CHAT=input/examples/audio/0-audio-short.mp3'
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
      .toThrow('No --tts-speaker-ref-audio mapping found for speaker CHAT')
  })

  test('dialogue mode validates Mistral-only target selection and speaker mappings', () => {
    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'tts-dialogue-format': 'screenplay',
      'tts-speaker-ref-audio': 'DUCO=input/examples/audio/anthony-voice.mp3'
    }))).toThrow('requires exactly one --mistral-tts')

    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'mistral-tts': 'voxtral-mini-tts-2603',
      'tts-dialogue-format': 'screenplay'
    }))).toThrow('requires at least one --tts-speaker-ref-audio')

    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'mistral-tts': 'voxtral-mini-tts-2603',
      'openai-tts': 'gpt-4o-mini-tts',
      'tts-dialogue-format': 'labeled',
      'tts-speaker-ref-audio': 'DUCO=input/examples/audio/anthony-voice.mp3'
    }))).toThrow('cannot be combined with other TTS providers')

    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'all-tts': true,
      'tts-dialogue-format': 'labeled',
      'tts-speaker-ref-audio': 'DUCO=input/examples/audio/anthony-voice.mp3'
    }))).toThrow('cannot be combined with other TTS providers')
  })
})
