import { describe, expect, test } from 'bun:test'
import { getAvailablePromptNames, resolvePresetNames, resolvePromptNames } from '~/prompts/prompt-loader'
import { resolveStructuredSchema } from '~/cli/commands/process-steps/step-3-write/structured-output/schema-resolver'
import { parseAndValidateStructured } from '~/cli/commands/process-steps/step-3-write/structured-output/validator'

const SONG_LYRIC_PROMPTS = [
  'countrySong',
  'folkSong',
  'jazzSong',
  'popSong',
  'rapSong',
  'rockSong'
]

describe('prompt loader contracts', () => {
  test('discovers categorized prompt entries by basename', async () => {
    const names = await getAvailablePromptNames()
    const expectedNames = [
      'shortSummary',
      'chapters',
      'rockSong',
      'facebook',
      'youtubeDescription',
      'blog',
      'screenplay'
    ]

    for (const name of expectedNames) {
      expect(names).toContain(name)
    }
  })

  test('does not expose category-qualified prompt names', async () => {
    const names = await getAvailablePromptNames()

    expect(names).not.toContain('summary-and-overview/shortSummary')
    expect(names).not.toContain('chapters/chapters')
    expect(names).not.toContain('social-media/youtubeDescription')
  })

  test('resolves default composite prompt with existing include names', async () => {
    const prompt = await resolvePromptNames(['default'])

    expect(prompt).toContain('Write a one-sentence description of the transcript')
    expect(prompt).toContain('Write a one-paragraph summary')
    expect(prompt).toContain('Create chapter titles and descriptions')
  })

  test('resolves all song lyric prompts to the shared songLyrics structured preset', async () => {
    const presetNames = await resolvePresetNames(SONG_LYRIC_PROMPTS)

    expect(presetNames).toEqual(SONG_LYRIC_PROMPTS.map(() => 'songLyrics'))
  })

  test('song lyric structured schema requires title and lyrics fields', async () => {
    const schema = await resolveStructuredSchema(['rockSong'])
    const required = schema.jsonSchema['required']
    const properties = schema.jsonSchema['properties']

    expect(schema.presetNames).toEqual(['songLyrics'])
    expect(Array.isArray(required)).toBe(true)
    if (Array.isArray(required)) {
      expect(required).toContain('title')
      expect(required).toContain('lyrics')
    }

    expect(properties && typeof properties === 'object' && !Array.isArray(properties)).toBe(true)
    if (properties && typeof properties === 'object' && !Array.isArray(properties)) {
      expect(Object.keys(properties)).toContain('title')
      expect(Object.keys(properties)).toContain('lyrics')
    }
  })

  test('song lyric validation overrides the title before storage', async () => {
    const schema = await resolveStructuredSchema(['rockSong'])
    const validation = parseAndValidateStructured(
      schema.schema,
      '{ "title": "Model Title", "lyrics": "Verse 1\\n\\nLine one" }',
      {
        leafPromptNames: schema.leafPromptNames,
        presetNames: schema.presetNames,
        songLyricsTitle: 'Track One'
      }
    )

    expect(validation.success).toBe(true)
    expect(validation.value).toEqual({
      title: 'Track One',
      lyrics: 'Verse 1\n\nLine one'
    })
  })

  test('multi-prompt song lyric validation only injects title into song lyric leaves', async () => {
    const schema = await resolveStructuredSchema(['rockSong', 'shortSummary'])
    const validation = parseAndValidateStructured(
      schema.schema,
      '{ "rockSong": { "lyrics": "Verse 1" }, "shortSummary": { "episodeDescription": "A short summary." } }',
      {
        leafPromptNames: schema.leafPromptNames,
        presetNames: schema.presetNames,
        songLyricsTitle: 'Track One'
      }
    )

    expect(validation.success).toBe(true)
    expect(validation.value).toEqual({
      rockSong: {
        title: 'Track One',
        lyrics: 'Verse 1'
      },
      shortSummary: {
        episodeDescription: 'A short summary.'
      }
    })
  })
})
