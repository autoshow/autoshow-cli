import { afterEach, expect, test } from 'bun:test'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/target-utils'
import { resolveInputListBatch } from '~/cli/commands/process-steps/step-1-download/targets/url-list-target'
import { readBatchItems, readRunMetadata } from '../../test-utils/manifest-helpers'
import { fileExists, runCommand } from '../../test-utils/test-helpers'

const OUTPUT_DIR = './output'
const tempDirs: string[] = []

const createTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'autoshow-url-list-feed-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(async (dir) => {
    await rm(dir, { recursive: true, force: true })
  }))
})

type LocalFeedEpisode = {
  title: string
  pubDate: string
  mediaUrl: string
}

type LocalFeedServer = {
  feedUrl: string
  episodes: LocalFeedEpisode[]
  close: () => Promise<void>
}

const startLocalFeedServer = async (): Promise<LocalFeedServer> => {
  const audioBytes = await Bun.file('input/examples/audio/0-audio-short.mp3').bytes()
  const episodeSpecs = [
    {
      slug: 'episode-one',
      title: 'Episode One',
      pubDate: 'Sat, 03 Feb 2024 08:00:00 +0000'
    },
    {
      slug: 'episode-two',
      title: 'Episode Two',
      pubDate: 'Sun, 04 Feb 2024 09:30:00 +0000'
    }
  ]

  let addressPort = 0
  const buildFeedXml = (baseUrl: string): string => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Local Test Feed</title>
    <link>${baseUrl}</link>
    <description>Local feed for input list expansion tests</description>
    ${episodeSpecs.map((episode) => `    <item>
      <title>${episode.title}</title>
      <guid>${baseUrl}/${episode.slug}</guid>
      <pubDate>${episode.pubDate}</pubDate>
      <enclosure url="${baseUrl}/${episode.slug}.mp3" length="${audioBytes.length}" type="audio/mpeg"/>
    </item>`).join('\n')}
  </channel>
</rss>`

  const server = createServer((req, res) => {
    if (req.url === '/feed.xml') {
      res.statusCode = 200
      res.setHeader('content-type', 'application/rss+xml; charset=utf-8')
      res.end(buildFeedXml(`http://127.0.0.1:${addressPort}`))
      return
    }

    if (episodeSpecs.some((episode) => req.url === `/${episode.slug}.mp3`)) {
      res.statusCode = 200
      res.setHeader('content-type', 'audio/mpeg')
      res.end(Buffer.from(audioBytes))
      return
    }

    res.statusCode = 404
    res.end('not found')
  })

  server.listen(0, '127.0.0.1')
  await once(server, 'listening')

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to determine local feed server port')
  }
  addressPort = address.port

  const baseUrl = `http://127.0.0.1:${addressPort}`
  const episodes = episodeSpecs.map((episode) => ({
    title: episode.title,
    pubDate: episode.pubDate,
    mediaUrl: `${baseUrl}/${episode.slug}.mp3`
  }))

  return {
    feedUrl: `${baseUrl}/feed.xml`,
    episodes,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error)
            return
          }
          resolve()
        })
      })
    }
  }
}

const getOutputDirs = async (): Promise<string[]> => {
  try {
    const entries = await readdir(OUTPUT_DIR, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(OUTPUT_DIR, entry.name))
      .sort()
  } catch {
    return []
  }
}

const getNewOutputDir = async (dirsBefore: Set<string>): Promise<string | null> => {
  const dirsAfter = await getOutputDirs()
  const newDirs = dirsAfter.filter((dir) => !dirsBefore.has(dir))
  return newDirs.sort().at(-1) ?? null
}

const extractStep1Url = (entry: Record<string, unknown>): string | undefined => {
  const step1 = entry['step1']
  if (typeof step1 !== 'object' || step1 === null) {
    return undefined
  }
  const url = (step1 as Record<string, unknown>)['url']
  return typeof url === 'string' ? url : undefined
}

const extractStep1AudioFileName = (entry: Record<string, unknown>): string | undefined => {
  const step1 = entry['step1']
  if (typeof step1 !== 'object' || step1 === null) {
    return undefined
  }
  const audioFileName = (step1 as Record<string, unknown>)['audioFileName']
  return typeof audioFileName === 'string' ? audioFileName : undefined
}

test('download input lists expand selected feed entries into episode media targets', async () => {
  const tempDir = await createTempDir()
  const inputListPath = join(tempDir, 'inputs.md')
  const server = await startLocalFeedServer()
  let batchDir: string | null = null

  try {
    await writeFile(inputListPath, `${server.feedUrl}\n`)
    const dirsBefore = new Set(await getOutputDirs())

    const result = await runCommand(
      ['src/cli/create-cli.ts', 'download', inputListPath, '--batch-all'],
      { testName: 'download input lists expand selected feed entries into episode media targets' }
    )

    expect(result.exitCode).toBe(0)
    batchDir = await getNewOutputDir(dirsBefore)
    expect(batchDir).not.toBeNull()
    if (!batchDir) {
      return
    }

    const sourceJson = await Bun.file(`${batchDir}/source.json`).json() as {
      sourceKind?: string
      selectedCount?: number
    }
    expect(sourceJson.sourceKind).toBe('url_list')
    expect(sourceJson.selectedCount).toBe(server.episodes.length)

    const batchItems = await readBatchItems(batchDir)
    expect(batchItems.map(extractStep1Url).sort()).toEqual(server.episodes.map((episode) => episode.mediaUrl).sort())
    expect(batchItems.map(extractStep1Url)).not.toContain(server.feedUrl)

    const itemDirs = (await readdir(batchDir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(batchDir as string, entry.name))
      .sort()

    expect(itemDirs).toHaveLength(server.episodes.length)

    const audioFiles = await Promise.all(itemDirs.map(async (dir) => {
      const metadata = await readRunMetadata(dir)
      const audioFileName = extractStep1AudioFileName(metadata)
      expect(audioFileName).toBeDefined()
      expect(audioFileName?.endsWith('.mp3')).toBe(true)
      expect(await fileExists(join(dir, audioFileName as string))).toBe(true)
      return audioFileName
    }))

    expect(audioFiles.every((name) => typeof name === 'string' && name.endsWith('.mp3'))).toBe(true)
  } finally {
    await server.close()
    if (batchDir) {
      await rm(batchDir, { recursive: true, force: true }).catch(() => {})
    }
  }
})

test('resolveInputListBatch applies list selection before expanding selected feed entries', async () => {
  const tempDir = await createTempDir()
  const firstInputListPath = join(tempDir, 'plain-first.md')
  const secondInputListPath = join(tempDir, 'feed-first.md')
  const notePath = join(tempDir, 'note.md')
  const server = await startLocalFeedServer()

  try {
    await writeFile(notePath, '# plain item\n')
    await writeFile(firstInputListPath, `${notePath}\n${server.feedUrl}\n`)
    await writeFile(secondInputListPath, `${server.feedUrl}\n${notePath}\n`)

    const opts = buildOptsFromFlags(true, { 'batch-limit': '1' })

    const plainFirst = await resolveInputListBatch(firstInputListPath, 'download', opts)
    expect(plainFirst.selectedUrls).toEqual([notePath])
    expect(plainFirst.selectedItems).toEqual([
      expect.objectContaining({
        url: notePath
      })
    ])

    const feedFirst = await resolveInputListBatch(secondInputListPath, 'download', opts)
    const secondEpisode = server.episodes[1]
    expect(secondEpisode).toBeDefined()
    expect(feedFirst.source.sourceKind).toBe('url_list')
    expect(feedFirst.source.sourceUrl).toBe(secondInputListPath)
    expect(feedFirst.selectedUrls).toEqual([secondEpisode!.mediaUrl])
    expect(feedFirst.selectedItems).toEqual([
      expect.objectContaining({
        url: secondEpisode!.mediaUrl,
        title: 'Episode Two',
        publishedAt: 'Sun, 04 Feb 2024 09:30:00 +0000',
        directDownload: true
      })
    ])
  } finally {
    await server.close()
  }
})

test('input directories expand feed entries from 2-urls.md for preflight and execution', async () => {
  const tempDir = await createTempDir()
  const inputDir = join(tempDir, 'input')
  const configPath = join(tempDir, 'autoshow.json')
  const server = await startLocalFeedServer()
  let batchDir: string | null = null

  try {
    await mkdir(inputDir, { recursive: true })
    await writeFile(join(inputDir, '2-urls.md'), `${server.feedUrl}\n`)
    await writeFile(configPath, JSON.stringify({ version: 2 }, null, 2))

    const priceResult = await runCommand(
      [
        'src/cli/create-cli.ts',
        'stt',
        inputDir,
        '--elevenlabs-stt',
        'scribe_v2',
        '--batch-all',
        '--price',
        '--config-path',
        configPath
      ],
      { testName: 'input directories expand feed entries from 2-urls.md for preflight and execution (price)' }
    )

    expect(priceResult.exitCode).toBe(0)
    expect(`${priceResult.stdout}\n${priceResult.stderr}`).toContain('Commands checked: 2')

    const dirsBefore = new Set(await getOutputDirs())
    const downloadResult = await runCommand(
      ['src/cli/create-cli.ts', 'download', inputDir, '--batch-all'],
      { testName: 'input directories expand feed entries from 2-urls.md for preflight and execution (download)' }
    )

    expect(downloadResult.exitCode).toBe(0)
    batchDir = await getNewOutputDir(dirsBefore)
    expect(batchDir).not.toBeNull()
    if (!batchDir) {
      return
    }

    const batchItems = await readBatchItems(batchDir)
    expect(batchItems.map(extractStep1Url).sort()).toEqual(server.episodes.map((episode) => episode.mediaUrl).sort())
  } finally {
    await server.close()
    if (batchDir) {
      await rm(batchDir, { recursive: true, force: true }).catch(() => {})
    }
  }
})
