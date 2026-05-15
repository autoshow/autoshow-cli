import { createServer, type Server } from 'node:http'
import { readFile } from 'node:fs/promises'
import { afterAll, beforeAll } from 'bun:test'
import { STABLE_LOCAL_AUDIO_PATH } from '../../../test-utils/test-helpers'
import {
  defineBatchCaseTest,
  setupDownloadInputTypeLifecycle,
  type BatchCase,
} from './download-input-types.shared'

let feedServer: Server | null = null
let feedBaseUrl = ''
let audioFixture: Buffer = Buffer.alloc(0)

const buildFeedXml = (): string => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>AutoShow Fixture Feed</title>
    <link>${feedBaseUrl}/</link>
    <description>Local feed fixture</description>
    <item>
      <guid>fixture-episode-1</guid>
      <title>Fixture Episode</title>
      <pubDate>Fri, 15 May 2026 12:00:00 GMT</pubDate>
      <enclosure url="${feedBaseUrl}/cover.jpg" length="1234" type="image/jpeg" />
      <enclosure url="${feedBaseUrl}/audio.mp3" length="${audioFixture.length}" type="audio/mpeg" />
    </item>
  </channel>
</rss>
`

beforeAll(async () => {
  audioFixture = await readFile(STABLE_LOCAL_AUDIO_PATH)

  feedServer = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')

    if (req.method === 'GET' && url.pathname === '/feed') {
      res.writeHead(200, { 'content-type': 'application/rss+xml; charset=utf-8' })
      res.end(buildFeedXml())
      return
    }

    if (req.method === 'GET' && url.pathname === '/audio.mp3') {
      res.writeHead(200, {
        'content-type': 'audio/mpeg',
        'content-length': String(audioFixture.length)
      })
      res.end(audioFixture)
      return
    }

    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('not found')
  })

  await new Promise<void>((resolve) => {
    feedServer?.listen(0, '127.0.0.1', resolve)
  })

  const address = feedServer.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to start RSS fixture server')
  }
  feedBaseUrl = `http://127.0.0.1:${address.port}`
})

afterAll(async () => {
  if (!feedServer) return
  await new Promise<void>((resolve, reject) => {
    feedServer?.close(error => error ? reject(error) : resolve())
  })
  feedServer = null
})

const batchCases: BatchCase[] = [
  {
    name: 'download RSS feed input',
    input: () => `${feedBaseUrl}/feed`,
    extraArgs: ['--batch-limit', '1'],
    expectedSourceKind: 'podcast_rss',
    expectedSelectedCount: 1,
  },
]

setupDownloadInputTypeLifecycle([])

for (const tc of batchCases) {
  defineBatchCaseTest(tc)
}
