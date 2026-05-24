import { afterEach, describe, expect, test } from 'bun:test'
import { chmod, lstat, mkdtemp, readdir, readlink, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { extractTarGzBuffer } from '~/cli/commands/setup-and-utilities/setup/setup-download/tar-gz'
import { buildGithubArchiveUrl, buildGithubCommitArchiveUrl } from '~/cli/commands/setup-and-utilities/setup/setup-download/github-archives'
import { resolveUvAssetName, resolveUvCommandFromCandidates, resolveUvDownloadUrl } from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-uv'
import { downloadHuggingFaceSnapshot } from '~/cli/commands/setup-and-utilities/setup/setup-download/huggingface'
import {
  hasSetupManagedLlamaModel,
  parseLlamaSetupModelMetadata,
  readLlamaSetupModelMetadata,
  recordSetupManagedLlamaModel
} from '~/cli/commands/process-steps/step-3-write/write-local/llama/llama-model-metadata'
import {
  REVERB_ASR_REQUIRED_FILES,
  REVERB_DIARIZATION_EMBEDDING_REQUIRED_FILES,
  REVERB_DIARIZATION_PIPELINE_REQUIRED_FILES
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/reverb/reverb-assets'

type TarEntry =
  | { type: 'directory', path: string, mode?: number }
  | { type: 'file', path: string, content: string, mode?: number }
  | { type: 'symlink', path: string, linkName: string, mode?: number }

const tempDirs: string[] = []

const makeTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'autoshow-native-setup-test-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

const encoder = new TextEncoder()

const writeField = (header: Uint8Array, offset: number, length: number, value: string): void => {
  const bytes = encoder.encode(value)
  header.set(bytes.subarray(0, Math.min(bytes.byteLength, length)), offset)
}

const writeOctal = (header: Uint8Array, offset: number, length: number, value: number): void => {
  const text = value.toString(8).padStart(length - 1, '0')
  writeField(header, offset, length, `${text}\0`)
}

const createTarHeader = (entry: TarEntry, size: number): Uint8Array => {
  const header = new Uint8Array(512)
  writeField(header, 0, 100, entry.path)
  writeOctal(header, 100, 8, entry.mode ?? (entry.type === 'file' ? 0o644 : 0o755))
  writeOctal(header, 108, 8, 0)
  writeOctal(header, 116, 8, 0)
  writeOctal(header, 124, 12, size)
  writeOctal(header, 136, 12, 0)
  header.fill(0x20, 148, 156)
  writeField(header, 156, 1, entry.type === 'directory' ? '5' : entry.type === 'symlink' ? '2' : '0')
  if (entry.type === 'symlink') {
    writeField(header, 157, 100, entry.linkName)
  }
  writeField(header, 257, 6, 'ustar')
  writeField(header, 263, 2, '00')

  let checksum = 0
  for (const byte of header) checksum += byte
  writeField(header, 148, 8, checksum.toString(8).padStart(6, '0') + '\0 ')
  return header
}

const padToBlock = (bytes: Uint8Array): Uint8Array => {
  const padded = new Uint8Array(Math.ceil(bytes.byteLength / 512) * 512)
  padded.set(bytes)
  return padded
}

const createTarGz = (entries: TarEntry[]): Uint8Array<ArrayBuffer> => {
  const chunks: Uint8Array[] = []
  for (const entry of entries) {
    const payload = entry.type === 'file' ? encoder.encode(entry.content) : new Uint8Array()
    chunks.push(createTarHeader(entry, payload.byteLength))
    if (payload.byteLength > 0) chunks.push(padToBlock(payload))
  }
  chunks.push(new Uint8Array(1024))
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
  const tar = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    tar.set(chunk, offset)
    offset += chunk.byteLength
  }
  return Bun.gzipSync(tar)
}

const mockFetch = (
  fn: (url: string | URL | Request, init?: RequestInit) => Promise<Response>
): typeof fetch => Object.assign(fn, { preconnect: () => undefined }) as typeof fetch

describe('native tar.gz extraction', () => {
  test('extracts files, nested directories, symlinks, executable mode, and strip components', async () => {
    const destination = await makeTempDir()
    const archive = createTarGz([
      { type: 'directory', path: 'archive-root/bin' },
      { type: 'file', path: 'archive-root/bin/tool', content: '#!/usr/bin/env bun\n', mode: 0o755 },
      { type: 'directory', path: 'archive-root/nested' },
      { type: 'file', path: 'archive-root/nested/readme.txt', content: 'native tar works\n' },
      { type: 'symlink', path: 'archive-root/nested/tool-link', linkName: '../bin/tool' }
    ])

    await extractTarGzBuffer(archive, { destination, stripComponents: 1 })

    expect(await Bun.file(join(destination, 'nested/readme.txt')).text()).toBe('native tar works\n')
    expect((await stat(join(destination, 'bin/tool'))).mode & 0o111).toBeGreaterThan(0)
    expect((await lstat(join(destination, 'nested/tool-link'))).isSymbolicLink()).toBe(true)
    expect(await readlink(join(destination, 'nested/tool-link'))).toBe('../bin/tool')
  })

  test('rejects traversal paths', async () => {
    const destination = await makeTempDir()
    const archive = createTarGz([
      { type: 'file', path: '../escape.txt', content: 'bad' }
    ])

    await expect(extractTarGzBuffer(archive, { destination })).rejects.toThrow('Unsafe tar path rejected')
  })
})

describe('managed uv resolution', () => {
  test('maps supported platforms to uv release assets', () => {
    expect(resolveUvAssetName('darwin', 'arm64')).toBe('uv-aarch64-apple-darwin.tar.gz')
    expect(resolveUvAssetName('darwin', 'x64')).toBe('uv-x86_64-apple-darwin.tar.gz')
    expect(resolveUvAssetName('linux', 'arm64')).toBe('uv-aarch64-unknown-linux-gnu.tar.gz')
    expect(resolveUvAssetName('linux', 'x64')).toBe('uv-x86_64-unknown-linux-gnu.tar.gz')
    expect(resolveUvDownloadUrl('0.11.14', 'uv-x86_64-apple-darwin.tar.gz')).toBe(
      'https://github.com/astral-sh/uv/releases/download/0.11.14/uv-x86_64-apple-darwin.tar.gz'
    )
  })

  test('prefers PATH uv before managed uv and falls back to managed uv', async () => {
    const dir = await makeTempDir()
    const managed = join(dir, 'uv')
    await Bun.write(managed, 'fake uv')
    await chmod(managed, 0o755)

    expect(await resolveUvCommandFromCandidates('/path/uv', managed)).toBe('/path/uv')
    expect(await resolveUvCommandFromCandidates(null, managed)).toBe(managed)
  })
})

describe('llama setup model metadata', () => {
  test('records setup-managed llama model downloads without probing external caches', async () => {
    const dir = await makeTempDir()
    const metadataPath = join(dir, 'setup-managed-models.json')

    await recordSetupManagedLlamaModel('ggml-org/gemma-3-270m-it-GGUF', {
      metadataPath,
      now: new Date('2026-01-02T03:04:05.000Z')
    })

    const metadata = await readLlamaSetupModelMetadata(metadataPath)
    expect(metadata.models['ggml-org/gemma-3-270m-it-GGUF']).toEqual({
      requestedModel: 'ggml-org/gemma-3-270m-it-GGUF',
      repo: 'ggml-org/gemma-3-270m-it-GGUF',
      downloadedAt: '2026-01-02T03:04:05.000Z'
    })
    expect(await hasSetupManagedLlamaModel('ggml-org/gemma-3-270m-it-GGUF', metadataPath)).toBe(true)
    expect(await hasSetupManagedLlamaModel('ggml-org/Qwen3-0.6B-GGUF', metadataPath)).toBe(false)
  })

  test('ignores malformed llama metadata instead of trusting an unknown cache', () => {
    expect(parseLlamaSetupModelMetadata('{bad json')).toEqual({ version: 1, models: {} })
    expect(parseLlamaSetupModelMetadata(JSON.stringify({
      version: 1,
      models: {
        bad: { repo: 'ggml-org/bad' }
      }
    }))).toEqual({ version: 1, models: {} })
  })
})

describe('GitHub archive URLs', () => {
  test('builds tag and commit archive URLs', () => {
    expect(buildGithubArchiveUrl({ owner: 'ggerganov', repo: 'whisper.cpp', ref: 'v1.7.4' })).toBe(
      'https://github.com/ggerganov/whisper.cpp/archive/refs/tags/v1.7.4.tar.gz'
    )
    expect(buildGithubCommitArchiveUrl({ owner: 'revdotcom', repo: 'reverb', ref: 'abc123' })).toBe(
      'https://github.com/revdotcom/reverb/archive/abc123.tar.gz'
    )
  })
})

describe('Hugging Face downloader', () => {
  test('sends auth headers and filters files with allow patterns', async () => {
    const destination = await makeTempDir()
    const calls: Array<{ url: string, authorization: string | null }> = []
    const fetchImpl = mockFetch(async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      calls.push({ url: String(url), authorization: new Headers(init?.headers).get('Authorization') })
      if (String(url).includes('/tree/')) {
        return Response.json([
          { path: 'reverb_asr_v1.pt', type: 'file' },
          { path: 'config.yaml', type: 'file' },
          { path: 'README.md', type: 'file' }
        ])
      }
      return new Response(`download:${String(url)}`)
    })

    await downloadHuggingFaceSnapshot({
      repoId: 'Revai/reverb-asr',
      revision: 'main',
      token: 'hf_test',
      destination,
      allowPatterns: ['*.pt', '*.yaml'],
      requiredFiles: ['reverb_asr_v1.pt', 'config.yaml'],
      fetchImpl
    })

    expect(calls.every((call) => call.authorization === 'Bearer hf_test')).toBe(true)
    expect(await Bun.file(join(destination, 'README.md')).exists()).toBe(false)
    expect(await Bun.file(join(destination, 'reverb_asr_v1.pt')).exists()).toBe(true)
    expect(await Bun.file(join(destination, 'config.yaml')).exists()).toBe(true)
  })

  test('downloads the complete Reverb ASR runtime asset set', async () => {
    const destination = await makeTempDir()
    const fetchImpl = mockFetch(async (url: string | URL | Request): Promise<Response> => {
      if (String(url).includes('/tree/')) {
        return Response.json([
          ...REVERB_ASR_REQUIRED_FILES.map(path => ({ path, type: 'file' })),
          { path: 'README.md', type: 'file' }
        ])
      }
      return new Response(`download:${String(url)}`)
    })

    await downloadHuggingFaceSnapshot({
      repoId: 'Revai/reverb-asr',
      revision: 'main',
      token: 'hf_test',
      destination,
      allowPatterns: [...REVERB_ASR_REQUIRED_FILES],
      requiredFiles: [...REVERB_ASR_REQUIRED_FILES],
      fetchImpl
    })

    for (const file of REVERB_ASR_REQUIRED_FILES) {
      expect(await Bun.file(join(destination, file)).exists()).toBe(true)
    }
    expect(await Bun.file(join(destination, 'README.md')).exists()).toBe(false)
  })

  test('downloads the complete Reverb diarization runtime asset sets', async () => {
    const pipelineDestination = await makeTempDir()
    const embeddingDestination = await makeTempDir()
    const fetchImpl = mockFetch(async (url: string | URL | Request): Promise<Response> => {
      if (String(url).includes('/tree/')) {
        if (String(url).includes('pyannote-wespeaker-voxceleb-resnet34-LM')) {
          return Response.json([
            ...REVERB_DIARIZATION_EMBEDDING_REQUIRED_FILES.map(path => ({ path, type: 'file' })),
            { path: 'README.md', type: 'file' }
          ])
        }
        return Response.json([
          ...REVERB_DIARIZATION_PIPELINE_REQUIRED_FILES.map(path => ({ path, type: 'file' })),
          { path: 'README.md', type: 'file' }
        ])
      }
      return new Response(`download:${String(url)}`)
    })

    await downloadHuggingFaceSnapshot({
      repoId: 'Revai/reverb-diarization-v2',
      revision: 'main',
      token: 'hf_test',
      destination: pipelineDestination,
      allowPatterns: [...REVERB_DIARIZATION_PIPELINE_REQUIRED_FILES],
      requiredFiles: [...REVERB_DIARIZATION_PIPELINE_REQUIRED_FILES],
      fetchImpl
    })

    await downloadHuggingFaceSnapshot({
      repoId: 'Revai/pyannote-wespeaker-voxceleb-resnet34-LM',
      revision: 'main',
      token: 'hf_test',
      destination: embeddingDestination,
      allowPatterns: [...REVERB_DIARIZATION_EMBEDDING_REQUIRED_FILES],
      requiredFiles: [...REVERB_DIARIZATION_EMBEDDING_REQUIRED_FILES],
      fetchImpl
    })

    for (const file of REVERB_DIARIZATION_PIPELINE_REQUIRED_FILES) {
      expect(await Bun.file(join(pipelineDestination, file)).exists()).toBe(true)
    }
    for (const file of REVERB_DIARIZATION_EMBEDDING_REQUIRED_FILES) {
      expect(await Bun.file(join(embeddingDestination, file)).exists()).toBe(true)
    }
    expect(await Bun.file(join(pipelineDestination, 'README.md')).exists()).toBe(false)
    expect(await Bun.file(join(embeddingDestination, 'README.md')).exists()).toBe(false)
  })

  test('retries retryable listing failures', async () => {
    const destination = await makeTempDir()
    let treeCalls = 0
    const fetchImpl = mockFetch(async (url: string | URL | Request): Promise<Response> => {
      if (String(url).includes('/tree/')) {
        treeCalls++
        if (treeCalls === 1) {
          return new Response('temporary outage', { status: 503, statusText: 'Service Unavailable' })
        }
        return Response.json([{ path: 'config.yaml', type: 'file' }])
      }
      return new Response('ok')
    })

    await downloadHuggingFaceSnapshot({
      repoId: 'Revai/reverb-asr',
      token: 'hf_test',
      destination,
      requiredFiles: ['config.yaml'],
      fetchImpl,
      retryDelayMs: 0
    })

    expect(treeCalls).toBe(2)
  })

  test('removes partial downloads on file failure', async () => {
    const destination = await makeTempDir()
    const failingResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      arrayBuffer: async () => {
        throw new Error('stream failed')
      }
    } as unknown as Response
    const fetchImpl = mockFetch(async (url: string | URL | Request): Promise<Response> => {
      if (String(url).includes('/tree/')) {
        return Response.json([{ path: 'config.yaml', type: 'file' }])
      }
      return failingResponse
    })

    await expect(downloadHuggingFaceSnapshot({
      repoId: 'Revai/reverb-asr',
      token: 'hf_test',
      destination,
      fetchImpl,
      retryDelayMs: 0,
      maxAttempts: 1
    })).rejects.toThrow('stream failed')

    const files = await readdir(destination)
    expect(files.some((file) => file.includes('.download-'))).toBe(false)
  })

  test('validates required files after download', async () => {
    const destination = await makeTempDir()
    const fetchImpl = mockFetch(async (url: string | URL | Request): Promise<Response> => {
      if (String(url).includes('/tree/')) {
        return Response.json([{ path: 'config.yaml', type: 'file' }])
      }
      return new Response('ok')
    })

    await expect(downloadHuggingFaceSnapshot({
      repoId: 'Revai/reverb-asr',
      token: 'hf_test',
      destination,
      requiredFiles: ['reverb_asr_v1.pt', 'config.yaml'],
      fetchImpl
    })).rejects.toThrow('Missing required Hugging Face files: reverb_asr_v1.pt')
  })
})
