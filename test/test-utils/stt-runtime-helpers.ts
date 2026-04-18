import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const createTempOutputTracker = () => {
  const tempDirs: string[] = []

  return {
    async createAudioFixture(prefix: string): Promise<{ audioPath: string, outputDir: string }> {
      const outputDir = await mkdtemp(join(tmpdir(), prefix))
      tempDirs.push(outputDir)

      const audioPath = join(outputDir, 'sample.wav')
      await Bun.write(audioPath, new Uint8Array(2048).fill(1))

      return { audioPath, outputDir }
    },

    async cleanup(): Promise<void> {
      await Promise.all(tempDirs.splice(0).map(async (dir) => {
        await rm(dir, { recursive: true, force: true })
      }))
    }
  }
}

export const snapshotEnv = <const T extends readonly string[]>(keys: T): (() => void) => {
  const snapshot = Object.fromEntries(
    keys.map((key) => [key, process.env[key]])
  ) as Record<T[number], string | undefined>

  return () => {
    for (const key of keys) {
      const value = snapshot[key]
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
}

export const installNoopSleep = (): typeof Bun.sleep => {
  const originalSleep = Bun.sleep
  ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {}) as typeof Bun.sleep
  return originalSleep
}

export const restoreSleep = (sleep: typeof Bun.sleep): void => {
  ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = sleep
}
