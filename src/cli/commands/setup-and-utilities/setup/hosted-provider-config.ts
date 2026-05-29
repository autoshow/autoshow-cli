import { createHumanTable } from '~/utils/logger/human-table'
import type { AutoshowConfig, HumanLogTable, TableLogger } from '~/types'

export type HostedProviderStatus = 'configured' | 'missing'

type HostedProviderEnvCheck = {
  envVar: string
  label: string
  configPaths: readonly string[]
}

type HostedProviderConfigurationRow = {
  provider: string
  status: HostedProviderStatus
  envKey: string
  detail: string
}

export type HostedProviderConfigurationSummary = {
  configured: number
  missing: number
  total: number
}

type HostedProviderConfigurationLogMode = 'all' | 'missing'

export const HOSTED_PROVIDER_ENV_CHECKS = [
  {
    envVar: 'OPENAI_API_KEY',
    label: 'OpenAI write/STT/OCR/TTS/image',
    configPaths: [
      'defaults.llm.openai',
      'defaults.extract.stt.openaiStt',
      'defaults.extract.ocr.openaiOcr',
      'defaults.post.tts.openaiTts',
      'defaults.post.image.openaiImage'
    ]
  },
  {
    envVar: 'XAI_API_KEY',
    label: 'Grok write/STT/OCR/TTS/image/video',
    configPaths: [
      'defaults.llm.grok',
      'defaults.extract.stt.grokStt',
      'defaults.extract.ocr.grokOcr',
      'defaults.post.tts.grokTts',
      'defaults.post.image.grokImage',
      'defaults.post.video.grokVideo'
    ]
  },
  {
    envVar: 'GEMINI_API_KEY',
    label: 'Gemini write/STT/OCR/TTS/image/video/music',
    configPaths: [
      'defaults.llm.gemini',
      'defaults.extract.stt.geminiStt',
      'defaults.extract.ocr.geminiOcr',
      'defaults.post.tts.geminiTts',
      'defaults.post.image.geminiImage',
      'defaults.post.video.geminiVideo',
      'defaults.post.music.geminiMusic'
    ]
  },
  {
    envVar: 'GLM_API_KEY',
    label: 'GLM write/STT/OCR/video',
    configPaths: [
      'defaults.llm.glm',
      'defaults.extract.stt.glmStt',
      'defaults.extract.ocr.glmOcr',
      'defaults.post.video.glmVideo'
    ]
  },
  {
    envVar: 'KIMI_API_KEY',
    label: 'Kimi write/OCR',
    configPaths: ['defaults.llm.kimi', 'defaults.extract.ocr.kimiOcr']
  },
  {
    envVar: 'RUNWAYML_API_SECRET',
    label: 'Runway video',
    configPaths: ['defaults.post.video.runwayVideo']
  },
  {
    envVar: 'MISTRAL_API_KEY',
    label: 'Mistral STT/OCR/TTS',
    configPaths: [
      'defaults.extract.stt.mistralStt',
      'defaults.extract.ocr.mistralOcr',
      'defaults.post.tts.mistralTts'
    ]
  },
  {
    envVar: 'UNSTRUCTURED_API_KEY',
    label: 'Unstructured OCR',
    configPaths: ['defaults.extract.ocr.unstructuredOcr']
  },
  {
    envVar: 'BFL_API_KEY',
    label: 'BFL image',
    configPaths: ['defaults.post.image.bflImage']
  },
  {
    envVar: 'REVE_API_KEY',
    label: 'Reve image',
    configPaths: ['defaults.post.image.reveImage']
  },
  {
    envVar: 'ANTHROPIC_API_KEY',
    label: 'Anthropic write/OCR',
    configPaths: ['defaults.llm.anthropic', 'defaults.extract.ocr.anthropicOcr']
  },
  {
    envVar: 'GROQ_API_KEY',
    label: 'Groq write/STT/TTS',
    configPaths: [
      'defaults.llm.groq',
      'defaults.extract.stt.groqStt',
      'defaults.post.tts.groqTts'
    ]
  },
  {
    envVar: 'DEEPINFRA_API_KEY',
    label: 'DeepInfra STT/OCR',
    configPaths: ['defaults.extract.stt.deepinfraStt', 'defaults.extract.ocr.deepinfraOcr']
  },
  {
    envVar: 'MINIMAX_API_KEY',
    label: 'MiniMax write/TTS/video/music',
    configPaths: [
      'defaults.llm.minimax',
      'defaults.post.tts.minimaxTts',
      'defaults.post.video.minimaxVideo',
      'defaults.post.music.minimaxMusic'
    ]
  },
  {
    envVar: 'ELEVENLABS_API_KEY',
    label: 'ElevenLabs STT/TTS/music',
    configPaths: [
      'defaults.extract.stt.elevenlabsStt',
      'defaults.post.tts.elevenlabsTts',
      'defaults.post.music.elevenlabsMusic'
    ]
  },
  {
    envVar: 'ASSEMBLYAI_API_KEY',
    label: 'AssemblyAI STT',
    configPaths: ['defaults.extract.stt.assemblyaiStt']
  },
  {
    envVar: 'GLADIA_API_KEY',
    label: 'Gladia STT',
    configPaths: ['defaults.extract.stt.gladiaStt']
  },
  {
    envVar: 'DEEPGRAM_API_KEY',
    label: 'Deepgram STT/TTS',
    configPaths: ['defaults.extract.stt.deepgramStt', 'defaults.post.tts.deepgramTts']
  },
  {
    envVar: 'SPEECHIFY_API_KEY',
    label: 'Speechify TTS',
    configPaths: ['defaults.post.tts.speechifyTts']
  },
  {
    envVar: 'HUME_API_KEY',
    label: 'Hume TTS',
    configPaths: ['defaults.post.tts.humeTts']
  },
  {
    envVar: 'CARTESIA_API_KEY',
    label: 'Cartesia TTS',
    configPaths: ['defaults.post.tts.cartesiaTts']
  },
  {
    envVar: 'SONIOX_API_KEY',
    label: 'Soniox STT',
    configPaths: ['defaults.extract.stt.sonioxStt']
  },
  {
    envVar: 'SPEECHMATICS_API_KEY',
    label: 'Speechmatics STT',
    configPaths: ['defaults.extract.stt.speechmaticsStt']
  },
  {
    envVar: 'REVAI_ACCESS_TOKEN',
    label: 'Rev STT',
    configPaths: ['defaults.extract.stt.revStt']
  },
  {
    envVar: 'TOGETHER_API_KEY',
    label: 'Together STT',
    configPaths: ['defaults.extract.stt.togetherStt']
  },
  {
    envVar: 'HAPPYSCRIBE_API_KEY',
    label: 'Happy Scribe STT',
    configPaths: ['defaults.extract.stt.happyscribeStt']
  },
  {
    envVar: 'SUPADATA_API_KEY',
    label: 'Supadata STT/URL',
    configPaths: ['defaults.extract.stt.supadataStt']
  },
  {
    envVar: 'SCRAPECREATORS_API_KEY',
    label: 'ScrapeCreators STT',
    configPaths: ['defaults.extract.stt.scrapecreatorsStt']
  },
  {
    envVar: 'FIRECRAWL_API_KEY',
    label: 'Firecrawl URL',
    configPaths: []
  },
  {
    envVar: 'SPIDER_API_KEY',
    label: 'Spider URL',
    configPaths: []
  },
  {
    envVar: 'ZYTE_API_KEY',
    label: 'Zyte URL',
    configPaths: []
  },
  {
    envVar: 'X_BEARER_TOKEN',
    label: 'X Spaces download',
    configPaths: []
  },
  {
    envVar: 'HUGGINGFACE_TOKEN',
    label: 'Hugging Face Reverb assets',
    configPaths: ['defaults.extract.stt.reverb']
  }
] as const satisfies readonly HostedProviderEnvCheck[]

const configuredEnv = (env: Record<string, string | undefined>, envVar: string): boolean => {
  const value = env[envVar]
  return typeof value === 'string' && value.trim().length > 0
}

const getConfigPathValue = (config: AutoshowConfig | undefined, path: string): unknown => {
  if (!config) return undefined
  return path.split('.').reduce<unknown>((value, segment) => {
    if (!value || typeof value !== 'object') return undefined
    return (value as Record<string, unknown>)[segment]
  }, config)
}

const isConfiguredValue = (value: unknown): boolean => {
  if (value === true) return true
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return false
}

export const getHostedProviderConfiguredPaths = (
  config: AutoshowConfig | undefined,
  paths: readonly string[]
): string[] => paths.filter(path => isConfiguredValue(getConfigPathValue(config, path)))

const resolveHostedProviderChecks = (
  envVars?: readonly string[]
): HostedProviderEnvCheck[] => {
  if (!envVars) {
    return [...HOSTED_PROVIDER_ENV_CHECKS]
  }
  const selected = new Set(envVars)
  return HOSTED_PROVIDER_ENV_CHECKS.filter(check => selected.has(check.envVar))
}

export const buildHostedProviderConfigurationRows = (
  env: Record<string, string | undefined>,
  options: {
    envVars?: readonly string[]
    config?: AutoshowConfig | undefined
  } = {}
): HostedProviderConfigurationRow[] =>
  resolveHostedProviderChecks(options.envVars).map((provider) => {
    const status: HostedProviderStatus = configuredEnv(env, provider.envVar) ? 'configured' : 'missing'
    const configuredPaths = getHostedProviderConfiguredPaths(options.config, provider.configPaths)
    const detail = status === 'configured'
      ? 'set'
      : configuredPaths.length > 0
        ? `not set; configured in ${configuredPaths.join(', ')}`
        : `set ${provider.envVar} to enable`

    return {
      provider: provider.label,
      status,
      envKey: provider.envVar,
      detail
    }
  })

export const summarizeHostedProviderRows = (
  rows: readonly HostedProviderConfigurationRow[]
): HostedProviderConfigurationSummary => {
  const configured = rows.filter(row => row.status === 'configured').length
  return {
    configured,
    missing: rows.length - configured,
    total: rows.length
  }
}

export const buildHostedProviderConfigurationTable = (
  rows: readonly HostedProviderConfigurationRow[]
): HumanLogTable =>
  createHumanTable(rows, ['provider', 'status', 'envKey', 'detail'])

export const buildHostedProviderConfigurationSummaryTable = (
  summary: HostedProviderConfigurationSummary
): HumanLogTable =>
  createHumanTable([{
    configured: `${summary.configured}/${summary.total}`,
    missing: summary.missing,
    detail: summary.missing === 0 ? 'all env vars set' : `${summary.missing} missing`
  }], ['configured', 'missing', 'detail'])

export const buildHostedProviderConfigurationLogTable = (
  rows: readonly HostedProviderConfigurationRow[],
  options: {
    mode?: HostedProviderConfigurationLogMode | undefined
  } = {}
): HumanLogTable => {
  const mode = options.mode ?? 'all'
  if (mode === 'all') {
    return buildHostedProviderConfigurationTable(rows)
  }

  const summary = summarizeHostedProviderRows(rows)
  if (summary.missing === 0) {
    return buildHostedProviderConfigurationSummaryTable(summary)
  }

  const table = buildHostedProviderConfigurationTable(rows.filter(row => row.status === 'missing'))
  return {
    ...table,
    details: [
      ...(table.details ?? []),
      { label: 'configured', value: `${summary.configured}/${summary.total}` }
    ]
  }
}

export const logHostedProviderConfiguration = (
  logger: TableLogger,
  options: {
    env?: Record<string, string | undefined>
    envVars?: readonly string[]
    config?: AutoshowConfig | undefined
    title?: string
    mode?: HostedProviderConfigurationLogMode
  } = {}
): HostedProviderConfigurationSummary => {
  const rows = buildHostedProviderConfigurationRows(options.env ?? process.env as Record<string, string | undefined>, {
    ...(options.envVars ? { envVars: options.envVars } : {}),
    ...(options.config ? { config: options.config } : {})
  })
  const summary = summarizeHostedProviderRows(rows)

  logger.write('info', options.title ?? 'Hosted Provider Configuration', {
    category: 'command',
    humanTable: buildHostedProviderConfigurationLogTable(
      rows,
      options.mode === undefined ? {} : { mode: options.mode }
    ),
    metadata: {
      configured: summary.configured,
      missing: summary.missing,
      total: summary.total,
      mode: options.mode ?? 'all',
      providers: rows
    }
  })

  return summary
}
