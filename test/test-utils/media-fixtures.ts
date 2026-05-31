import { writeFile } from 'node:fs/promises'

export const pngSignature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

export const redDotPng = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x63, 0xf8, 0xcf, 0xc0, 0xf0,
  0x1f, 0x00, 0x05, 0x00, 0x01, 0xff, 0x89, 0x99,
  0x3d, 0x1d, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
  0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
])

type MockWavOptions = {
  sampleRate?: number | undefined
  channels?: number | undefined
  bitsPerSample?: 16 | undefined
  samples?: number | undefined
}

type SyntheticWavOptions = {
  durationSeconds: number
  amplitude: number
  frequencyHz: number
  sampleRate?: number | undefined
}

type ResolvedWavHeaderOptions = {
  sampleRate: number
  channels: number
  bitsPerSample: 16
}

const writeWavHeader = (
  buffer: Buffer,
  dataSize: number,
  options: ResolvedWavHeaderOptions
): void => {
  const bytesPerSample = options.bitsPerSample / 8
  buffer.write('RIFF', 0, 'ascii')
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8, 'ascii')
  buffer.write('fmt ', 12, 'ascii')
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(options.channels, 22)
  buffer.writeUInt32LE(options.sampleRate, 24)
  buffer.writeUInt32LE(options.sampleRate * options.channels * bytesPerSample, 28)
  buffer.writeUInt16LE(options.channels * bytesPerSample, 32)
  buffer.writeUInt16LE(options.bitsPerSample, 34)
  buffer.write('data', 36, 'ascii')
  buffer.writeUInt32LE(dataSize, 40)
}

export const createMockWavBytes = (options: MockWavOptions = {}): Buffer => {
  const resolved: ResolvedWavHeaderOptions = {
    sampleRate: options.sampleRate ?? 16000,
    channels: options.channels ?? 1,
    bitsPerSample: options.bitsPerSample ?? 16
  }
  const samples = options.samples ?? 1600
  const dataSize = samples * resolved.channels * (resolved.bitsPerSample / 8)
  const buffer = Buffer.alloc(44 + dataSize)
  writeWavHeader(buffer, dataSize, resolved)
  return buffer
}

export const createMockWavBase64 = (options: MockWavOptions = {}): string =>
  createMockWavBytes(options).toString('base64')

export const createSyntheticWavBytes = (options: SyntheticWavOptions): Buffer => {
  const sampleRate = options.sampleRate ?? 16000
  const channels = 1
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8
  const sampleCount = Math.floor(sampleRate * options.durationSeconds)
  const dataSize = sampleCount * bytesPerSample
  const buffer = Buffer.alloc(44 + dataSize)
  writeWavHeader(buffer, dataSize, { sampleRate, channels, bitsPerSample })

  for (let index = 0; index < sampleCount; index += 1) {
    const seconds = index / sampleRate
    const envelope = seconds < 0.08 || seconds > options.durationSeconds - 0.08 ? 0 : 1
    const sample = Math.round(Math.sin(2 * Math.PI * options.frequencyHz * seconds) * options.amplitude * envelope * 32767)
    buffer.writeInt16LE(sample, 44 + index * bytesPerSample)
  }

  return buffer
}

export const writeSyntheticWav = async (
  path: string,
  options: SyntheticWavOptions
): Promise<void> => {
  await writeFile(path, createSyntheticWavBytes(options))
}
