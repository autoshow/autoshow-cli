import { afterEach, expect, test } from 'bun:test'
import { chmod, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { fileExists, runCommand, STABLE_LOCAL_AUDIO_PATH } from '../../test-utils/test-helpers'
import { readBatchItems, readBatchSource, readRunMetadata, readSttBatchSummary } from '../../test-utils/manifest-helpers'

const tempDirs: string[] = []
const createdOutputDirs: string[] = []

afterEach(async () => {
  await Promise.all(createdOutputDirs.splice(0).map(async (dir) => {
    await rm(dir, { recursive: true, force: true })
  }))
  await Promise.all(tempDirs.splice(0).map(async (dir) => {
    await rm(dir, { recursive: true, force: true })
  }))
})

const writeFakeYtDlp = async (binDir: string): Promise<void> => {
  const audioFixturePath = resolve(STABLE_LOCAL_AUDIO_PATH)
  const scriptPath = join(binDir, 'yt-dlp')
  const script = `#!/usr/bin/env bun
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const args = process.argv.slice(2)
const url = args.at(-1) ?? ''

const getArgValue = (flag) => {
  const index = args.indexOf(flag)
  return index >= 0 ? args[index + 1] : undefined
}

const channelUrl = 'https://www.youtube.com/@channel-example'
const videoItems = [
  {
    id: 'vid-manual',
    webpage_url: 'https://www.youtube.com/watch?v=vid-manual',
    title: 'channel manual caption',
    uploader: 'Channel Example',
    channel: 'Channel Example',
    upload_date: '20260417',
    duration: 12
  },
  {
    id: 'vid-auto',
    webpage_url: 'https://www.youtube.com/watch?v=vid-auto',
    title: 'channel auto caption',
    uploader: 'Channel Example',
    channel: 'Channel Example',
    upload_date: '20260416',
    duration: 10
  }
]

const metadataByUrl = {
  'https://www.youtube.com/watch?v=vid-manual': {
    id: 'vid-manual',
    title: 'channel manual caption',
    duration: 12,
    uploader: 'Channel Example',
    channel: 'Channel Example',
    channel_url: channelUrl,
    upload_date: '20260417',
    description: 'Manual caption test video',
    subtitles: {
      en: [{ ext: 'vtt', url: 'https://captions.test/manual-en.vtt', name: 'English' }]
    },
    automatic_captions: {}
  },
  'https://www.youtube.com/watch?v=vid-auto': {
    id: 'vid-auto',
    title: 'channel auto caption',
    duration: 10,
    uploader: 'Channel Example',
    channel: 'Channel Example',
    channel_url: channelUrl,
    upload_date: '20260416',
    description: 'Auto caption test video',
    subtitles: {},
    automatic_captions: {
      'en-US': [{ ext: 'vtt', url: 'https://captions.test/auto-en-us.vtt', name: 'English (United States)' }]
    }
  }
}

const manualVtt = \`WEBVTT

00:00:00.000 --> 00:00:02.000
Manual captions line one

00:00:02.000 --> 00:00:04.000
Manual captions line two
\`

const autoVtt = \`WEBVTT

00:00:00.000 --> 00:00:02.000
Auto captions hello

00:00:02.000 --> 00:00:04.000
Auto captions hello again
\`

if (args.includes('--flat-playlist') && args.includes('--dump-json')) {
  if (url !== channelUrl) {
    console.error(\`unexpected channel url: \${url}\`)
    process.exit(1)
  }

  for (const item of videoItems) {
    console.log(JSON.stringify(item))
  }
  process.exit(0)
}

if (args.includes('--dump-json')) {
  const metadata = metadataByUrl[url]
  if (!metadata) {
    console.error(\`unexpected metadata url: \${url}\`)
    process.exit(1)
  }
  console.log(JSON.stringify(metadata))
  process.exit(0)
}

if (args.includes('--skip-download')) {
  const outputPattern = getArgValue('--output')
  if (!outputPattern) {
    console.error('missing subtitle output pattern')
    process.exit(1)
  }

  const subtitlePath = url.includes('vid-manual')
    ? outputPattern.replace('youtube-captions.%(ext)s', 'youtube-captions.en.vtt')
    : outputPattern.replace('youtube-captions.%(ext)s', 'youtube-captions.en-US.vtt')
  await mkdir(dirname(subtitlePath), { recursive: true })
  await writeFile(subtitlePath, url.includes('vid-manual') ? manualVtt : autoVtt)
  process.exit(0)
}

const outputPattern = getArgValue('--output')
const metadata = metadataByUrl[url]
if (outputPattern && metadata && !args.includes('--skip-download')) {
  const outputPath = outputPattern
    .replace('%(title)s', metadata.title)
    .replace('%(ext)s', 'mp3')
  await mkdir(dirname(outputPath), { recursive: true })
  await copyFile(${JSON.stringify(audioFixturePath)}, outputPath)
  console.log('[download] 100% of 1.00MiB')
  process.exit(0)
}

console.error(\`unsupported fake yt-dlp invocation: \${args.join(' ')}\`)
process.exit(1)
`

  await writeFile(scriptPath, script)
  await chmod(scriptPath, 0o755)
}

test('stt youtube channel with --youtube-captions processes every selected video and writes caption artifacts', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-youtube-channel-captions-'))
  tempDirs.push(tempDir)

  const binDir = join(tempDir, 'bin')
  await mkdir(binDir, { recursive: true })
  await writeFakeYtDlp(binDir)

  const cacheDir = join(tempDir, 'cache')
  const dirsBefore = new Set(
    (await readdir('./output', { withFileTypes: true }).catch(() => []))
      .filter((entry) => entry.isDirectory())
      .map((entry) => join('./output', entry.name))
  )
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'stt',
    'https://www.youtube.com/@channel-example',
    '--youtube-captions',
    '--batch-all'
  ], {
    testName: 'stt youtube channel with --youtube-captions processes every selected video and writes caption artifacts',
    env: {
      PATH: `${binDir}:${process.env['PATH'] ?? ''}`,
      AUTOSHOW_CACHE_DIR: cacheDir
    }
  })

  expect(result.exitCode).toBe(0)
  const batchDir = (await readdir('./output', { withFileTypes: true }).catch(() => []))
    .filter((entry) => entry.isDirectory())
    .map((entry) => join('./output', entry.name))
    .filter((dir) => !dirsBefore.has(dir))
    .sort()
    .at(-1)
  expect(batchDir).toBeDefined()
  if (!batchDir) {
    return
  }

  createdOutputDirs.push(batchDir)
  expect(await fileExists(join(batchDir, 'source.json'))).toBe(true)
  expect(await fileExists(join(batchDir, 'batch.json'))).toBe(true)
  expect(await fileExists(join(batchDir, 'stt-summary.json'))).toBe(true)

  const source = await readBatchSource(batchDir)
  expect(source).toMatchObject({
    sourceKind: 'youtube_channel',
    sourceUrl: 'https://www.youtube.com/@channel-example',
    title: 'Channel Example',
    selectedCount: 2
  })

  const batchItems = await readBatchItems(batchDir)
  expect(batchItems).toHaveLength(2)

  const summary = await readSttBatchSummary(batchDir)
  expect(summary.totals).toEqual({
    items: 2,
    captionBacked: 2,
    sttFallback: 0,
    incomplete: 0,
    failed: 0
  })

  const itemDirs = (await readdir(batchDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(batchDir, entry.name))
    .sort()
  expect(itemDirs).toHaveLength(2)
  expect(itemDirs.map((dir) => basename(dir))).toEqual([
    '2026-04-16-channel-auto-caption',
    '2026-04-17-channel-manual-caption'
  ])

  const perItem = await Promise.all(itemDirs.map(async (dir) => {
    const metadata = await readRunMetadata(dir)
    const step1 = metadata['step1'] as Record<string, unknown>
    const step2 = metadata['step2'] as Record<string, unknown>
    return {
      dir,
      title: step1['title'],
      url: step1['url'],
      service: step2['transcriptionService'],
      model: step2['transcriptionModel'],
      captionKind: step2['captionKind'],
      captionLanguage: step2['captionLanguage'],
      transcript: await Bun.file(join(dir, 'transcription.txt')).text(),
      captionMetadata: await Bun.file(join(dir, 'youtube-captions.json')).json() as Record<string, unknown>,
      hasVtt: await fileExists(join(dir, 'youtube-captions.vtt'))
    }
  }))

  const autoItem = perItem.find((item) => item.title === 'channel auto caption')
  const manualItem = perItem.find((item) => item.title === 'channel manual caption')

  expect(autoItem).toEqual(expect.objectContaining({
    url: 'https://www.youtube.com/watch?v=vid-auto',
    service: 'youtube-captions',
    model: 'subtitle-track',
    captionKind: 'auto',
    captionLanguage: 'en-US',
    hasVtt: true
  }))
  expect(manualItem).toEqual(expect.objectContaining({
    url: 'https://www.youtube.com/watch?v=vid-manual',
    service: 'youtube-captions',
    model: 'subtitle-track',
    captionKind: 'manual',
    captionLanguage: 'en',
    hasVtt: true
  }))

  expect(autoItem?.transcript).toContain('Auto captions hello')
  expect(autoItem?.transcript).toContain('again')
  expect(manualItem?.transcript).toContain('Manual captions line one')
  expect(manualItem?.transcript).toContain('Manual captions line two')
  expect(autoItem?.captionMetadata).toMatchObject({
    captionKind: 'auto',
    captionLanguage: 'en-US'
  })
  expect(manualItem?.captionMetadata).toMatchObject({
    captionKind: 'manual',
    captionLanguage: 'en'
  })

  expect(summary.items).toEqual([
    expect.objectContaining({
      url: 'https://www.youtube.com/watch?v=vid-manual',
      title: 'channel manual caption',
      transcriptionService: 'youtube-captions',
      transcriptionModel: 'subtitle-track',
      captionUsed: true,
      captionKind: 'manual',
      captionLanguage: 'en',
      completionStatus: 'full'
    }),
    expect.objectContaining({
      url: 'https://www.youtube.com/watch?v=vid-auto',
      title: 'channel auto caption',
      transcriptionService: 'youtube-captions',
      transcriptionModel: 'subtitle-track',
      captionUsed: true,
      captionKind: 'auto',
      captionLanguage: 'en-US',
      completionStatus: 'full'
    })
  ])

  expect(batchItems).toEqual([
    expect.objectContaining({
      outputDir: expect.any(String),
      completionStatus: 'full'
    }),
    expect.objectContaining({
      outputDir: expect.any(String),
      completionStatus: 'full'
    })
  ])
})
