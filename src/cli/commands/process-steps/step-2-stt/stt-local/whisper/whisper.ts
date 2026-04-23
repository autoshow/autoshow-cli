import { copyFile, mkdir, readdir, rename, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pathExists, runCapture, runInherit, detectPlatform, supportsCoreML, setupUv, whisperBinaryPath, whisperBuildDir, whisperCoremlEnvDir, whisperLibDir, whisperModelsDir } from '~/cli/commands/setup-and-utilities/setup/setup-orchestrator/run-complete-setup'
import * as l from '~/logger'
import { downloadFile } from '~/utils/download'
import { withRetry } from '~/utils/retries'

const whisperBaseUrl = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main'
const whisperScriptsDir = join(dirname(fileURLToPath(import.meta.url)), 'scripts')

const depsJsonPath = resolve(import.meta.dir, '../../../../config/deps.json')

const coremlPackages = [
  'numpy<2',
  'torch==2.2.0',
  'coremltools>=7,<8',
  'sentencepiece',
  'huggingface_hub',
  'safetensors',
  'ane-transformers',
  'protobuf<4',
  'openai-whisper'
]

const fileExists = async (path: string): Promise<boolean> => {
  return await pathExists(path)
}

const isExecutable = async (path: string): Promise<boolean> => {
  const result = await runCapture('test', ['-x', path], { allowFailure: true })
  return result.exitCode === 0
}

const installCoremlPackages = async (pythonPath: string): Promise<void> => {
  await runInherit('uv', ['pip', 'install', '-p', pythonPath, ...coremlPackages])
}

const ensureCoremlEnvironment = async (): Promise<void> => {
  const uvPython = `${whisperCoremlEnvDir}/bin/python`

  if (!await isExecutable(uvPython)) {
    await runCapture('uv', ['python', 'install', '3.11'], { allowFailure: true })
    await rm(whisperCoremlEnvDir, { recursive: true, force: true })
    await runInherit('uv', ['venv', '--python', '3.11', whisperCoremlEnvDir])
    await installCoremlPackages(uvPython)
    l.write('success', 'CoreML environment created')
    return
  }

  const validateScript = join(whisperScriptsDir, 'validate-coreml.py')
  const validation = await runCapture(uvPython, [validateScript], { allowFailure: true })

  if (validation.exitCode !== 0) {
    l.warn('CoreML environment incomplete, reinstalling packages')
    await installCoremlPackages(uvPython)
    await runInherit(uvPython, [validateScript])
    l.write('success', 'CoreML environment repaired')
    return
  }

}

const cleanupPath = async (path: string): Promise<void> => {
  await rm(path, { recursive: true, force: true })
}

const maybeCopyWhisperDylibs = async (buildSrcDir: string): Promise<void> => {
  const dylibMarker = `${buildSrcDir}/libwhisper.dylib`
  if (!await fileExists(dylibMarker)) {
    return
  }

  await mkdir(whisperLibDir, { recursive: true })

  const entries = await readdir(buildSrcDir, { withFileTypes: true })
  const dylibs = entries
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
    .filter(name => name.startsWith('libwhisper') && name.endsWith('.dylib'))

  for (const dylib of dylibs) {
    await copyFile(`${buildSrcDir}/${dylib}`, `${whisperLibDir}/${dylib}`)
  }

  await runCapture('install_name_tool', ['-add_rpath', whisperLibDir, whisperBinaryPath], { allowFailure: true })
  await runCapture(
    'install_name_tool',
    ['-change', '@rpath/libwhisper.1.dylib', `${whisperLibDir}/libwhisper.1.dylib`, whisperBinaryPath],
    { allowFailure: true }
  )
}

const verifyWhisperBinary = async (): Promise<void> => {
  if (process.env['DOCKER_CONTAINER']) {
    if (!await isExecutable(whisperBinaryPath)) {
      l.warn('Whisper installation may have issues, but continuing')
    }
    return
  }

  const result = await runCapture(whisperBinaryPath, ['--help'], { allowFailure: true })
  if (result.exitCode !== 0) {
    l.warn('Whisper installation may have issues, but continuing')
  }
}

const readWhisperTag = async (): Promise<string> => {
  try {
    const raw = await Bun.file(depsJsonPath).text()
    const deps = JSON.parse(raw)
    return (deps['whisper.cpp']?.tag as string) || 'v1.7.4'
  } catch {
    return 'v1.7.4'
  }
}

export const detectCoremlSupport = async (): Promise<boolean> => {
  return await supportsCoreML()
}

export const setupWhisper = async (): Promise<void> => {
  if (await fileExists(whisperBinaryPath)) {
    if (process.env['DOCKER_CONTAINER']) {
      if (await isExecutable(whisperBinaryPath)) {
        return
      }
    } else {
      const check = await runCapture(whisperBinaryPath, ['--help'], { allowFailure: true })
      if (check.exitCode === 0) {
        return
      }

      l.write('info', 'Whisper binary found but not working, rebuilding')
    }
  }

  const tag = await readWhisperTag()
  const repoDir = whisperBuildDir

  l.write('info', `Building whisper.cpp ${tag}`)

  await mkdir(repoDir, { recursive: true })
  await cleanupPath(repoDir)

  await runInherit('git', ['clone', '--branch', tag, '--depth', '1', 'https://github.com/ggerganov/whisper.cpp.git', repoDir])

  const platform = detectPlatform()
  if (platform === 'darwin') {
    await runInherit('cmake', ['-B', 'build', '-DGGML_METAL=ON', '-DBUILD_SHARED_LIBS=OFF', '-DCMAKE_BUILD_TYPE=Release'], { cwd: repoDir })
  } else {
    await runInherit('cmake', ['-B', 'build', '-DBUILD_SHARED_LIBS=OFF', '-DCMAKE_BUILD_TYPE=Release'], { cwd: repoDir })
  }

  await runInherit('cmake', ['--build', 'build', '-j', '--config', 'Release'], { cwd: repoDir })

  await mkdir(dirname(whisperBinaryPath), { recursive: true })
  await mkdir(whisperLibDir, { recursive: true })

  const binCandidateA = `${repoDir}/build/bin/whisper-cli`
  const binCandidateB = `${repoDir}/build/whisper-cli`
  const sourceBinary = await fileExists(binCandidateA) ? binCandidateA : binCandidateB

  await copyFile(sourceBinary, whisperBinaryPath)
  await runInherit('chmod', ['+x', whisperBinaryPath])

  if (platform === 'darwin') {
    await maybeCopyWhisperDylibs(`${repoDir}/build/src`)
  }

  await verifyWhisperBinary()

  l.write('success', 'Whisper.cpp installed')
}

const compileCoremlPackage = async (modelName: string): Promise<void> => {
  const mlpackagePath = `${whisperModelsDir}/coreml-encoder-${modelName}.mlpackage`
  if (!await fileExists(mlpackagePath)) {
    l.warn(`CoreML encoder conversion failed for ${modelName}`)
    return
  }

  const outTmp = `${whisperModelsDir}/tmp-compile-${Date.now()}`
  await mkdir(outTmp, { recursive: true })

  const compileA = await runCapture('xcrun', ['coremlc', 'compile', mlpackagePath, outTmp], { allowFailure: true })
  const compiled = compileA.exitCode === 0 || (await runCapture('xcrun', ['coremlcompiler', 'compile', mlpackagePath, outTmp], { allowFailure: true })).exitCode === 0

  if (compiled) {
    const findResult = await runCapture('find', [outTmp, '-type', 'd', '-name', '*.mlmodelc', '-maxdepth', '2'], { allowFailure: true })
    const compiledDir = findResult.stdout
      .split('\n')
      .map(line => line.trim())
      .find(Boolean)

    if (compiledDir) {
      const finalPath = `${whisperModelsDir}/ggml-${modelName}-encoder.mlmodelc`
      await cleanupPath(finalPath)
      await rename(compiledDir, finalPath)
      await cleanupPath(outTmp)
      await cleanupPath(mlpackagePath)

      if (await fileExists(finalPath)) {
        l.write('success', `CoreML encoder compiled to ${finalPath}`)
      } else {
        l.warn('CoreML encoder compilation artifact missing')
      }

      return
    }
  }

  await cleanupPath(outTmp)

  const finalPackage = `${whisperModelsDir}/ggml-${modelName}-encoder.mlpackage`
  await cleanupPath(finalPackage)
  await rename(mlpackagePath, finalPackage)

  if (await fileExists(finalPackage)) {
    l.write('success', `CoreML encoder saved as ${finalPackage}`)
  } else {
    l.warn('CoreML encoder artifact missing')
  }
}

export const coremlConvert = async (modelName: string): Promise<void> => {
  if (!await detectCoremlSupport()) {
    l.warn('CoreML not supported on this host')
    return
  }

  const mlmodelcPath = `${whisperModelsDir}/ggml-${modelName}-encoder.mlmodelc`
  const mlpackagePath = `${whisperModelsDir}/ggml-${modelName}-encoder.mlpackage`

  if (await fileExists(mlmodelcPath) || await fileExists(mlpackagePath)) {
    return
  }

  await setupUv()
  l.write('info', `Converting ${modelName} to CoreML format`)

  await ensureCoremlEnvironment()

  const convertScript = join(whisperScriptsDir, 'convert-whisper-to-coreml.py')
  await runInherit(`${whisperCoremlEnvDir}/bin/python`, [
    convertScript,
    '--model', modelName,
    '--models-dir', whisperModelsDir,
    '--encoder-only', 'true'
  ])

  await compileCoremlPackage(modelName)
}

export const downloadWhisperModel = async (modelName: string): Promise<void> => {
  await mkdir(whisperModelsDir, { recursive: true })

  const modelFile = `ggml-${modelName}.bin`
  const destination = `${whisperModelsDir}/${modelFile}`

  if (await fileExists(destination)) {
  } else {
    l.write('info', `Downloading whisper model: ${modelName}`)

    const url = `${whisperBaseUrl}/${modelFile}`

    await withRetry(
      { retryClass: 'setup_download', operationName: `whisper-model-${modelName}` },
      async () => {
        await cleanupPath(destination)
        await downloadFile({
          url,
          destination,
          expectedMinBytes: 1000,
          flowId: 'whisper-model'
        })
      }
    )

    l.write('success', `Whisper model ${modelName} downloaded`)
  }

  if (!await detectCoremlSupport()) {
    l.write('info', 'CoreML not supported on this host')
    return
  }

  await coremlConvert(modelName)
}

export const ensureWhisperReady = async (modelName: string): Promise<void> => {
  if (!modelName) {
    l.error('Model name required')
    throw new Error('Model name required')
  }

  if (await fileExists(whisperBinaryPath)) {
    const healthy = process.env['DOCKER_CONTAINER']
      ? await isExecutable(whisperBinaryPath)
      : (await runCapture(whisperBinaryPath, ['--help'], { allowFailure: true })).exitCode === 0

    if (!healthy) {
      l.write('info', 'Rebuilding whisper')
      await setupWhisper()
    }
  } else {
    await setupWhisper()
  }

  await downloadWhisperModel(modelName)
}
