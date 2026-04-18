import { afterEach, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  buildBatchChildDirectoryStem,
  normalizeBatchChildPublishedAt,
  reserveBatchChildOutputDir
} from '~/cli/commands/process-steps/batch-child-output'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(async (dir) => {
    await rm(dir, { recursive: true, force: true })
  }))
})

test('normalizeBatchChildPublishedAt reduces timestamps to YYYY-MM-DD', () => {
  expect(normalizeBatchChildPublishedAt('Sat, 03 Feb 2024 08:00:00 +0000')).toBe('2024-02-03')
  expect(normalizeBatchChildPublishedAt('2024-02-03')).toBe('2024-02-03')
  expect(normalizeBatchChildPublishedAt('not-a-date')).toBeUndefined()
})

test('buildBatchChildDirectoryStem prefixes a normalized content date when available', () => {
  expect(buildBatchChildDirectoryStem({
    title: "That's My Jamstack: Fullstack Serverless Frameworks",
    publishedAt: '2020-09-29'
  })).toBe('2020-09-29-thats-my-jamstack-fullstack-serverless-frameworks')
})

test('buildBatchChildDirectoryStem falls back to slug-only names', () => {
  expect(buildBatchChildDirectoryStem({
    slug: 'Quarterly Report.v1'
  })).toBe('quarterly-reportv1')
})

test('reserveBatchChildOutputDir appends numeric suffixes for collisions and memoizes per context', async () => {
  const batchDir = await mkdtemp(join(tmpdir(), 'autoshow-batch-child-output-'))
  tempDirs.push(batchDir)

  const firstContext = { batchDir }
  const secondContext = { batchDir }
  const thirdContext = { batchDir }

  const first = await reserveBatchChildOutputDir(firstContext, {
    title: 'Episode One',
    publishedAt: '2024-02-03'
  })
  const second = await reserveBatchChildOutputDir(secondContext, {
    title: 'Episode One',
    publishedAt: '2024-02-03'
  })
  const third = await reserveBatchChildOutputDir(thirdContext, {
    title: 'Episode One'
  })
  const repeatedFirst = await reserveBatchChildOutputDir(firstContext, {
    title: 'ignored-after-reservation'
  })

  expect(basename(first ?? '')).toBe('2024-02-03-episode-one')
  expect(basename(second ?? '')).toBe('2024-02-03-episode-one-2')
  expect(basename(third ?? '')).toBe('episode-one')
  expect(repeatedFirst).toBe(first)
})
