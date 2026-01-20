import { readdir, readFile, writeFile, access } from '@/node-utils'
import { join } from '@/node-utils'

export const SAMPLE_RATE = 24000
export const CHANNELS = 1
export const BYTES_PER_SAMPLE = 2

export const buildWavHeader = (pcmSize: number): Buffer => {
  const h = Buffer.alloc(44)
  const writeStr = (s: string, o: number) => h.write(s, o)
  const writeInt = (v: number, o: number, b = 4) => b === 4 ? h.writeUInt32LE(v, o) : h.writeUInt16LE(v, o)
  
  writeStr('RIFF', 0), writeInt(36 + pcmSize, 4), writeStr('WAVE', 8), writeStr('fmt ', 12)
  writeInt(16, 16), writeInt(1, 20, 2), writeInt(CHANNELS, 22, 2), writeInt(SAMPLE_RATE, 24)
  writeInt(SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE, 28), writeInt(CHANNELS * BYTES_PER_SAMPLE, 32, 2)
  writeInt(8 * BYTES_PER_SAMPLE, 34, 2), writeStr('data', 36), writeInt(pcmSize, 40)
  
  return h
}

export const ensureSilenceFile = async (outDir: string): Promise<void> => {
  const silence = join(outDir, 'silence_025.pcm')
  try { 
    await access(silence) 
  } catch {
    await writeFile(silence, Buffer.alloc(SAMPLE_RATE * 0.5 * BYTES_PER_SAMPLE * CHANNELS))
  }
}

export const mergeAudioFiles = async (outDir: string): Promise<void> => {
  const files = await readdir(outDir)
  const pcms = files.filter(f => f.endsWith('.pcm') && f !== 'silence_025.pcm').sort()
  
  const silence = await readFile(join(outDir, 'silence_025.pcm'))
  const buffersNested = await Promise.all(pcms.map(async (pcm, i) => [
    await readFile(join(outDir, pcm)),
    ...(i < pcms.length - 1 ? [silence] : [])
  ]))
  const buffers = buffersNested.flat()
  await writeFile(join(outDir, 'full_conversation.pcm'), Buffer.concat(buffers))
}

export const convertPcmToWav = async (outDir: string): Promise<void> => {
  const pcmPath = join(outDir, 'full_conversation.pcm')
  const pcm = await readFile(pcmPath)
  await writeFile(join(outDir, 'full_conversation.wav'), Buffer.concat([buildWavHeader(pcm.length), pcm]))
}
