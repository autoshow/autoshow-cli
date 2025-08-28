import { l, err } from '@/logging'
import { readFile, unlink, existsSync, execPromise, spawn } from '@/node-utils'
import { formatWhisperTranscript, checkWhisperModel } from './whisper.ts'
import type { ProcessingOptions } from '@/text/text-types'
import type { Ora } from 'ora'

async function runWithProgress(command: string, args: string[], spinner?: Ora): Promise<void> {
  return new Promise((resolve, reject) => {
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
        resolve()
      } else {
        reject(new Error(`whisper-cli-coreml exited with code ${code}`))
      }
    })
    proc.on('error', e => {
      reject(e)
    })
  })
}

async function ensureCoreMLEnv(): Promise<void> {
  const p = '[text/process-steps/02-run-transcription/whisper-coreml]'
  const py = './pyenv/coreml/bin/python'
  l.dim(`${p} Checking CoreML environment at ${py}`)
  if (!existsSync(py)) {
    throw new Error('CoreML conversion environment is missing. Run npm run setup')
  }
  try {
    await execPromise(`${py} -c "import torch,coremltools,numpy,transformers,sentencepiece,huggingface_hub,ane_transformers,safetensors,whisper"`, { maxBuffer: 10000 * 1024 })
  } catch (e: any) {
    err(`${p} CoreML conversion dependencies missing: ${e.message}`)
    throw new Error('CoreML conversion dependencies not installed. Run npm run setup')
  }
}

async function compileMlpackageToMlmodelc(modelId: string): Promise<void> {
  const pkg = `./models/coreml-encoder-${modelId}.mlpackage`
  const out = `./models/ggml-${modelId}-encoder.mlmodelc`
  const p = '[text/process-steps/02-run-transcription/whisper-coreml]'
  if (!existsSync(pkg)) return
  l.dim(`${p} Compiling mlpackage to mlmodelc for ${modelId}`)
  try {
    const compiledDir = `./models/tmp-compile-${modelId}`
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
  } catch (e: any) {
    err(`${p} Error compiling mlpackage: ${e.message}`)
    throw e
  }
}

async function ensureCoreMLEncoder(modelId: string): Promise<void> {
  const encPath = `./models/ggml-${modelId}-encoder.mlmodelc`
  if (existsSync(encPath)) return
  const p = '[text/process-steps/02-run-transcription/whisper-coreml]'
  const pkg = `./models/coreml-encoder-${modelId}.mlpackage`
  if (existsSync(pkg)) {
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
    throw new Error(`CoreML encoder not found after generation: ${encPath}`)
  }
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
    await checkWhisperModel(whisperModel)
    await ensureCoreMLEnv()
    await ensureCoreMLEncoder(whisperModel)

    const args = [
      '-m', `./models/ggml-${whisperModel}.bin`,
      '-f', `${finalPath}.wav`,
      '-of', finalPath,
      '-ml', '1',
      '--threads', '6',
      '--processors', '2',
      '--output-json',
      '--print-progress'
    ]
    try {
      if (spinner) {
        await runWithProgress('./bin/whisper-cli-coreml', args, spinner)
      } else {
        await execPromise(`./bin/whisper-cli-coreml ${args.join(' ')}`, { maxBuffer: 10000 * 1024 })
      }
    } catch (cliErr) {
      err(`${p} Error running whisper-cli-coreml: ${(cliErr as Error).message}`)
      throw cliErr
    }

    const jsonContent = await readFile(`${finalPath}.json`, 'utf8')
    const parsedJson = JSON.parse(jsonContent)
    const txtContent = formatWhisperTranscript(parsedJson)
    await unlink(`${finalPath}.json`)
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