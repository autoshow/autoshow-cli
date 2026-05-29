import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DocumentMetadata } from '~/types'
import { runGeminiOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/gemini-ocr/run-gemini-ocr'
import { runGeminiStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/gemini-stt/run-gemini-stt'
import { runGeminiModel } from '~/cli/commands/process-steps/step-3-write/write-services/gemini/run-gemini'
import { runGeminiTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/gemini/run-gemini-tts'
import { runGeminiVideoGen } from '~/cli/commands/process-steps/step-6-video/video-services/gemini/run-gemini-video-gen'
import { runGeminiMusicGen } from '~/cli/commands/process-steps/step-7-music/music-services/gemini/run-gemini-music-gen'
import { createImageGemini } from '~/cli/commands/process-steps/step-8-comic/image-services/gemini/gemini-image-service'
import { classifyGeminiRetry } from '~/cli/commands/process-steps/step-3-write/write-services/gemini/gemini-utils'
import { geminiGenerateContent, GeminiRestError } from '~/utils/gemini/gemini-rest'
import {
  clearEnv,
  createTempDirTracker,
  installMockFetch as installFetch,
  jsonResponse,
  restoreEnv,
  snapshotEnv
} from '../../test-utils/rest-contract-helpers'

const originalFetch = globalThis.fetch
let previousEnv: Record<string, string | undefined> = {}
const envKeys = ['GEMINI_API_KEY']
const tempDirs = createTempDirTracker('autoshow-gemini-rest-')
const withTempDir = tempDirs.withDir

const audioBytes = new Uint8Array([1, 2, 3, 4])
const audioBase64 = Buffer.from(audioBytes).toString('base64')
const imageBase64 = Buffer.from(new Uint8Array([9, 8, 7])).toString('base64')
const videoBytes = new Uint8Array([5, 4, 3, 2])

const createMockWavBase64 = (): string => {
  const sampleRate = 16000
  const channels = 1
  const bitsPerSample = 16
  const samples = 1600
  const dataSize = samples * channels * (bitsPerSample / 8)
  const buffer = Buffer.alloc(44 + dataSize)

  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(channels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28)
  buffer.writeUInt16LE(channels * (bitsPerSample / 8), 32)
  buffer.writeUInt16LE(bitsPerSample, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)

  return buffer.toString('base64')
}

beforeEach(() => {
  previousEnv = snapshotEnv(envKeys)
  clearEnv(envKeys)
})

afterEach(async () => {
  globalThis.fetch = originalFetch
  restoreEnv(previousEnv)
  await tempDirs.cleanup()
})

describe('Gemini REST contracts', () => {
  test('generateContent uses v1beta REST headers, generationConfig, and non-thought text extraction', async () => {
    const calls = installFetch((call) => {
      expect(call.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent')
      expect(call.method).toBe('POST')
      expect(call.headers.get('x-goog-api-key')).toBe('gemini-key')
      expect(call.bodyJson).toMatchObject({
        contents: [{ role: 'user', parts: [{ text: 'Return JSON.' }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: { type: 'object' }
        },
        systemInstruction: { parts: [{ text: 'Return only JSON.' }] }
      })
      return jsonResponse({
        candidates: [{
          content: {
            parts: [
              { thought: true, text: 'hidden' },
              { text: '{"ok":true}' }
            ]
          }
        }],
        usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 4 }
      })
    })

    const response = await geminiGenerateContent('gemini-key', {
      model: 'gemini-test',
      contents: 'Return JSON.',
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: { type: 'object' }
      },
      systemInstruction: 'Return only JSON.'
    })

    expect(calls).toHaveLength(1)
    expect(response.text).toBe('{"ok":true}')
    expect(response.usageMetadata).toMatchObject({ promptTokenCount: 3, candidatesTokenCount: 4 })
  })

  test('Gemini REST errors preserve status and headers for retry classification', async () => {
    installFetch(() => jsonResponse({
      error: {
        code: 429,
        status: 'RESOURCE_EXHAUSTED',
        message: 'quota exceeded'
      }
    }, {
      status: 429,
      headers: { 'retry-after': '1' }
    }))

    try {
      await geminiGenerateContent('gemini-key', {
        model: 'gemini-test',
        contents: 'retry?'
      })
      throw new Error('expected Gemini request to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(GeminiRestError)
      expect((error as GeminiRestError).status).toBe(429)
      expect((error as GeminiRestError).headers.get('retry-after')).toBe('1')
      expect(classifyGeminiRetry(error)).toMatchObject({ shouldRetry: true, reason: 'retryable status 429' })
    }
  })

  test('Gemini LLM structured output sends response JSON schema', async () => {
    process.env['GEMINI_API_KEY'] = 'gemini-key'
    const calls = installFetch(() => jsonResponse({
      candidates: [{ content: { parts: [{ text: '{"title":"Done"}' }] } }]
    }))

    const result = await runGeminiModel('Write a title.', 'gemini-3.1-flash-lite-preview', {
      strategy: 'schema-guided',
      schemaName: 'Title',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['title'],
        properties: { title: { type: 'string' } }
      }
    })

    expect(result.result).toBe('{"title":"Done"}')
    expect(calls[0]?.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent')
    expect(calls[0]?.bodyJson?.['generationConfig']).toEqual({
      responseMimeType: 'application/json',
      responseJsonSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['title'],
        properties: { title: { type: 'string' } }
      }
    })
  })

  test('Gemini STT sends inline audio content parts and structured schema', async () => {
    process.env['GEMINI_API_KEY'] = 'gemini-key'
    await withTempDir(async (dir) => {
      const audioPath = join(dir, 'clip.mp3')
      await writeFile(audioPath, new Uint8Array([1, 2, 3]))
      const calls = installFetch(() => jsonResponse({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                text: 'hello world',
                segments: [{ start: 0, end: 1, text: 'hello world' }]
              })
            }]
          }
        }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 6 }
      }))

      const result = await runGeminiStt(audioPath, dir, {
        model: 'gemini-3-flash-preview',
        segmentOffsetMinutes: 0,
        audioDurationSeconds: 1
      })

      expect(result.result.text).toBe('hello world')
      expect(calls).toHaveLength(1)
      const parts = (((calls[0]?.bodyJson?.['contents'] as unknown[])[0] as Record<string, unknown>)['parts'] as Array<Record<string, unknown>>)
      expect(parts[0]).toMatchObject({ text: expect.stringContaining('Transcribe the provided audio exactly') })
      expect(parts[1]).toMatchObject({
        inlineData: {
          mimeType: 'audio/mpeg',
          data: Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')
        }
      })
      expect(calls[0]?.bodyJson?.['generationConfig']).toMatchObject({
        responseMimeType: 'application/json'
      })
    })
  })

  test('Gemini OCR sends inline document content parts and structured schema', async () => {
    process.env['GEMINI_API_KEY'] = 'gemini-key'
    await withTempDir(async (dir) => {
      const imagePath = join(dir, 'page.png')
      await writeFile(imagePath, new Uint8Array([8, 7, 6]))
      const calls = installFetch(() => jsonResponse({
        candidates: [{
          content: {
            parts: [{ text: JSON.stringify({ pages: [{ pageNumber: 1, text: 'OCR text' }] }) }]
          }
        }],
        usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 5 }
      }))

      const metadata: DocumentMetadata = {
        slug: 'page',
        pageCount: 1,
        format: 'png',
        fileSize: 3
      }
      const result = await runGeminiOcr(imagePath, metadata, 'gemini-3.1-flash-lite-preview')

      expect(result.pages).toEqual([{ pageNumber: 1, method: 'ocr', text: 'OCR text' }])
      expect(calls).toHaveLength(1)
      const parts = (((calls[0]?.bodyJson?.['contents'] as unknown[])[0] as Record<string, unknown>)['parts'] as Array<Record<string, unknown>>)
      expect(parts[0]).toMatchObject({ text: expect.stringContaining('Perform OCR') })
      expect(parts[1]).toMatchObject({
        inlineData: {
          mimeType: 'image/png',
          data: Buffer.from(new Uint8Array([8, 7, 6])).toString('base64')
        }
      })
      expect(calls[0]?.bodyJson?.['generationConfig']).toMatchObject({
        responseMimeType: 'application/json'
      })
    })
  })

  test('Gemini STT uploads large files with 8 MiB chunks, uses fileData, and deletes uploads', async () => {
    process.env['GEMINI_API_KEY'] = 'gemini-key'
    await withTempDir(async (dir) => {
      const audioPath = join(dir, 'long.mp3')
      const largeAudio = new Uint8Array(16 * 1024 * 1024 + 1)
      largeAudio[largeAudio.length - 1] = 7
      await writeFile(audioPath, largeAudio)

      const calls = installFetch((call) => {
        if (call.url === 'https://generativelanguage.googleapis.com/upload/v1beta/files') {
          expect(call.headers.get('x-goog-upload-protocol')).toBe('resumable')
          expect(call.headers.get('x-goog-upload-header-content-length')).toBe(String(largeAudio.byteLength))
          expect(call.bodyJson).toMatchObject({
            file: {
              mimeType: 'audio/mpeg',
              displayName: 'long.mp3',
              sizeBytes: String(largeAudio.byteLength)
            }
          })
          return new Response('{}', { status: 200, headers: { 'x-goog-upload-url': 'https://upload.gemini.test/session' } })
        }
        if (call.url === 'https://upload.gemini.test/session') {
          const command = call.headers.get('x-goog-upload-command')
          return new Response(command === 'upload' ? '{}' : JSON.stringify({
            file: {
              name: 'files/gemini-upload',
              uri: 'https://generativelanguage.googleapis.com/v1beta/files/gemini-upload',
              mimeType: 'audio/mpeg'
            }
          }), {
            status: 200,
            headers: { 'x-goog-upload-status': command === 'upload' ? 'active' : 'final' }
          })
        }
        if (call.url === 'https://generativelanguage.googleapis.com/v1beta/files/gemini-upload' && call.method === 'GET') {
          return jsonResponse({ name: 'files/gemini-upload', state: 'ACTIVE' })
        }
        if (call.url.endsWith(':generateContent')) {
          const parts = (((call.bodyJson?.['contents'] as unknown[])[0] as Record<string, unknown>)['parts'] as Array<Record<string, unknown>>)
          expect(parts[1]).toEqual({
            fileData: {
              fileUri: 'https://generativelanguage.googleapis.com/v1beta/files/gemini-upload',
              mimeType: 'audio/mpeg'
            }
          })
          return jsonResponse({
            candidates: [{
              content: {
                parts: [{
                  text: JSON.stringify({
                    text: 'uploaded audio',
                    segments: [{ start: 0, end: 1, text: 'uploaded audio' }]
                  })
                }]
              }
            }],
            usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 5 }
          })
        }
        if (call.url === 'https://generativelanguage.googleapis.com/v1beta/files/gemini-upload' && call.method === 'DELETE') {
          return jsonResponse({})
        }
        throw new Error(`Unexpected Gemini STT fetch: ${call.method} ${call.url}`)
      })

      const result = await runGeminiStt(audioPath, dir, {
        model: 'gemini-3-flash-preview',
        segmentOffsetMinutes: 0,
        audioDurationSeconds: 1
      })

      expect(result.result.text).toBe('uploaded audio')
      expect(calls.filter((call) => call.url === 'https://upload.gemini.test/session').map((call) => ({
        command: call.headers.get('x-goog-upload-command'),
        offset: call.headers.get('x-goog-upload-offset'),
        bytes: call.bodyBytes
      }))).toEqual([
        { command: 'upload', offset: '0', bytes: 8 * 1024 * 1024 },
        { command: 'upload', offset: String(8 * 1024 * 1024), bytes: 8 * 1024 * 1024 },
        { command: 'upload, finalize', offset: String(16 * 1024 * 1024), bytes: 1 }
      ])
      expect(calls.some((call) => call.method === 'DELETE' && call.url.endsWith('/files/gemini-upload'))).toBe(true)
    })
  }, 20_000)

  test('Gemini TTS sends single and multispeaker speechConfig and extracts audio', async () => {
    process.env['GEMINI_API_KEY'] = 'gemini-key'
    const wavBase64 = createMockWavBase64()
    const calls = installFetch(() => jsonResponse({
      candidates: [{
        content: {
          parts: [{ inlineData: { mimeType: 'audio/wav', data: wavBase64 } }]
        }
      }]
    }))

    await withTempDir(async (dir) => {
      const result = await runGeminiTts('Single speaker sample.', dir, {
        model: 'gemini-3.1-flash-tts-preview',
        voiceId: 'Kore'
      })
      expect(await Bun.file(result.audioPath).exists()).toBe(true)
    })
    await withTempDir(async (dir) => {
      const result = await runGeminiTts('Host: Hello.\nGuest: Hi.', dir, {
        model: 'gemini-3.1-flash-tts-preview',
        multiSpeakerConfig: {
          speaker1Name: 'Host',
          speaker1Voice: 'Kore',
          speaker2Name: 'Guest',
          speaker2Voice: 'Puck'
        }
      })
      expect(await Bun.file(result.audioPath).exists()).toBe(true)
    })

    expect(calls[0]?.bodyJson?.['generationConfig']).toMatchObject({
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: 'Kore'
          }
        }
      }
    })
    expect(calls[1]?.bodyJson?.['generationConfig']).toMatchObject({
      responseModalities: ['AUDIO'],
      speechConfig: {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: [
            { speaker: 'Host', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
            { speaker: 'Guest', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } }
          ]
        }
      }
    })
  }, 20_000)

  test('Gemini comic image generation sends inline references and image modalities', async () => {
    process.env['GEMINI_API_KEY'] = 'gemini-key'
    const calls = installFetch(() => jsonResponse({
      candidates: [{
        content: {
          parts: [{ inlineData: { mimeType: 'image/webp', data: imageBase64 } }]
        }
      }],
      usageMetadata: {
        promptTokenCount: 12,
        promptTokensDetails: [
          { modality: 'TEXT', tokenCount: 4 },
          { modality: 'IMAGE', tokenCount: 8 }
        ],
        candidatesTokenCount: 30,
        candidatesTokensDetails: [
          { modality: 'TEXT', tokenCount: 2 },
          { modality: 'IMAGE', tokenCount: 28 }
        ],
        totalTokenCount: 42
      },
      modelVersion: 'gemini-3.1-flash-image-preview'
    }))

    await withTempDir(async (dir) => {
      const referencePath = join(dir, 'reference.png')
      await writeFile(referencePath, new Uint8Array([8, 7, 6]))

      const result = await createImageGemini(
        'Draw a panel.',
        [referencePath],
        'gemini-3.1-flash-image-preview',
        '1024x1024'
      )

      expect(result.mode).toBe('generate')
      expect(result.result.imageBase64).toBe(imageBase64)
      expect(result.result.mimeType).toBe('image/webp')
      expect(result.result.usage).toMatchObject({
        input_tokens: 12,
        input_tokens_details: { text_tokens: 4, image_tokens: 8 },
        output_tokens: 30,
        output_tokens_details: { text_tokens: 2, image_tokens: 28 },
        total_tokens: 42
      })
      expect(result.result.providerSizeLabel).toBe('1:1 @ 1K (mapped from 1024x1024)')
    })

    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent')
    const parts = (((calls[0]?.bodyJson?.['contents'] as unknown[])[0] as Record<string, unknown>)['parts'] as Array<Record<string, unknown>>)
    expect(parts[0]).toEqual({ text: 'Draw a panel.' })
    expect(parts[1]).toEqual({
      inlineData: {
        mimeType: 'image/png',
        data: Buffer.from(new Uint8Array([8, 7, 6])).toString('base64')
      }
    })
    expect(calls[0]?.bodyJson?.['generationConfig']).toEqual({
      responseModalities: ['IMAGE'],
      imageConfig: {
        aspectRatio: '1:1',
        imageSize: '1K'
      }
    })
  })

  test('Gemini Veo polls long-running operations and downloads generated video files', async () => {
    process.env['GEMINI_API_KEY'] = 'gemini-key'
    const calls = installFetch((call) => {
      if (call.url.endsWith('/models/veo-3.1-lite-generate-preview:predictLongRunning')) {
        expect(call.bodyJson).toEqual({
          instances: [{ prompt: 'rain over city' }],
          parameters: {
            sampleCount: 1,
            durationSeconds: 4,
            resolution: '720p',
            aspectRatio: '16:9'
          }
        })
        return jsonResponse({ name: 'operations/veo-123', done: false })
      }
      if (call.url === 'https://generativelanguage.googleapis.com/v1beta/operations/veo-123') {
        return jsonResponse({
          name: 'operations/veo-123',
          done: true,
          response: {
            generateVideoResponse: {
              generatedSamples: [{
                video: {
                  uri: 'https://generativelanguage.googleapis.com/v1beta/files/video-file'
                }
              }]
            }
          }
        })
      }
      if (call.url === 'https://generativelanguage.googleapis.com/v1beta/files/video-file:download?alt=media') {
        return new Response(videoBytes, { status: 200, headers: { 'content-type': 'video/mp4' } })
      }
      throw new Error(`Unexpected Gemini video fetch: ${call.method} ${call.url}`)
    })

    await withTempDir(async (dir) => {
      const result = await runGeminiVideoGen('rain over city', dir, {
        model: 'veo-3.1-lite-generate-preview',
        durationSeconds: 4,
        resolution: '720p',
        aspectRatio: '16:9'
      })
      expect(new Uint8Array(await Bun.file(result.videoPath).arrayBuffer())).toEqual(videoBytes)
    })

    expect(calls.map((call) => call.method)).toEqual(['POST', 'GET', 'GET'])
  })

  test('Gemini Lyria writes inline audio and preserves generated text metadata', async () => {
    process.env['GEMINI_API_KEY'] = 'gemini-key'
    const calls = installFetch(() => jsonResponse({
      candidates: [{
        content: {
          parts: [
            { text: '[Verse]\nSilver static in the sky' },
            { inlineData: { mimeType: 'audio/mpeg', data: audioBase64 } }
          ]
        }
      }]
    }))

    await withTempDir(async (dir) => {
      const lyricsPath = join(dir, 'lyrics.txt')
      await writeFile(lyricsPath, 'Bright lights tonight')
      const result = await runGeminiMusicGen('90s pop rock', dir, {
        model: 'lyria-3-pro-preview',
        durationSeconds: 120,
        lyricsFile: lyricsPath
      })

      expect(new Uint8Array(await Bun.file(result.musicPath).arrayBuffer())).toEqual(audioBytes)
      expect(result.metadata).toMatchObject({
        lyricsSource: 'provided',
        musicDurationMs: 120_000,
        audioMimeType: 'audio/mpeg',
        outputFormat: 'mp3',
        generatedText: '[Verse]\nSilver static in the sky'
      })
    })

    const prompt = ((((calls[0]?.bodyJson?.['contents'] as unknown[])[0] as Record<string, unknown>)['parts'] as Array<Record<string, unknown>>)[0]?.['text'])
    expect(prompt).toContain('90s pop rock')
    expect(prompt).toContain('Create a song that is about 120 seconds long.')
    expect(prompt).toContain('Lyrics:\nBright lights tonight')
  })
})
