import { l, success } from '@/logging'
import { spawnSync, existsSync, execSync, readFileSync, join } from '@/node-utils'

export const checkTtsEnvironment = (): { hasEnv: boolean, pythonPath: string | null } => {
  const configPath = join(process.cwd(), 'build/config', '.tts-config.json')
  const venvPath = join(process.cwd(), 'build/pyenv/tts/bin/python')
  
  if (existsSync(venvPath)) {
    l('TTS environment found', { pythonPath: venvPath })
    return { hasEnv: true, pythonPath: venvPath }
  }
  
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf8'))
      if (config.python && existsSync(config.python)) {
        l('TTS environment found from config', { pythonPath: config.python })
        return { hasEnv: true, pythonPath: config.python }
      }
    } catch {}
  }
  
  l('TTS environment not found')
  return { hasEnv: false, pythonPath: null }
}

export const runTtsSetup = (): boolean => {
  l('TTS environment not found, running automatic setup')
  
  const setupScript = join(process.cwd(), '.github/setup/tts/tts-env.sh')
  if (!existsSync(setupScript)) {
    l('Setup script not found', { scriptPath: setupScript })
    return false
  }
  
  try {
    execSync(`bash "${setupScript}"`, { 
      stdio: 'inherit',
      cwd: process.cwd()
    })
    
    const venvPath = join(process.cwd(), 'build/pyenv/tts/bin/python')
    if (existsSync(venvPath)) {
      success('TTS environment setup completed successfully')
      return true
    } else {
      l('Setup script completed but Python venv not found', { expectedPath: venvPath })
      return false
    }
  } catch (error) {
    const execError = error as { status?: number; stderr?: Buffer | string; stdout?: Buffer | string; message?: string }
    l('Setup script failed', { 
      error: execError.message || error,
      status: execError.status,
      scriptPath: setupScript 
    })
    return false
  }
}

export const ensureTtsEnvironment = (): string => {
  const { hasEnv, pythonPath } = checkTtsEnvironment()
  
  if (hasEnv && pythonPath) {
    return pythonPath
  }
  
  const setupSuccessful = runTtsSetup()
  if (!setupSuccessful) {
    throw new Error('TTS environment setup failed. Please run: bun setup:tts')
  }
  
  const venvPath = join(process.cwd(), 'build/pyenv/tts/bin/python')
  if (!existsSync(venvPath)) {
    throw new Error('TTS environment not found after setup')
  }
  
  return venvPath
}

export const checkCoquiInstalled = (pythonPath: string): boolean => {
  const result = spawnSync(pythonPath, ['-c', 'import TTS'], { 
    encoding: 'utf-8', 
    stdio: 'pipe' 
  })
  return result.status === 0
}

export const checkKittenInstalled = (pythonPath: string): boolean => {
  const result = spawnSync(pythonPath, ['-c', 'import kittentts'], { 
    encoding: 'utf-8', 
    stdio: 'pipe' 
  })
  return result.status === 0
}

export const checkQwen3Installed = (pythonPath: string): boolean => {
  const result = spawnSync(pythonPath, ['-c', 'import qwen_tts'], { 
    encoding: 'utf-8', 
    stdio: 'pipe' 
  })
  return result.status === 0
}

export const checkChatterboxInstalled = (pythonPath: string): boolean => {
  const result = spawnSync(pythonPath, ['-c', 'import chatterbox'], { 
    encoding: 'utf-8', 
    stdio: 'pipe' 
  })
  return result.status === 0
}

export const runCoquiSetup = (): boolean => {
  l('Coqui TTS not installed, running automatic setup')
  
  const setupScript = join(process.cwd(), '.github/setup/tts/coqui.sh')
  if (!existsSync(setupScript)) {
    l('Coqui setup script not found', { expectedPath: setupScript })
    return false
  }
  
  try {
    execSync(`bash "${setupScript}"`, { 
      stdio: 'inherit',
      cwd: process.cwd()
    })
    success('Coqui TTS setup completed')
    return true
  } catch (error) {
    const execError = error as { status?: number; message?: string }
    l('Coqui setup failed', { 
      error: execError.message || error,
      status: execError.status,
      scriptPath: setupScript,
      hint: 'Check if bash is available and script has execute permissions'
    })
    return false
  }
}

export const runKittenSetup = (): boolean => {
  l('Kitten TTS not installed, running automatic setup')
  
  const setupScript = join(process.cwd(), '.github/setup/tts/kitten.sh')
  if (!existsSync(setupScript)) {
    l('Kitten setup script not found', { expectedPath: setupScript })
    return false
  }
  
  try {
    execSync(`bash "${setupScript}"`, { 
      stdio: 'inherit',
      cwd: process.cwd()
    })
    success('Kitten TTS setup completed')
    return true
  } catch (error) {
    const execError = error as { status?: number; message?: string }
    l('Kitten setup failed', { 
      error: execError.message || error,
      status: execError.status,
      scriptPath: setupScript
    })
    return false
  }
}

export const runQwen3Setup = (): boolean => {
  l('Qwen3 TTS not installed, running automatic setup')
  
  const setupScript = join(process.cwd(), '.github/setup/tts/qwen3.sh')
  if (!existsSync(setupScript)) {
    l('Qwen3 setup script not found', { expectedPath: setupScript })
    return false
  }
  
  try {
    execSync(`bash "${setupScript}"`, { 
      stdio: 'inherit',
      cwd: process.cwd()
    })
    success('Qwen3 TTS setup completed')
    return true
  } catch (error) {
    const execError = error as { status?: number; message?: string }
    l('Qwen3 setup failed', { 
      error: execError.message || error,
      status: execError.status,
      scriptPath: setupScript
    })
    return false
  }
}

export const runChatterboxSetup = (): boolean => {
  l('Chatterbox TTS not installed, running automatic setup')
  
  const setupScript = join(process.cwd(), '.github/setup/tts/chatterbox.sh')
  if (!existsSync(setupScript)) {
    l('Chatterbox setup script not found', { expectedPath: setupScript })
    return false
  }
  
  try {
    execSync(`bash "${setupScript}"`, { 
      stdio: 'inherit',
      cwd: process.cwd()
    })
    success('Chatterbox TTS setup completed')
    return true
  } catch (error) {
    const execError = error as { status?: number; message?: string }
    l('Chatterbox setup failed', { 
      error: execError.message || error,
      status: execError.status,
      scriptPath: setupScript
    })
    return false
  }
}

export const checkFishAudioInstalled = (pythonPath: string): boolean => {
  const result = spawnSync(pythonPath, ['-c', 'import requests; import torch'], { 
    encoding: 'utf-8', 
    stdio: 'pipe' 
  })
  return result.status === 0
}

export const runFishAudioSetup = (): boolean => {
  l('FishAudio TTS not installed, running automatic setup')
  
  const setupScript = join(process.cwd(), '.github/setup/tts/fish-audio.sh')
  if (!existsSync(setupScript)) {
    l('FishAudio setup script not found')
    return false
  }
  
  try {
    execSync(`bash "${setupScript}"`, { 
      stdio: 'inherit',
      cwd: process.cwd()
    })
    success('FishAudio TTS setup completed')
    return true
  } catch (error) {
    l('FishAudio setup failed', { error })
    return false
  }
}

export const checkCosyVoiceInstalled = (pythonPath: string): boolean => {
  
  const cosyvoiceDir = join(process.cwd(), 'build/cosyvoice')
  if (!existsSync(cosyvoiceDir)) {
    return false
  }
  
  
  const result = spawnSync(pythonPath, ['-c', `
import sys
sys.path.insert(0, '${cosyvoiceDir}')
sys.path.insert(0, '${cosyvoiceDir}/third_party/Matcha-TTS')
from cosyvoice.cli.cosyvoice import AutoModel
print('ok')
`], { 
    encoding: 'utf-8', 
    stdio: 'pipe' 
  })
  return result.status === 0 && (result.stdout || '').includes('ok')
}

export const checkCosyVoiceDocker = (): boolean => {
  
  try {
    const result = execSync('curl -s -o /dev/null -w "%{http_code}" http://localhost:50000/health 2>/dev/null || echo "000"', {
      encoding: 'utf-8',
      timeout: 3000
    })
    return result.trim() === '200'
  } catch {
    return false
  }
}

export const startCosyVoiceDocker = (): boolean => {
  l('Attempting to start CosyVoice Docker container')
  
  try {
    
    const dockerCheck = spawnSync('docker', ['--version'], { encoding: 'utf-8', stdio: 'pipe' })
    if (dockerCheck.status !== 0) {
      l('Docker not available')
      return false
    }
    
    
    execSync(`docker run -d --name cosyvoice-api -p 50000:50000 cosyvoice:latest 2>/dev/null || docker start cosyvoice-api 2>/dev/null`, {
      stdio: 'pipe',
      timeout: 30000
    })
    
    
    for (let i = 0; i < 30; i++) {
      if (checkCosyVoiceDocker()) {
        success('CosyVoice Docker API started')
        return true
      }
      execSync('sleep 1')
    }
    
    l('CosyVoice Docker API did not become ready in time')
    return false
  } catch (error) {
    l('Failed to start CosyVoice Docker', { error })
    return false
  }
}

export const runCosyVoiceSetup = (): boolean => {
  l('CosyVoice not installed, running automatic setup')
  
  const setupScript = join(process.cwd(), '.github/setup/tts/cosyvoice.sh')
  if (!existsSync(setupScript)) {
    l('CosyVoice setup script not found')
    return false
  }
  
  try {
    execSync(`bash "${setupScript}"`, { 
      stdio: 'inherit',
      cwd: process.cwd()
    })
    success('CosyVoice setup completed')
    return true
  } catch (error) {
    l('CosyVoice setup failed', { error })
    return false
  }
}

export const checkElevenLabsInstalled = (): boolean => {
  try {
    require.resolve('elevenlabs')
    return true
  } catch {
    return false
  }
}

export const checkPollyInstalled = (): boolean => {
  try {
    require.resolve('@aws-sdk/client-polly')
    return true
  } catch {
    return false
  }
}

export const installNpmPackage = (packageName: string): boolean => {
  l('Installing missing dependencies')
  
  const packageJsonPath = join(process.cwd(), 'package.json')
  if (!existsSync(packageJsonPath)) {
    l('package.json not found')
    return false
  }
  
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.peerDependencies,
      ...packageJson.optionalDependencies
    }
    
    if (!allDeps[packageName]) {
      l('Package not in package.json dependencies', { packageName })
      return false
    }
    
    l('Running bun install to restore package', { packageName })
    execSync('bun install', {
      stdio: 'inherit',
      cwd: process.cwd()
    })
    
    success('Dependencies restored successfully')
    return true
  } catch (error) {
    l('Failed to restore dependencies', { error })
    return false
  }
}
