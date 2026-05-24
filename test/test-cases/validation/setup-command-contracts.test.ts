import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { runCommand } from '../../test-utils/test-helpers'
import { CALIBRE_REQUIRED_TOOLS } from '~/cli/commands/setup-and-utilities/setup/setup-download/dl-document/calibre'
import {
  collectDoctorNextSteps,
  collectDoctorReport,
  type DoctorCheck,
  type DoctorProbes
} from '~/cli/commands/setup-and-utilities/setup/run-doctor'
import { HOSTED_PROVIDER_ENV_CHECKS } from '~/cli/commands/setup-and-utilities/setup/hosted-provider-config'
import { downloadKittenTtsModel, runInherit } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import type { AutoshowConfig, RunResult } from '~/types'
import {
  REVERB_ASR_REQUIRED_FILES,
  REVERB_DIARIZATION_REQUIRED_FILES
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/reverb/reverb-assets'

const okRun = (stdout = ''): RunResult => ({ stdout, stderr: '', exitCode: 0 })

const withEnvVar = async <T>(key: string, value: string | undefined, fn: () => Promise<T>): Promise<T> => {
  const previous = process.env[key]
  if (value === undefined) delete process.env[key]
  else process.env[key] = value
  try {
    return await fn()
  } finally {
    if (previous === undefined) delete process.env[key]
    else process.env[key] = previous
  }
}

const makeDoctorProbes = (overrides: Partial<DoctorProbes> = {}): Partial<DoctorProbes> => ({
  env: {},
  which: (command: string) => `/usr/bin/${command}`,
  pathExists: async () => true,
  listDirectory: async () => ['ggml-tiny.bin', 'ggml-large-v3-turbo.bin'],
  directoryHasFiles: async () => true,
  run: async (command: string, args: string[]) => {
    if (command === 'tesseract' && args.includes('--list-langs')) {
      return okRun('List of available languages in "/tmp":\neng\n')
    }
    if (command === 'ffmpeg' && args.includes('-filters')) {
      return okRun(' ... ass              V->V       Render ASS subtitles\n')
    }
    return okRun('ok')
  },
  resolveYtDlpBinaryInfo: () => ({ path: '/runtime/bin/yt-dlp', source: 'managed' }),
  resolveUvCommand: async () => '/usr/bin/uv',
  readDefuddleCliReadiness: async () => ({ label: 'defuddle', ok: true, detail: 'defuddle 0.17.0' }),
  resolveConfigPath: async () => '/tmp/autoshow.json',
  loadConfig: async () => ({}),
  inspectYtDlpAuthState: async () => ({
    configuredMode: 'none',
    usableMode: 'none',
    cookieArgs: []
  }),
  hasSetupManagedLlamaModel: async () => true,
  readLlamaSetupModelMetadata: async () => ({
    version: 1,
    models: {
      'ggml-org/gemma-3-270m-it-GGUF': {
        requestedModel: 'ggml-org/gemma-3-270m-it-GGUF',
        repo: 'ggml-org/gemma-3-270m-it-GGUF',
        downloadedAt: '2026-01-01T00:00:00.000Z'
      }
    }
  }),
  ...overrides
})

const flattenDoctorChecks = (report: Awaited<ReturnType<typeof collectDoctorReport>>): DoctorCheck[] =>
  report.sections.flatMap(section => section.checks)

const findDoctorCheck = (
  report: Awaited<ReturnType<typeof collectDoctorReport>>,
  label: string
): DoctorCheck => {
  const item = flattenDoctorChecks(report).find(check => check.label === label)
  if (!item) throw new Error(`Missing doctor check: ${label}`)
  return item
}

describe('setup command contracts', () => {
  test('setup help does not expose Cloudflare focused setup', async () => {
    const result = await runCommand(['src/cli/create-cli.ts', 'setup', '--help'], {
      env: { NO_COLOR: '1' }
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('defuddle')
    expect(result.stdout).not.toContain('--cloudflare')
    expect(result.stdout).not.toContain('Cloudflare')
  })

  test('setup usage contracts include the defuddle step', async () => {
    const result = await runCommand(['src/cli/create-cli.ts', 'setup', '--step', 'not-real'], {
      env: { NO_COLOR: '1' }
    })

    expect(result.exitCode).toBe(2)
    expect(`${result.stdout}\n${result.stderr}`).toContain('defuddle')
  })

  test('Linux yt-dlp setup writes the managed runtime binary without sudo chmod or mv', async () => {
    const source = await Bun.file('src/cli/commands/setup-and-utilities/setup/setup-download/dl-audio/audio.ts').text()

    expect(source).toContain('ytDlpManagedBinaryPath')
    expect(source).toContain('makeExecutable(ytDlpManagedBinaryPath)')
    expect(source).not.toContain("runInherit('sudo', ['mv'")
    expect(source).not.toContain("runInherit('sudo', ['chmod'")
  })

  test('command existence checks use Bun APIs instead of shell test', async () => {
    const setupSource = await Bun.file('src/cli/commands/setup-and-utilities/setup/run-complete-setup.ts').text()
    const utilSource = await Bun.file('src/utils/cli-utils.ts').text()
    const combinedSource = `${setupSource}\n${utilSource}`

    expect(combinedSource).toContain('Bun.which(command)')
    expect(combinedSource).not.toContain('test -x')
  })

  test('Calibre setup only requires ebook-convert for ebook normalization', () => {
    const tools = [...CALIBRE_REQUIRED_TOOLS]
    expect(tools).toEqual(['ebook-convert'])
    expect(tools).not.toContain('calibre-debug')
    expect(tools).not.toContain('ebook-meta')
  })

  test('compact setup subprocess failures include a bounded output tail', async () => {
    await withEnvVar('AUTOSHOW_COMPACT_SETUP', '1', async () => {
      try {
        await runInherit('bun', [
          '-e',
          'for (let i = 0; i < 80; i++) console.log(`stdout-line-${i}`); console.error("stderr-tail-line"); process.exit(7)'
        ])
        throw new Error('expected compact subprocess failure')
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        expect(message).toContain('exit code 7')
        expect(message).toContain('stderr-tail-line')
        expect(message).toContain('stdout-line-79')
        expect(message).not.toContain('stdout-line-0')
      }
    })
  })

  test('Kitten TTS model setup fails when the model load command fails', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autoshow-kitten-model-'))
    try {
      const fakePython = join(dir, 'python')
      await writeFile(fakePython, '#!/bin/sh\necho kitten-load-stdout\necho kitten-load-stderr >&2\nexit 9\n')
      await chmod(fakePython, 0o755)

      await expect(downloadKittenTtsModel('kitten-tts-test', { pythonPath: fakePython }))
        .rejects.toThrow(/Kitten TTS model download failed.*kitten-load-stderr/s)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('doctor reports missing managed runtimes and local model assets', async () => {
    const missingPathFragments = [
      '/runtime/bin/whisper-cli',
      '/runtime/bin/llama-server',
      'ggml-tiny.bin',
      ...REVERB_ASR_REQUIRED_FILES,
      ...REVERB_DIARIZATION_REQUIRED_FILES,
      'kitten-tts/bin/python'
    ]
    const report = await collectDoctorReport(makeDoctorProbes({
      pathExists: async (path) => !missingPathFragments.some(fragment => path.includes(fragment)),
      hasSetupManagedLlamaModel: async () => false,
      readLlamaSetupModelMetadata: async () => ({ version: 1, models: {} })
    }))

    expect(findDoctorCheck(report, 'runtime/bin/whisper-cli').status).toBe('MISSING')
    expect(findDoctorCheck(report, 'runtime/bin/llama-server').status).toBe('MISSING')
    expect(findDoctorCheck(report, 'default whisper model tiny').status).toBe('MISSING')
    expect(findDoctorCheck(report, 'Reverb ASR files').status).toBe('MISSING')
    expect(findDoctorCheck(report, 'Reverb ASR files').detail).toContain('en-cmvn.json')
    expect(findDoctorCheck(report, 'Reverb diarization cache').status).toBe('MISSING')
    expect(findDoctorCheck(report, 'Kitten TTS Python env').status).toBe('MISSING')
    expect(findDoctorCheck(report, 'llama model ggml-org/gemma-3-270m-it-GGUF').status).toBe('MISSING')
    expect(report.nextSteps).toContain('bun as setup --step whisper-binary')
    expect(report.nextSteps).toContain('bun as setup --step llama-binary')
  })

  test('doctor Reverb next step is runnable when Hugging Face token is already set', async () => {
    const report = await collectDoctorReport(makeDoctorProbes({
      env: { HUGGINGFACE_TOKEN: 'hf_test' },
      pathExists: async (path) =>
        !path.includes('/runtime/bin/reverb/')
        && !REVERB_ASR_REQUIRED_FILES.some(file => path.includes(file))
        && !REVERB_DIARIZATION_REQUIRED_FILES.some(file => path.includes(file))
    }))

    expect(findDoctorCheck(report, 'Reverb Python env').nextStep).toBe('bun as setup --step reverb')
    expect(findDoctorCheck(report, 'Reverb ASR files').nextStep).toBe('bun as setup --step reverb')
    expect(findDoctorCheck(report, 'Reverb diarization cache').nextStep).toBe('bun as setup --step reverb')
    expect(report.nextSteps).toContain('bun as setup --step reverb')
    expect(report.nextSteps.join('\n')).not.toContain('HUGGINGFACE_TOKEN=')
  })

  test('doctor Reverb next step asks for token before setup when token is absent', async () => {
    const report = await collectDoctorReport(makeDoctorProbes({
      env: {},
      pathExists: async (path) =>
        !path.includes('/runtime/bin/reverb/')
        && !REVERB_ASR_REQUIRED_FILES.some(file => path.includes(file))
        && !REVERB_DIARIZATION_REQUIRED_FILES.some(file => path.includes(file))
    }))

    expect(findDoctorCheck(report, 'Reverb ASR files').nextStep)
      .toBe('set HUGGINGFACE_TOKEN, then run bun as setup --step reverb')
    expect(report.nextSteps).toContain('set HUGGINGFACE_TOKEN, then run bun as setup --step reverb')
    expect(report.nextSteps.join('\n')).not.toContain('REDACTED')
  })

  test('doctor next steps preserve discovery order while deduplicating', () => {
    const steps = collectDoctorNextSteps([
      {
        title: 'first',
        checks: [
          { status: 'MISSING', label: 'c', detail: 'c', severity: 'warn', nextStep: 'step c' },
          { status: 'MISSING', label: 'a', detail: 'a', severity: 'warn', nextStep: 'step a' }
        ]
      },
      {
        title: 'second',
        checks: [
          { status: 'MISSING', label: 'duplicate c', detail: 'c', severity: 'warn', nextStep: 'step c' },
          { status: 'INFO', label: 'info', detail: 'i', severity: 'info', nextStep: 'info step' },
          { status: 'MISSING', label: 'b', detail: 'b', severity: 'warn', nextStep: 'step b' }
        ]
      }
    ])

    expect(steps).toEqual(['step c', 'step a', 'step b'])
  })

  test('doctor treats absent optional hosted provider keys as non-warning when unconfigured', async () => {
    const report = await collectDoctorReport(makeDoctorProbes({ env: {} }))

    expect(findDoctorCheck(report, 'TOGETHER_API_KEY (Together STT)').status).toBe('MISSING')
    expect(findDoctorCheck(report, 'TOGETHER_API_KEY (Together STT)').severity).toBe('info')
    expect(findDoctorCheck(report, 'HAPPYSCRIBE_API_KEY (Happy Scribe STT)').severity).toBe('info')
    expect(findDoctorCheck(report, 'SUPADATA_API_KEY (Supadata STT/URL)').severity).toBe('info')
    expect(report.hasWarnings).toBe(false)
  })

  test('doctor warns when a configured local runtime is broken', async () => {
    const config: AutoshowConfig = {
      defaults: {
        post: {
          tts: {
            kittenTts: ['kitten-tts-mini']
          }
        }
      }
    }
    const report = await collectDoctorReport(makeDoctorProbes({
      loadConfig: async () => config,
      run: async (command, args) => {
        if (command.includes('kitten-tts/bin/python') && args.join(' ').includes('kittentts')) {
          return { stdout: '', stderr: 'No module named kittentts', exitCode: 1 }
        }
        if (command === 'tesseract' && args.includes('--list-langs')) return okRun('eng\n')
        if (command === 'ffmpeg' && args.includes('-filters')) return okRun(' ... ass\n')
        return okRun('ok')
      }
    }))
    const kitten = findDoctorCheck(report, 'Kitten TTS Python env')

    expect(kitten.status).toBe('WARN')
    expect(kitten.nextStep).toBe('bun as setup --step tts')
    expect(report.hasWarnings).toBe(true)
  })

  test('doctor accepts either ffmpeg ass support or fallback lyric-video renderer tools', async () => {
    const withAss = await collectDoctorReport(makeDoctorProbes({
      which: (command) => command === 'pango-view' || command === 'convert' ? undefined : `/usr/bin/${command}`,
      run: async (command, args) => {
        if (command === 'tesseract' && args.includes('--list-langs')) return okRun('eng\n')
        if (command === 'ffmpeg' && args.includes('-filters')) return okRun(' ... ass\n')
        return okRun('ok')
      }
    }))
    expect(findDoctorCheck(withAss, 'music lyric-video renderer').status).toBe('OK')
    expect(findDoctorCheck(withAss, 'music lyric-video renderer').detail).toContain('ass filter')

    const withFallback = await collectDoctorReport(makeDoctorProbes({
      run: async (command, args) => {
        if (command === 'tesseract' && args.includes('--list-langs')) return okRun('eng\n')
        if (command === 'ffmpeg' && args.includes('-filters')) return okRun('filters without subtitle renderer\n')
        return okRun('ok')
      }
    }))
    expect(findDoctorCheck(withFallback, 'music lyric-video renderer').status).toBe('OK')
    expect(findDoctorCheck(withFallback, 'music lyric-video renderer').detail).toContain('fallback renderer')
  })

  test('doctor hosted provider map covers supported env vars', () => {
    const envVars = HOSTED_PROVIDER_ENV_CHECKS.map(check => check.envVar)
    expect(envVars).toEqual(expect.arrayContaining([
      'TOGETHER_API_KEY',
      'HAPPYSCRIBE_API_KEY',
      'SUPADATA_API_KEY',
      'SCRAPECREATORS_API_KEY',
      'FIRECRAWL_API_KEY',
      'SPIDER_API_KEY',
      'ZYTE_API_KEY',
      'X_BEARER_TOKEN',
      'HUGGINGFACE_TOKEN'
    ]))
  })
})
