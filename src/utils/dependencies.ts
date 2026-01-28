import { spawnSync } from 'node:child_process'
import { getCliContext } from './cli-context.ts'

export type DependencyInfo = {
  name: string
  checkCommand?: string[]
  purpose: string
  installInstructions: string
  minVersion?: string
}

export type DependencyCheckResult = {
  available: boolean
  version?: string
  error?: string
}

export const DEPENDENCIES: Record<string, DependencyInfo> = {
  'yt-dlp': {
    name: 'yt-dlp',
    checkCommand: ['yt-dlp', '--version'],
    purpose: 'downloading audio/video from YouTube and other platforms',
    installInstructions: `Install yt-dlp:
  macOS:    brew install yt-dlp
  Linux:    pip install yt-dlp
  Windows:  pip install yt-dlp
  
  Or download from: https://github.com/yt-dlp/yt-dlp/releases`
  },
  'ffmpeg': {
    name: 'ffmpeg',
    checkCommand: ['ffmpeg', '-version'],
    purpose: 'audio/video processing and conversion',
    installInstructions: `Install ffmpeg:
  macOS:    brew install ffmpeg
  Linux:    sudo apt install ffmpeg  (or equivalent for your distro)
  Windows:  Download from https://ffmpeg.org/download.html`
  },
  'whisper': {
    name: 'whisper.cpp',
    checkCommand: ['whisper', '--help'],
    purpose: 'local speech-to-text transcription',
    installInstructions: `Build whisper.cpp from source:
  git clone https://github.com/ggerganov/whisper.cpp
  cd whisper.cpp && make
  
  Or use the setup script: npm run setup:transcription`
  }
}

export function checkDependency(name: string): DependencyCheckResult {
  const dep = DEPENDENCIES[name]
  if (!dep) {
    return {
      available: false,
      error: `Unknown dependency: ${name}`
    }
  }
  
  const cmd = dep.checkCommand || [name, '--version']
  const command = cmd[0]
  if (!command) {
    return {
      available: false,
      error: `Invalid check command for: ${name}`
    }
  }
  
  try {
    const result = spawnSync(command, cmd.slice(1), {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    
    if (result.error) {
      return {
        available: false,
        error: `'${dep.name}' is not installed or not in PATH`
      }
    }
    
    const output = result.stdout || result.stderr || ''
    const versionMatch = output.match(/(\d+\.\d+(?:\.\d+)?)/)?.[1]
    
    return {
      available: result.status === 0 || output.length > 0,
      version: versionMatch
    }
  } catch {
    return {
      available: false,
      error: `Failed to check '${dep.name}'`
    }
  }
}

export function requireDependency(name: string, context?: string): void {
  const result = checkDependency(name)
  
  if (!result.available) {
    const dep = DEPENDENCIES[name]
    const ctx = getCliContext()
    
    const contextMsg = context ? ` ${context}` : ''
    const purposeMsg = dep ? ` (used for ${dep.purpose})` : ''
    
    const lines = [
      `Error: '${name}' is required${contextMsg}${purposeMsg}`,
      '',
    ]
    
    if (dep?.installInstructions) {
      lines.push(dep.installInstructions)
    }
    
    const message = lines.join('\n')
    
    if (ctx.format === 'json') {
      console.log(JSON.stringify({
        success: false,
        error: `Missing dependency: ${name}`,
        details: dep?.installInstructions
      }, null, 2))
    } else if (!ctx.noColor) {
      console.error(`\x1b[31m${message}\x1b[0m`)
    } else {
      console.error(message)
    }
    
    process.exit(1)
  }
}

export function checkDependencies(names: string[]): Record<string, DependencyCheckResult> {
  const results: Record<string, DependencyCheckResult> = {}
  for (const name of names) {
    results[name] = checkDependency(name)
  }
  return results
}

export function listDependencyStatus(): void {
  const ctx = getCliContext()
  
  const results = checkDependencies(Object.keys(DEPENDENCIES))
  
  if (ctx.format === 'json') {
    const data = Object.entries(results).map(([name, result]) => ({
      name,
      available: result.available,
      version: result.version,
      purpose: DEPENDENCIES[name]?.purpose
    }))
    console.log(JSON.stringify({
      success: true,
      command: 'check dependencies',
      data: { dependencies: data }
    }, null, 2))
    return
  }
  
  console.log('External dependency status:\n')
  
  for (const [name, result] of Object.entries(results)) {
    const dep = DEPENDENCIES[name]
    const status = result.available 
      ? (ctx.noColor ? '[OK]' : '\x1b[32m[OK]\x1b[0m')
      : (ctx.noColor ? '[MISSING]' : '\x1b[31m[MISSING]\x1b[0m')
    const version = result.version ? ` (v${result.version})` : ''
    
    console.log(`  ${status} ${name}${version}`)
    if (dep) {
      console.log(`       Used for: ${dep.purpose}`)
    }
    if (!result.available && dep?.installInstructions) {
      const firstLine = dep.installInstructions.split('\n')[0]
      console.log(`       ${firstLine}`)
    }
    console.log()
  }
}
