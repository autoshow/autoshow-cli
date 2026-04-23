import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathExists, runCapture, runInherit, detectArchitecture, detectPlatform, llamaBinaryPath } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import * as l from '~/utils/logger'
import { downloadFile } from '~/cli/commands/setup-and-utilities/setup/setup-download/download'
import { withRetry } from '~/utils/retries'

const depsJsonPath = resolve(import.meta.dir, '../../../config/deps.json')

const shouldPrintCompletion = (): boolean => {
  return (process.env['AUTOSHOW_COMPACT_SETUP'] || '0') !== '1'
}

const readLlamaTag = async (): Promise<string> => {
  try {
    const raw = await Bun.file(depsJsonPath).text()
    const deps = JSON.parse(raw)
    return (deps['llama.cpp']?.tag as string) || 'b8087'
  } catch {
    return 'b8087'
  }
}

export const checkLlamaInstalled = async (): Promise<boolean> => {
  return await pathExists(llamaBinaryPath)
}

export const checkLlamaRunning = async (): Promise<boolean> => {
  const result = await runCapture('curl', ['-s', 'http://localhost:8080/health'], { allowFailure: true })
  return result.exitCode === 0
}

export const installLlama = async (): Promise<void> => {
  l.write('info', 'Installing llama.cpp')
  const platform = detectPlatform()
  const arch = detectArchitecture()
  const tag = await readLlamaTag()

  await mkdir(dirname(llamaBinaryPath), { recursive: true })

  const releaseBase = `https://github.com/ggml-org/llama.cpp/releases/download/${tag}`

  let tarballName: string

  if (platform === 'darwin') {
    tarballName = (arch === 'aarch64' || arch === 'arm64')
      ? `llama-${tag}-bin-macos-arm64.tar.gz`
      : `llama-${tag}-bin-macos-x64.tar.gz`
  } else if (platform === 'linux') {
    if (arch === 'x86_64') {
      tarballName = `llama-${tag}-bin-ubuntu-x64.tar.gz`
    } else if (arch === 'aarch64' || arch === 'arm64') {

      l.error(`No pre-built llama-server tarball for linux/${arch} in llama.cpp releases`)
      throw new Error(`Unsupported architecture for llama setup: linux/${arch}`)
    } else {
      l.error(`Unsupported architecture: ${arch}`)
      throw new Error(`Unsupported architecture for llama setup: ${arch}`)
    }
  } else {
    l.error('Unsupported platform for automatic llama.cpp installation')
    throw new Error('Unsupported platform for llama setup')
  }

  const tarballUrl = `${releaseBase}/${tarballName}`

  const binDir = dirname(llamaBinaryPath)

  await withRetry(
    { retryClass: 'setup_download', operationName: 'llama-tarball' },
    async () => {
      await downloadFile({
        url: tarballUrl,
        destination: binDir,
        mode: 'pipe-to-tar',
        flowId: 'llama-tarball'
      })
    }
  )

  await runInherit('chmod', ['+x', llamaBinaryPath])
  l.write('success', 'llama.cpp installed')
}

export const startLlamaService = async (): Promise<void> => {
  if (await checkLlamaRunning()) {
    return
  }

  l.write('info', 'Starting llama-server')

  if (process.env['DOCKER_CONTAINER']) {
    l.write('info', 'Running in Docker, llama-server should be started by entrypoint')
    return
  }

  const modelPath = process.env['LLAMA_MODEL_PATH'] || ''

  if (!modelPath) {
    l.warn('No model path set, llama-server will need to be started manually with a model')
    return
  }

  const proc = Bun.spawn([llamaBinaryPath, '-m', modelPath, '--port', '8080', '--host', '127.0.0.1'], {
    stdin: 'ignore',
    stdout: 'ignore',
    stderr: 'ignore'
  })
  proc.unref()

  await Bun.sleep(3000)

  if (await checkLlamaRunning()) {
    l.write('success', 'llama-server started')
  } else {
    l.warn('llama-server may not have started correctly')
  }
}

export const setupLlama = async (): Promise<void> => {
  if (!await checkLlamaInstalled()) {
    await installLlama()
  } else {
  }
}

export const runLlamaSetup = async (): Promise<void> => {
  await setupLlama()

  if (shouldPrintCompletion()) {
    l.write('success', 'llama.cpp setup complete')
  }
}
