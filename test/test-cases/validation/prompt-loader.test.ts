import { describe, test, expect } from 'bun:test'
import { getAvailablePromptNames, resolvePromptNames, resolvePromptTokenEstimate } from '~/prompts/prompt-loader'

describe('prompt loader token estimates', () => {
  test('default estimate matches explicit included prompts', async () => {
    const defaultEstimate = await resolvePromptTokenEstimate([])
    const expandedEstimate = await resolvePromptTokenEstimate(['shortSummary', 'longSummary', 'chapters'])

    expect(defaultEstimate.estimatedInputTokens).toBe(expandedEstimate.estimatedInputTokens)
    expect(defaultEstimate.estimatedOutputTokens).toBe(expandedEstimate.estimatedOutputTokens)
  })

  test('duplicate prompts are counted once', async () => {
    const singleEstimate = await resolvePromptTokenEstimate(['shortSummary'])
    const duplicateEstimate = await resolvePromptTokenEstimate(['shortSummary', 'shortSummary'])

    expect(duplicateEstimate.estimatedInputTokens).toBe(singleEstimate.estimatedInputTokens)
    expect(duplicateEstimate.estimatedOutputTokens).toBe(singleEstimate.estimatedOutputTokens)
    expect(duplicateEstimate.resolvedLeafPromptNames).toEqual(singleEstimate.resolvedLeafPromptNames)
  })

  test('unknown prompt fails estimation', async () => {
    await expect(resolvePromptTokenEstimate(['missing-prompt'])).rejects.toThrow('Unknown prompt')
  })

  test('default prompt resolves JSON examples', async () => {
    const resolved = await resolvePromptNames([])
    expect(resolved).toContain('Example JSON output:')
    expect(resolved).toContain('"shortSummary": {')
    expect(resolved).toContain('"longSummary": {')
    expect(resolved).toContain('"chapters": {')
  })

  test('markdown prompt examples remain selectable', async () => {
    const resolved = await resolvePromptNames([], { exampleFormat: 'markdown' })
    expect(resolved.match(/Format the output like so:/g)?.length).toBe(1)
    expect(resolved.indexOf('- Write a one-sentence description of the transcript.')).toBeLessThan(
      resolved.indexOf('Format the output like so:')
    )
    expect(resolved).toContain('## Episode Description')
    expect(resolved).toContain('## Episode Summary')
    expect(resolved).toContain('## Chapters')
  })

  test('available prompt names are deterministic and include all split prompt files', async () => {
    expect(await getAvailablePromptNames()).toEqual([
      'blog',
      'bulletPoints',
      'chapters',
      'chapterTitles',
      'chapterTitlesAndQuotes',
      'contentStrategy',
      'countrySong',
      'default',
      'emailNewsletter',
      'facebook',
      'faq',
      'folkSong',
      'instagram',
      'jazzSong',
      'keyMoments',
      'linkedin',
      'longChapters',
      'longSummary',
      'mediumChapters',
      'metadata',
      'poetryCollection',
      'popSong',
      'questions',
      'quotes',
      'rapSong',
      'rockSong',
      'screenplay',
      'seoArticle',
      'shortChapters',
      'shortStory',
      'shortSummary',
      'summary',
      'takeaways',
      'tiktok',
      'titles',
      'x',
      'youtubeDescription'
    ])
  })
})
