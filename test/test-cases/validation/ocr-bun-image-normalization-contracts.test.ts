import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  isBunImagePngNormalizableFormat,
  normalizeImageToPngWithBun
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/bun-image-utils'
import {
  normalizeHostedDirectImageInput,
  resolveHostedDirectImageInputStrategy
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/hosted-ocr'
import { readPaddleImageDimensions } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-local/paddle-ocr/run-paddle-ocr'
import type { HostedExtractOcrEngine } from '~/types'
import { pngSignature, redDotPng } from '../../test-utils/media-fixtures'

const whiteBmp = new Uint8Array([
  0x42, 0x4d, 0x3a, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x36, 0x00, 0x00, 0x00, 0x28, 0x00,
  0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00,
  0x00, 0x00, 0x01, 0x00, 0x18, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x13, 0x0b,
  0x00, 0x00, 0x13, 0x0b, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff,
  0xff, 0x00,
])

const transparentGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64')

type BunImageCodec = {
  webp: () => { bytes: () => Promise<Uint8Array> }
}

const getBunImageCodec = (): new (source: Uint8Array) => BunImageCodec => {
  const imageConstructor = (Bun as unknown as { Image?: new (source: Uint8Array) => BunImageCodec }).Image
  if (!imageConstructor) {
    throw new Error('Bun.Image is required for OCR image normalization contracts')
  }
  return imageConstructor
}

const readOutputBytes = async (path: string): Promise<Uint8Array> =>
  new Uint8Array(await Bun.file(path).arrayBuffer())

const writeImageFixture = async (
  dir: string,
  name: string,
  bytes: Uint8Array
): Promise<string> => {
  const path = join(dir, name)
  await Bun.write(path, bytes)
  return path
}

describe('OCR Bun.Image normalization contracts', () => {
  test('Bun.Image helper normalizes BMP, GIF, and WebP inputs to PNG', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-bun-normalize-'))
    const Image = getBunImageCodec()
    const fixtures = [
      { name: 'source.bmp', bytes: whiteBmp },
      { name: 'source.gif', bytes: transparentGif },
      { name: 'source.webp', bytes: await new Image(redDotPng).webp().bytes() },
    ]

    try {
      for (const fixture of fixtures) {
        const inputPath = await writeImageFixture(dir, fixture.name, fixture.bytes)
        const outputPath = join(dir, `${fixture.name}.png`)

        await normalizeImageToPngWithBun(inputPath, outputPath)
        const outputBytes = await readOutputBytes(outputPath)

        expect(outputBytes.subarray(0, pngSignature.length)).toEqual(pngSignature)
      }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('Bun.Image helper does not claim TIFF normalization support', async () => {
    expect(isBunImagePngNormalizableFormat('bmp')).toBe(true)
    expect(isBunImagePngNormalizableFormat('gif')).toBe(true)
    expect(isBunImagePngNormalizableFormat('webp')).toBe(true)
    expect(isBunImagePngNormalizableFormat('tif')).toBe(false)
    expect(isBunImagePngNormalizableFormat('tiff')).toBe(false)

    await expect(normalizeImageToPngWithBun('/tmp/source.tif', '/tmp/source.png'))
      .rejects.toThrow('not enabled for tif images')
  })

  test('hosted OCR strategy uses Bun.Image only for the safe provider format gaps', () => {
    const bunCases: Array<{ engine: HostedExtractOcrEngine; format: string }> = [
      { engine: 'anthropic-ocr', format: 'bmp' },
      { engine: 'openai-ocr', format: 'bmp' },
      { engine: 'kimi-ocr', format: 'bmp' },
      { engine: 'gemini-ocr', format: 'gif' },
      { engine: 'deepinfra-ocr', format: 'bmp' },
      { engine: 'deepinfra-ocr', format: 'gif' },
      { engine: 'unstructured-ocr', format: 'webp' },
    ]
    const imageMagickCases: Array<{ engine: HostedExtractOcrEngine; format: string }> = [
      { engine: 'anthropic-ocr', format: 'tif' },
      { engine: 'openai-ocr', format: 'tif' },
      { engine: 'kimi-ocr', format: 'tif' },
      { engine: 'gemini-ocr', format: 'tif' },
      { engine: 'deepinfra-ocr', format: 'tif' },
    ]

    for (const entry of bunCases) {
      expect(resolveHostedDirectImageInputStrategy(entry.format, entry.engine)).toBe('bun-png')
    }
    for (const entry of imageMagickCases) {
      expect(resolveHostedDirectImageInputStrategy(entry.format, entry.engine)).toBe('imagemagick-png')
    }
    expect(resolveHostedDirectImageInputStrategy('gif', 'glm-ocr')).toBe('unsupported')
  })

  test('hosted OCR Bun.Image normalization writes PNG for provider-specific image gaps', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autoshow-hosted-ocr-bun-normalize-'))
    const Image = getBunImageCodec()
    const fixtures: Array<{ engine: HostedExtractOcrEngine; name: string; bytes: Uint8Array }> = [
      { engine: 'anthropic-ocr', name: 'anthropic.bmp', bytes: whiteBmp },
      { engine: 'gemini-ocr', name: 'gemini.gif', bytes: transparentGif },
      { engine: 'unstructured-ocr', name: 'unstructured.webp', bytes: await new Image(redDotPng).webp().bytes() },
    ]

    try {
      for (const fixture of fixtures) {
        const inputPath = await writeImageFixture(dir, fixture.name, fixture.bytes)
        const result = await normalizeHostedDirectImageInput(inputPath, fixture.engine, dir, fixture.name)
        const outputBytes = await readOutputBytes(result.filePath)

        expect(result.format).toBe('png')
        expect(outputBytes.subarray(0, pngSignature.length)).toEqual(pngSignature)
      }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('PaddleOCR dimension helper reads image dimensions with Bun.Image metadata', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autoshow-paddle-bun-metadata-'))
    try {
      const inputPath = await writeImageFixture(dir, 'source.png', redDotPng)

      await expect(readPaddleImageDimensions(inputPath)).resolves.toEqual({ width: 1, height: 1 })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
