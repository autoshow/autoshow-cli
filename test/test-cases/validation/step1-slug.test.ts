import { describe, expect, test } from 'bun:test'
import {
  buildDocumentStep1Slug,
  buildMediaStep1Slug,
  getSourceBasenameWithoutExtension
} from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'

describe('step1 slug helpers', () => {
  test('preserves local file basename and strips only the final extension', () => {
    expect(getSourceBasenameWithoutExtension({ filePath: '/tmp/My.File.Name.final.mp3' })).toBe('My.File.Name.final')
  })

  test('decodes URL filenames before removing the final extension', () => {
    expect(getSourceBasenameWithoutExtension({
      url: 'https://example.com/files/Quarterly%20Report.v1.pdf'
    })).toBe('Quarterly Report.v1')
  })

  test('media slug falls back to the current title-derived behavior when no filename exists', () => {
    expect(buildMediaStep1Slug(
      { url: 'https://www.youtube.com/watch?v=abc123' },
      { title: 'A Great Episode', publishDate: '2026-04-10' }
    )).toBe('2026-04-10-a-great-episode')
  })

  test('document slug uses the source filename when present', () => {
    expect(buildDocumentStep1Slug(
      { url: 'https://example.com/files/Quarterly%20Report.v1.pdf' },
      'Ignored Embedded Title'
    )).toBe('Quarterly Report.v1')
  })

  test('document slug falls back to a sanitized title when no filename exists', () => {
    expect(buildDocumentStep1Slug(
      { url: 'https://example.com/view?id=123' },
      'Quarterly Results 2026'
    )).toBe('quarterly-results-2026')
  })
})
