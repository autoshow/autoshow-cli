import { test, expect } from 'bun:test'
import { formatMetadataAsFrontmatter } from '~/cli/commands/process-steps/step-0-metadata/format-metadata-frontmatter'

test('renders flat media metadata as frontmatter', () => {
  const result = formatMetadataAsFrontmatter({
    title: 'Episode 1',
    slug: 'Episode 1',
    duration: '12:34',
    author: 'Channel Name',
    url: 'https://example.com/audio.mp3',
  })

  expect(result).toBe(
    `---
title: 'Episode 1'
slug: 'Episode 1'
duration: '12:34'
author: 'Channel Name'
url: 'https://example.com/audio.mp3'
---
`
  )
})

test('renders nested chapter arrays as yaml frontmatter', () => {
  const result = formatMetadataAsFrontmatter({
    title: 'Episode 2',
    chapters: [
      { startTime: 0, endTime: 45, title: 'Intro' },
      { startTime: 45, endTime: 90, title: 'Deep Dive' }
    ]
  })

  expect(result).toBe(
    `---
title: 'Episode 2'
chapters:
  -
    startTime: 0
    endTime: 45
    title: 'Intro'
  -
    startTime: 45
    endTime: 90
    title: 'Deep Dive'
---
`
  )
})

test('omits undefined values and escapes multiline strings conservatively', () => {
  const result = formatMetadataAsFrontmatter({
    title: `Anthony's Notes`,
    author: undefined,
    description: 'Line one\nLine two',
    url: 'https://example.com/a:b#c'
  })

  expect(result).toBe(
    `---
title: 'Anthony''s Notes'
description: |-
  Line one
  Line two
url: 'https://example.com/a:b#c'
---
`
  )
})
