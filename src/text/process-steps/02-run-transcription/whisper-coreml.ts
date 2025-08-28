import { l, err } from '@/logging'
import { readFile, unlink, existsSync, execPromise, spawn } from '@/node-utils'
import { formatWhisperTranscript, checkWhisperModel } from './whisper.ts'
import type { ProcessingOptions } from '@/text/text-types'
import type { Ora } from 'ora'

async function runWithProgress(command: string, args: string[], spinner?: Ora): Promise<void> {
  const p = '[text/process-steps/02-run-transcription/whisper-coreml]'
  return new Promise((resolve, reject) => {
    l.dim(`${p} Starting CoreML whisper process: ${command} ${args.join(' ')}`)
    const proc = spawn(command, args)
    let last = -1
    const onData = (data: Buffer) => {
      const out = data.toString()
      out.split('\n').forEach(line => {
        const m = line.match(/whisper_print_progress_callback:\s*progress\s*=\s*(\d+)%/)
        if (m) {
          const progress = parseInt(m[1]!)
          if (progress !== last) {
            last = progress
            if (spinner) spinner.text = `Step 3 - Run Transcription (${progress}%)`
          }
        }
      })
    }
    proc.stdout.on('data', onData)
    proc.stderr.on('data', onData)
    proc.on('close', code => {
      if (code === 0) {
        l.dim(`${p} CoreML whisper process completed successfully`)
        resolve()
      } else {
        l.warn(`${p} CoreML whisper process exited with code ${code}`)
        reject(new Error(`whisper-cli-coreml exited with code ${code}`))
      }
    })
    proc.on('error', e => {
      l.warn(`${p} CoreML whisper process error: ${e.message}`)
      reject(e)
    })
  })
}

async function ensureCoreMLEnv(): Promise<void> {
  const p = '[text/process-steps/02-run-transcription/whisper-coreml]'
  const py = './build/pyenv/coreml/bin/python'
  l.dim(`${p} Checking CoreML environment at ${py}`)
  if (!existsSync(py)) {
    l.warn(`${p} CoreML Python environment not found at: ${py}`)
    throw new Error('CoreML conversion environment is missing. Run npm run setup')
  }
  try {
    await execPromise(`${py} -c "import torch,coremltools,numpy,transformers,sentencepiece,huggingface_hub,ane_transformers,safetensors,whisper"`, { maxBuffer: 10000 * 1024 })
    l.dim(`${p} CoreML environment dependencies verified`)
  } catch (e: any) {
    err(`${p} CoreML conversion dependencies missing: ${e.message}`)
    throw new Error('CoreML conversion dependencies not installed. Run npm run setup')
  }
}

async function compileMlpackageToMlmodelc(modelId: string): Promise<void> {
  const pkg = `./build/models/coreml-encoder-${modelId}.mlpackage`
  const out = `./build/models/ggml-${modelId}-encoder.mlmodelc`
  const p = '[text/process-steps/02-run-transcription/whisper-coreml]'
  if (!existsSync(pkg)) return
  l.dim(`${p} Compiling mlpackage to mlmodelc for ${modelId}`)
  try {
    const compiledDir = `./build/models/tmp-compile-${modelId}`
    await execPromise(`mkdir -p "${compiledDir}"`)
    try {
      await execPromise(`xcrun coremlc compile "${pkg}" "${compiledDir}"`, { maxBuffer: 10000 * 1024 })
    } catch {
      await execPromise(`xcrun coremlcompiler compile "${pkg}" "${compiledDir}"`, { maxBuffer: 10000 * 1024 })
    }
    const { stdout } = await execPromise(`find "${compiledDir}" -type d -name "*.mlmodelc" -maxdepth 2 | head -n 1`)
    const cand = stdout.trim()
    if (!cand) throw new Error('Compiled .mlmodelc not found')
    await execPromise(`rm -rf "${out}" && mv "${cand}" "${out}" && rm -rf "${compiledDir}"`)
    l.dim(`${p} Compiled ${modelId} mlmodelc successfully`)
  } catch (e: any) {
    err(`${p} Error compiling mlpackage: ${e.message}`)
    throw e
  }
}

async function ensureCoreMLEncoder(modelId: string): Promise<void> {
  const encPath = `./build/models/ggml-${modelId}-encoder.mlmodelc`
  if (existsSync(encPath)) {
    l.dim(`[text/process-steps/02-run-transcription/whisper-coreml] CoreML encoder exists at: ${encPath}`)
    return
  }
  const p = '[text/process-steps/02-run-transcription/whisper-coreml]'
  const pkg = `./build/models/coreml-encoder-${modelId}.mlpackage`
  if (existsSync(pkg)) {
    l.dim(`${p} Found mlpackage, compiling to mlmodelc`)
    await compileMlpackageToMlmodelc(modelId)
    if (existsSync(encPath)) return
  }
  l.dim(`${p} Generating CoreML encoder for ${modelId}`)
  try {
    await execPromise(`bash ./.github/setup/transcription/generate-coreml-model.sh ${modelId}`, { maxBuffer: 10000 * 1024 })
  } catch (e: any) {
    err(`${p} Error generating CoreML model: ${e.message}`)
    throw e
  }
  if (!existsSync(encPath)) {
    if (existsSync(pkg)) {
      await compileMlpackageToMlmodelc(modelId)
    }
  }
  if (!existsSync(encPath)) {
    l.warn(`${p} CoreML encoder not found after generation: ${encPath}`)
    throw new Error(`CoreML encoder not found after generation: ${encPath}`)
  }
  l.dim(`${p} CoreML encoder ready at: ${encPath}`)
}

export async function callWhisperCoreml(
  options: ProcessingOptions,
  finalPath: string,
  spinner?: Ora
) {
  const p = '[text/process-steps/02-run-transcription/whisper-coreml]'
  try {
    const whisperModel = typeof options['whisperCoreml'] === 'string'
      ? options['whisperCoreml']
      : options['whisperCoreml'] === true
        ? 'base'
        : (() => { throw new Error('Invalid whisperCoreml option') })()
    
    l.dim(`${p} Using whisper CoreML model: ${whisperModel}`)
    await checkWhisperModel(whisperModel)
    await ensureCoreMLEnv()
    await ensureCoreMLEncoder(whisperModel)

    const args = [
      '-m', `./build/models/ggml-${whisperModel}.bin`,
      '-f', `${finalPath}.wav`,
      '-of', finalPath,
      '-ml', '1',
      '--threads', '6',
      '--processors', '2',
      '--output-json',
      '--print-progress'
    ]
    
    l.dim(`${p} CoreML whisper command args: ${args.join(' ')}`)
    
    try {
      if (spinner) {
        await runWithProgress('./build/bin/whisper-cli-coreml', args, spinner)
      } else {
        await execPromise(`./build/bin/whisper-cli-coreml ${args.join(' ')}`, { maxBuffer: 10000 * 1024 })
      }
    } catch (cliErr) {
      err(`${p} Error running whisper-cli-coreml: ${(cliErr as Error).message}`)
      throw cliErr
    }

    const jsonPath = `${finalPath}.json`
    l.dim(`${p} Reading CoreML transcription result from: ${jsonPath}`)
    const jsonContent = await readFile(jsonPath, 'utf8')
    const parsedJson = JSON.parse(jsonContent)
    const txtContent = formatWhisperTranscript(parsedJson)
    await unlink(jsonPath)
    
    l.dim(`${p} CoreML transcription completed successfully`)
    return {
      transcript: txtContent,
      modelId: whisperModel,
      costPerMinuteCents: 0
    }
  } catch (error) {
    err(`${p} Error in callWhisperCoreml: ${(error as Error).message}`)
    throw error
  }
}