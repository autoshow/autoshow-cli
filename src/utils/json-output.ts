import { getCliContext } from './cli-context.ts'

export type JsonOutputBase = {
  success: boolean
  command: string
  timestamp: string
  duration?: number
  error?: string
}

export type TextJsonOutput = JsonOutputBase & {
  command: 'text'
  data?: {
    inputType: string
    inputPath: string
    outputPath?: string
    transcriptPath?: string
    transcriptionService?: string
    transcriptionModel?: string
    llmService?: string
    llmModel?: string
    audioDuration?: number
  }
}

export type TtsJsonOutput = JsonOutputBase & {
  command: 'tts'
  data?: {
    inputPath: string
    outputPath: string
    service: string
    model?: string
    duration?: number
  }
}

export type ImageJsonOutput = JsonOutputBase & {
  command: 'image'
  data?: {
    prompt: string
    outputPath: string
    service: string
    model?: string
    width?: number
    height?: number
  }
}

export type VideoJsonOutput = JsonOutputBase & {
  command: 'video'
  data?: {
    prompt: string
    outputPath: string
    service: string
    model?: string
    duration?: number
  }
}

export type MusicJsonOutput = JsonOutputBase & {
  command: 'music'
  data?: {
    prompt?: string
    outputPath: string
    service: string
    model?: string
    duration?: number
    format?: string
  }
}

export type MediaJsonOutput = JsonOutputBase & {
  command: 'media'
  data?: {
    inputPath: string
    outputPaths: string[]
    operation: string
  }
}

export type ExtractJsonOutput = JsonOutputBase & {
  command: 'extract'
  data?: {
    inputPath: string
    outputPath: string
    service: string
    pageCount?: number
  }
}

export type JsonOutput = 
  | TextJsonOutput 
  | TtsJsonOutput 
  | ImageJsonOutput 
  | VideoJsonOutput 
  | MusicJsonOutput 
  | MediaJsonOutput 
  | ExtractJsonOutput

export type JsonOutputBuilder<T extends JsonOutput = JsonOutput> = {
  startTime: number
  output: Partial<T>
}

export function createJsonOutput<T extends JsonOutput>(command: T['command']): JsonOutputBuilder<T> {
  return {
    startTime: Date.now(),
    output: {
      success: true,
      command,
      timestamp: new Date().toISOString()
    } as Partial<T>
  }
}

export function setJsonError<T extends JsonOutput>(
  builder: JsonOutputBuilder<T>, 
  error: string | Error
): void {
  builder.output.success = false
  builder.output.error = typeof error === 'string' ? error : error.message
}

export function outputJson<T extends JsonOutput>(builder: JsonOutputBuilder<T>): boolean {
  const ctx = getCliContext()
  
  if (ctx.format !== 'json') {
    return false
  }
  
  const finalOutput: JsonOutput = {
    ...builder.output,
    duration: Date.now() - builder.startTime
  } as JsonOutput
  
  console.log(JSON.stringify(finalOutput, null, 2))
  return true
}

export function isJsonMode(): boolean {
  return getCliContext().format === 'json'
}
