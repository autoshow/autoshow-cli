import { expect, test } from 'bun:test'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { readdir, rm } from 'node:fs/promises'
import { fileExists, runCommand } from '../../test-utils/test-helpers'
import { readBatchItems } from '../../test-utils/manifest-helpers'

test('download RSS feed can keep original media and flatten files into one batch directory', async () => {
  const audioBytes = await Bun.file('input/examples/audio/0-audio-short.mp3').bytes()
  const buildFeedXml = (baseUrl: string): string => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Local Test Feed</title>
    <link>${baseUrl}</link>
    <description>Local feed for flat media download testing</description>
    <item>
      <title>Episode One</title>
      <guid>${baseUrl}/episode-one</guid>
      <pubDate>Sat, 03 Feb 2024 08:00:00 +0000</pubDate>
      <enclosure url="${baseUrl}/episode-one.mp3" length="${audioBytes.length}" type="audio/mpeg"/>
    </item>
    <item>
      <title>Episode Two</title>
      <guid>${baseUrl}/episode-two</guid>
      <pubDate>Sun, 04 Feb 2024 09:30:00 +0000</pubDate>
      <enclosure url="${baseUrl}/episode-two.mp3" length="${audioBytes.length}" type="audio/mpeg"/>
    </item>
  </channel>
</rss>`

  const server = createServer((req, res) => {
    if (req.url === '/feed.xml') {
      res.statusCode = 200
      res.setHeader('content-type', 'application/rss+xml; charset=utf-8')
      res.end(buildFeedXml(`http://127.0.0.1:${addressPort}`))
      return
    }

    if (req.url === '/episode-one.mp3' || req.url === '/episode-two.mp3') {
      res.statusCode = 200
      res.setHeader('content-type', 'audio/mpeg')
      res.end(Buffer.from(audioBytes))
      return
    }

    res.statusCode = 404
    res.end('not found')
  })

  let addressPort = 0
  let batchDir: string | null = null

  server.listen(0, '127.0.0.1')
  await once(server, 'listening')

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to determine test server port')
  }
  addressPort = address.port

  try {
    const feedUrl = `http://127.0.0.1:${addressPort}/feed.xml`
    const result = await runCommand(
      [
        'src/cli/create-cli.ts',
        'download',
        feedUrl,
        '--batch-all',
        '--keep-original-media',
        '--flat-batch'
      ],
      { testName: 'download RSS feed can keep original media and flatten files into one batch directory' }
    )

    expect(result.exitCode).toBe(0)
    batchDir = result.outputDir
    expect(batchDir).not.toBeNull()
    if (!batchDir) {
      return
    }

    expect(await fileExists(`${batchDir}/source.json`)).toBe(true)
    expect(await fileExists(`${batchDir}/batch.json`)).toBe(true)

    const entries = await readdir(batchDir, { withFileTypes: true })
    expect(entries.some(entry => entry.isDirectory())).toBe(false)

    const mp3Files = entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.mp3'))
      .map(entry => entry.name)
      .sort()

    expect(mp3Files).toEqual([
      '2024-02-03-episode-one.mp3',
      '2024-02-04-episode-two.mp3'
    ])

    const info = await readBatchItems(batchDir) as Array<{
      step1?: {
        audioFileName?: string
        title?: string
        publishDate?: string
      }
    }>

    expect(info).toHaveLength(2)
    expect(info.map(entry => entry.step1?.audioFileName).sort()).toEqual(mp3Files)
    expect(info.map(entry => entry.step1?.title).sort()).toEqual(['Episode One', 'Episode Two'])
    expect(info.map(entry => entry.step1?.publishDate).sort()).toEqual(['2024-02-03', '2024-02-04'])

    const source = await Bun.file(`${batchDir}/source.json`).json() as {
      sourceKind?: string
      selectedCount?: number
    }
    expect(source.sourceKind).toBe('podcast_rss')
    expect(source.selectedCount).toBe(2)
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })

    if (batchDir) {
      await rm(batchDir, { recursive: true, force: true }).catch(() => {})
    }
  }
})
