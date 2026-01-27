import { l } from '@/logging'
import { spawnSync, existsSync, execSync, readFileSync, join } from '@/node-utils'

export const checkTtsEnvironment = (): { hasEnv: boolean, pythonPath: string | null } => {
  const configPath = join(process.cwd(), 'build/config', '.tts-config.json')
  const venvPath = join(process.cwd(), 'build/pyenv/tts/bin/python')
  
  if (existsSync(venvPath)) {
    l.dim(`TTS environment found at: ${venvPath}`)
    return { hasEnv: true, pythonPath: venvPath }
  }
  
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf8'))
      if (config.python && existsSync(config.python)) {
        l.dim(`TTS environment found from config: ${config.python}`)
        return { hasEnv: true, pythonPath: config.python }
      }
    } catch {}
  }
  
  l.dim(`TTS environment not found`)
  return { hasEnv: false, pythonPath: null }
}

export const runTtsSetup = (): boolean => {
  l.wait(`TTS environment not found, running automatic setup...`)
  
  const setupScript = join(process.cwd(), '.github/setup/tts/tts-env.sh')
  if (!existsSync(setupScript)) {
    l.dim(`Setup script not found at: ${setupScript}`)
    return false
  }
  
  try {
    execSync(`bash "${setupScript}"`, { 
      stdio: 'inherit',
      cwd: process.cwd()
    })
    
    const venvPath = join(process.cwd(), 'build/pyenv/tts/bin/python')
    if (existsSync(venvPath)) {
      l.success(`TTS environment setup completed successfully`)
      return true
    }
  } catch (error) {
    l.dim(`Setup script failed: ${error}`)
  }
  
  return false
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
  l.wait(`Coqui TTS not installed, running automatic setup...`)
  
  const setupScript = join(process.cwd(), '.github/setup/tts/coqui.sh')
  if (!existsSync(setupScript)) {
    l.dim(`Coqui setup script not found`)
    return false
  }
  
  try {
    execSync(`bash "${setupScript}"`, { 
      stdio: 'inherit',
      cwd: process.cwd()
    })
    l.success(`Coqui TTS setup completed`)
    return true
  } catch (error) {
    l.dim(`Coqui setup failed: ${error}`)
    return false
  }
}

export const runKittenSetup = (): boolean => {
  l.wait(`Kitten TTS not installed, running automatic setup...`)
  
  const setupScript = join(process.cwd(), '.github/setup/tts/kitten.sh')
  if (!existsSync(setupScript)) {
    l.dim(`Kitten setup script not found`)
    return false
  }
  
  try {
    execSync(`bash "${setupScript}"`, { 
      stdio: 'inherit',
      cwd: process.cwd()
    })
    l.success(`Kitten TTS setup completed`)
    return true
  } catch (error) {
    l.dim(`Kitten setup failed: ${error}`)
    return false
  }
}

export const runQwen3Setup = (): boolean => {
  l.wait(`Qwen3 TTS not installed, running automatic setup...`)
  
  const setupScript = join(process.cwd(), '.github/setup/tts/qwen3.sh')
  if (!existsSync(setupScript)) {
    l.dim(`Qwen3 setup script not found`)
    return false
  }
  
  try {
    execSync(`bash "${setupScript}"`, { 
      stdio: 'inherit',
      cwd: process.cwd()
    })
    l.success(`Qwen3 TTS setup completed`)
    return true
  } catch (error) {
    l.dim(`Qwen3 setup failed: ${error}`)
    return false
  }
}

export const runChatterboxSetup = (): boolean => {
  l.wait(`Chatterbox TTS not installed, running automatic setup...`)
  
  const setupScript = join(process.cwd(), '.github/setup/tts/chatterbox.sh')
  if (!existsSync(setupScript)) {
    l.dim(`Chatterbox setup script not found`)
    return false
  }
  
  try {
    execSync(`bash "${setupScript}"`, { 
      stdio: 'inherit',
      cwd: process.cwd()
    })
    l.success(`Chatterbox TTS setup completed`)
    return true
  } catch (error) {
    l.dim(`Chatterbox setup failed: ${error}`)
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
  l.wait(`FishAudio TTS not installed, running automatic setup...`)
  
  const setupScript = join(process.cwd(), '.github/setup/tts/fish-audio.sh')
  if (!existsSync(setupScript)) {
    l.dim(`FishAudio setup script not found`)
    return false
  }
  
  try {
    execSync(`bash "${setupScript}"`, { 
      stdio: 'inherit',
      cwd: process.cwd()
    })
    l.success(`FishAudio TTS setup completed`)
    return true
  } catch (error) {
    l.dim(`FishAudio setup failed: ${error}`)
    return false
  }
}

export const checkCosyVoiceInstalled = (pythonPath: string): boolean => {
  // Check if CosyVoice repo exists and model is loaded
  const cosyvoiceDir = join(process.cwd(), 'build/cosyvoice')
  if (!existsSync(cosyvoiceDir)) {
    return false
  }
  
  // Check if the cosyvoice module can be imported
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
  // Check if CosyVoice Docker API is available
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
  l.wait(`Attempting to start CosyVoice Docker container...`)
  
  try {
    // Check if Docker is available
    const dockerCheck = spawnSync('docker', ['--version'], { encoding: 'utf-8', stdio: 'pipe' })
    if (dockerCheck.status !== 0) {
      l.dim(`Docker not available`)
      return false
    }
    
    // Try to start the container
    execSync(`docker run -d --name cosyvoice-api -p 50000:50000 cosyvoice:latest 2>/dev/null || docker start cosyvoice-api 2>/dev/null`, {
      stdio: 'pipe',
      timeout: 30000
    })
    
    // Wait for API to be ready
    for (let i = 0; i < 30; i++) {
      if (checkCosyVoiceDocker()) {
        l.success(`CosyVoice Docker API started`)
        return true
      }
      execSync('sleep 1')
    }
    
    l.dim(`CosyVoice Docker API did not become ready in time`)
    return false
  } catch (error) {
    l.dim(`Failed to start CosyVoice Docker: ${error}`)
    return false
  }
}

export const runCosyVoiceSetup = (): boolean => {
  l.wait(`CosyVoice not installed, running automatic setup...`)
  
  const setupScript = join(process.cwd(), '.github/setup/tts/cosyvoice.sh')
  if (!existsSync(setupScript)) {
    l.dim(`CosyVoice setup script not found`)
    return false
  }
  
  try {
    execSync(`bash "${setupScript}"`, { 
      stdio: 'inherit',
      cwd: process.cwd()
    })
    l.success(`CosyVoice setup completed`)
    return true
  } catch (error) {
    l.dim(`CosyVoice setup failed: ${error}`)
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
  l.wait(`Installing missing dependencies...`)
  
  const packageJsonPath = join(process.cwd(), 'package.json')
  if (!existsSync(packageJsonPath)) {
    l.dim(`package.json not found`)
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
      l.dim(`${packageName} is not in package.json dependencies`)
      return false
    }
    
    l.dim(`Running bun install to restore ${packageName}`)
    execSync('bun install', {
      stdio: 'inherit',
      cwd: process.cwd()
    })
    
    l.success(`Dependencies restored successfully`)
    return true
  } catch (error) {
    l.dim(`Failed to restore dependencies: ${error}`)
    return false
  }
}
