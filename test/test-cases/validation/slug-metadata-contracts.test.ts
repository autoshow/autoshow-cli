import { describe, expect, test } from 'bun:test'
import {
  buildDocumentStep1Slug,
  buildMediaStep1Slug,
  getSourceBasenameWithoutExtension
} from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { formatMetadataAsFrontmatter } from '~/cli/commands/process-steps/step-0-metadata/format-metadata-frontmatter'

describe('slug and metadata contracts', () => {
  test('local file basenames strip only the final extension', () => {
    expect(getSourceBasenameWithoutExtension({ filePath: '/tmp/My.File.Name.final.mp3' })).toBe('My.File.Name.final')
  })

  test('percent-encoded URL filenames are decoded before slug generation', () => {
    expect(getSourceBasenameWithoutExtension({
      url: 'https://example.com/files/Quarterly%20Report.v1.pdf'
    })).toBe('Quarterly Report.v1')
  })

  test('YouTube-style URLs fall back to title-based media slugs', () => {
    expect(buildMediaStep1Slug(
      { url: 'https://www.youtube.com/watch?v=abc123' },
      { title: 'A Great Episode', publishDate: '2026-04-10' }
    )).toBe('2026-04-10-a-great-episode')
  })

  test('document direct-URL slugs use the source filename', () => {
    expect(buildDocumentStep1Slug(
      { url: 'https://example.com/files/Quarterly%20Report.v1.pdf' },
      'Ignored Embedded Title'
    )).toBe('Quarterly Report.v1')
  })

  test('metadata frontmatter preserves field order and YAML shape', () => {
    expect(formatMetadataAsFrontmatter({
      title: 'Episode 1',
      slug: 'Episode 1',
      duration: '12:34',
      author: 'Channel Name',
      url: 'https://example.com/audio.mp3'
    })).toBe(`---
title: 'Episode 1'
slug: 'Episode 1'
duration: '12:34'
author: 'Channel Name'
url: 'https://example.com/audio.mp3'
---
`)
  })

  test('metadata markdown keeps nested array heading shape stable', () => {
    expect(formatMetadataAsFrontmatter({
      title: 'Episode 2',
      chapters: [
        { startTime: 0, endTime: 45, title: 'Intro' }
      ]
    })).toBe(`---
title: 'Episode 2'
chapters:
  -
    startTime: 0
    endTime: 45
    title: 'Intro'
---
`)
  })
})
