import { describe, test, expect } from 'bun:test'
import { resolvePromptNames, resolvePromptTokenEstimate } from '~/prompts/prompt-loader'

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

  test('default prompt still resolves instructions', async () => {
    const resolved = await resolvePromptNames([])
    expect(resolved).toContain('Episode Description')
    expect(resolved).toContain('Episode Summary')
    expect(resolved).toContain('## Chapters')
  })
})
