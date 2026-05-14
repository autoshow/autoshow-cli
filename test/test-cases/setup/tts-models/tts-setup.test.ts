import { describe, test, expect } from "bun:test"
import { join } from "node:path"
import { runCommand, fileExists } from "../../../test-utils/test-helpers"

const TTS_ENGINES = [
  {
    name: "kitten-tts",
    setupModule: "./src/cli/commands/process-steps/step-4-tts/tts-local/kitten/kitten-tts.ts",
    setupFn: "setupKittenTts",
    envDir: "runtime/bin/kitten-tts",
    pythonVersion: "3.12",
    importCheck: "from kittentts import KittenTTS; import soundfile",
  },
]

describe("tts model setup", () => {
  for (const engine of TTS_ENGINES) {
    const ttsSetupTestName = `${engine.name} sets up successfully`
    test(ttsSetupTestName, async () => {
      const setupCode = `const m = await import("${engine.setupModule}"); await m.${engine.setupFn}()`
      const result = await runCommand(["-e", setupCode], { testName: ttsSetupTestName })

      expect(result.exitCode).toBe(0)

      const pythonExists = await fileExists(join(engine.envDir, "bin/python"))
      expect(pythonExists).toBe(true)

      const importResult = Bun.spawnSync(
        [join(engine.envDir, "bin/python"), "-c", engine.importCheck],
      )
      expect(importResult.exitCode).toBe(0)
    })

    test(`${engine.name} venv has required packages`, async () => {
      const pythonPath = join(engine.envDir, "bin/python")
      const pythonExists = await fileExists(pythonPath)
      if (!pythonExists) {
        console.log(`Skipping: ${engine.name} venv not set up (run: bun as setup)`)
        return
      }

      expect(await fileExists(join(engine.envDir, `lib/python${engine.pythonVersion}/site-packages/kittentts`))).toBe(true)
      expect(await fileExists(join(engine.envDir, `lib/python${engine.pythonVersion}/site-packages/soundfile.py`))).toBe(true)

      const importResult = Bun.spawnSync([pythonPath, "-c", engine.importCheck])
      expect(importResult.exitCode).toBe(0)
    })
  }
})
