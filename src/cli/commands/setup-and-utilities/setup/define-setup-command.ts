import { defineCliCommand } from '~/cli/native'
import { setupFlags } from '~/cli/flags'
import { CLIUsageError } from '~/utils/error-handler'
import { runCompleteSetup, runSetupStep } from './run-complete-setup'
import { runDoctor } from './run-doctor'
import { runModelDownloads } from '~/cli/commands/setup-and-utilities/models/run-model-downloads'
import * as l from '~/utils/logger'
import { runWithLogContext } from '~/utils/logger'
import type { SetupStepId } from '~/types'

const VALID_SETUP_STEPS: SetupStepId[] = ['uv', 'yt-dlp', 'defuddle', 'whisper-binary', 'whisper-model', 'llama-binary', 'reverb', 'calibre', 'all', 'transcription', 'write', 'tts', 'image', 'video', 'music']
const FOCUSED_SETUP_CONFLICT_FLAGS = [
  '--models',
  '--doctor',
  '--step',
  '--force-redownload',
  '--repeat'
] as const

const hasLongFlag = (argv: string[], flag: string): boolean =>
  argv.some((token) => token === flag || token.startsWith(`${flag}=`))

const getUsedLongFlags = (argv: string[], flags: readonly string[]): string[] =>
  flags.filter((flag) => hasLongFlag(argv, flag))

const normalizeStringArrayFlag = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? [trimmed] : []
  }
  return []
}

export const setupCommand = defineCliCommand({
  name: 'setup',
  description: 'Install local dependencies and required tools',
  flags: setupFlags,
  help: {
    examples: [
      ['bun as setup', 'Install all dependencies'],
      ['bun as setup --models base --models ggml-org/gemma-3-270m-it-GGUF', 'Download Whisper and llama.cpp models without running inference'],
      ['bun as setup --doctor', 'Check prerequisites without installing'],
      ['bun as setup --step defuddle', 'Install the managed Defuddle CLI'],
      ['bun as setup --step whisper-binary --force-redownload', 'Reinstall whisper binary']
    ]
  }
}, async (ctx) => {
  const rawArgv = Bun.argv.slice(2)
  const usedModelsFlag = hasLongFlag(rawArgv, '--models')
  const modelTargets = normalizeStringArrayFlag(ctx.flags.models)

  if (usedModelsFlag && modelTargets.length === 0) {
    throw CLIUsageError('--models requires at least one value')
  }
  if (usedModelsFlag) {
    const modeFlag = '--models'
    const conflicts = getUsedLongFlags(
      rawArgv,
      FOCUSED_SETUP_CONFLICT_FLAGS.filter((flag) => flag !== modeFlag)
    )
    if (conflicts.length > 0) {
      throw CLIUsageError(`${modeFlag} cannot be combined with ${conflicts.join(', ')}`)
    }
  }

  if (usedModelsFlag) {
    await runWithLogContext({ step: 'setup' }, async () => {
      await runModelDownloads(modelTargets)
    })
    return
  }

  if (ctx.flags.doctor) {
    await runDoctor()
    return
  }

  const step = ctx.flags.step as string
  if (!VALID_SETUP_STEPS.includes(step as SetupStepId)) {
    throw CLIUsageError(`Invalid --step value: ${step}. Valid values: ${VALID_SETUP_STEPS.join(', ')}`)
  }

  const repeatRaw = parseInt(ctx.flags.repeat as string, 10)
  if (!Number.isFinite(repeatRaw) || repeatRaw < 1) {
    throw CLIUsageError(`Invalid --repeat value: ${ctx.flags.repeat}. Must be an integer >= 1`)
  }

  await runWithLogContext({ step: 'setup' }, async () => {
    if (step === 'all' && !ctx.flags['force-redownload'] && repeatRaw === 1) {
      await runCompleteSetup()
    } else {
      await runSetupStep(step as SetupStepId, {
        ...(ctx.flags['force-redownload'] ? { forceRedownload: true } : {}),
        ...(repeatRaw > 1 ? { repeat: repeatRaw } : {})
      })
    }
  })

  l.write('success', 'Setup complete')
})
