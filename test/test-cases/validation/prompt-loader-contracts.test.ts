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

const CREATIVE_WRITING_PROMPTS = [
  {
    promptName: 'poetryCollection',
    presetName: 'poetryCollection',
    requiredKeys: ['title', 'theme', 'poems', 'collectionNotes']
  },
  {
    promptName: 'screenplay',
    presetName: 'screenplay',
    requiredKeys: ['title', 'logline', 'scenes', 'productionNotes']
  },
  {
    promptName: 'shortStory',
    presetName: 'shortStory',
    requiredKeys: ['title', 'genre', 'acts', 'themes']
  }
] as const

const getRequiredStringKeys = (jsonSchema: Record<string, unknown>, promptName: string): string[] => {
  const required = jsonSchema['required']
  if (!Array.isArray(required)) {
    throw new Error(`Expected ${promptName} schema required fields to be an array`)
  }

  if (!required.every((entry): entry is string => typeof entry === 'string')) {
    throw new Error(`Expected ${promptName} schema required fields to be strings`)
  }

  return [...required].sort()
}

const getObjectProperties = (jsonSchema: Record<string, unknown>, promptName: string): Record<string, unknown> => {
  const properties = jsonSchema['properties']
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    throw new Error(`Expected ${promptName} schema properties to be an object`)
  }

  return properties as Record<string, unknown>
}

describe('prompt loader contracts', () => {
  test('discovers categorized prompt entries by basename', async () => {
    const names = await getAvailablePromptNames()
    const expectedNames = [
      'shortSummary',
      'shortChapters',
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
    expect(prompt).toContain('Create chapter titles and one-paragraph descriptions')
  })

  test('resolves song lyric prompts to standardSongLyrics or rapSongLyrics preset', async () => {
    const presetNames = await resolvePresetNames(SONG_LYRIC_PROMPTS)

    expect(presetNames).toEqual([
      'standardSongLyrics',
      'standardSongLyrics',
      'standardSongLyrics',
      'standardSongLyrics',
      'rapSongLyrics',
      'standardSongLyrics'
    ])
  })

  test('resolves creative writing prompts to dedicated structured presets', async () => {
    const promptNames = CREATIVE_WRITING_PROMPTS.map(({ promptName }) => promptName)
    const presetNames = await resolvePresetNames(promptNames)

    expect(presetNames).toEqual(CREATIVE_WRITING_PROMPTS.map(({ presetName }) => presetName))
  })

  test('creative writing schemas require distinct top-level fields without content envelope', async () => {
    const requiredShapes: string[] = []

    for (const { promptName, presetName, requiredKeys } of CREATIVE_WRITING_PROMPTS) {
      const schema = await resolveStructuredSchema([promptName])
      const required = getRequiredStringKeys(schema.jsonSchema, promptName)
      const properties = getObjectProperties(schema.jsonSchema, promptName)

      expect(schema.presetNames).toEqual([presetName])
      expect(required).toEqual([...requiredKeys].sort())
      expect(required).not.toContain('content')
      expect(Object.keys(properties)).not.toContain('content')

      for (const key of requiredKeys) {
        expect(Object.keys(properties)).toContain(key)
      }

      const oldEnvelopeValidation = parseAndValidateStructured(
        schema.schema,
        '{ "content": "Legacy freeform text." }'
      )
      expect(oldEnvelopeValidation.success).toBe(false)

      requiredShapes.push(required.join('|'))
    }

    expect(new Set(requiredShapes).size).toBe(CREATIVE_WRITING_PROMPTS.length)
  })

  test('standard song lyric schema requires title and section fields', async () => {
    const schema = await resolveStructuredSchema(['rockSong'])
    const required = getRequiredStringKeys(schema.jsonSchema, 'rockSong')
    const properties = getObjectProperties(schema.jsonSchema, 'rockSong')

    expect(schema.presetNames).toEqual(['standardSongLyrics'])
    expect(required).toContain('title')
    expect(required).toContain('verse1')
    expect(required).toContain('chorus')
    expect(required).toContain('verse2')
    expect(required).toContain('bridge')
    expect(required).toContain('finalChorus')
    expect(required).not.toContain('lyrics')

    const propKeys = Object.keys(properties)
    expect(propKeys).toContain('title')
    expect(propKeys).toContain('verse1')
    expect(propKeys).toContain('chorus')
    expect(propKeys).toContain('verse2')
    expect(propKeys).toContain('bridge')
    expect(propKeys).toContain('finalChorus')
  })

  test('rap song lyric schema requires title and three verse/chorus pairs', async () => {
    const schema = await resolveStructuredSchema(['rapSong'])
    const required = getRequiredStringKeys(schema.jsonSchema, 'rapSong')

    expect(schema.presetNames).toEqual(['rapSongLyrics'])
    expect(required).toContain('title')
    expect(required).toContain('verse1')
    expect(required).toContain('chorus1')
    expect(required).toContain('verse2')
    expect(required).toContain('chorus2')
    expect(required).toContain('verse3')
    expect(required).toContain('chorus3')
    expect(required).not.toContain('lyrics')
  })

  test('song lyric validation overrides the title before storage', async () => {
    const schema = await resolveStructuredSchema(['rockSong'])
    const validation = parseAndValidateStructured(
      schema.schema,
      '{ "title": "Model Title", "verse1": "Line one", "chorus": "Hook line", "verse2": "Line two", "bridge": "Bridge line", "finalChorus": "Final hook" }',
      {
        leafPromptNames: schema.leafPromptNames,
        presetNames: schema.presetNames,
        songLyricsTitle: 'Track One'
      }
    )

    expect(validation.success).toBe(true)
    expect(validation.value).toEqual({
      title: 'Track One',
      verse1: 'Line one',
      chorus: 'Hook line',
      verse2: 'Line two',
      bridge: 'Bridge line',
      finalChorus: 'Final hook'
    })
  })

  test('multi-prompt song lyric validation only injects title into song lyric leaves', async () => {
    const schema = await resolveStructuredSchema(['rockSong', 'shortSummary'])
    const validation = parseAndValidateStructured(
      schema.schema,
      '{ "rockSong": { "verse1": "Line one", "chorus": "Hook", "verse2": "Line two", "bridge": "Bridge", "finalChorus": "Final" }, "shortSummary": { "episodeDescription": "A short episode description for testing purposes that validates the schema constraints properly.", "episodeSummary": "This is a test summary that needs to be at least fifty characters long to pass validation." } }',
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
        verse1: 'Line one',
        chorus: 'Hook',
        verse2: 'Line two',
        bridge: 'Bridge',
        finalChorus: 'Final'
      },
      shortSummary: {
        episodeDescription: 'A short episode description for testing purposes that validates the schema constraints properly.',
        episodeSummary: 'This is a test summary that needs to be at least fifty characters long to pass validation.'
      }
    })
  })
})
