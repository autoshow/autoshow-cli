import { l } from '@/logging'
import { spawnSync, existsSync, path, execSync, readFileSync } from '@/node-utils'

const p = '[tts/tts-utils/setup-utils]'

export const checkTtsEnvironment = (): { hasEnv: boolean, pythonPath: string | null } => {
  const configPath = path.join(process.cwd(), 'build/config', '.tts-config.json')
  const venvPath = path.join(process.cwd(), 'build/pyenv/tts/bin/python')
  
  if (existsSync(venvPath)) {
    l.dim(`${p} TTS environment found at: ${venvPath}`)
    return { hasEnv: true, pythonPath: venvPath }
  }
  
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf8'))
      if (config.python && existsSync(config.python)) {
        l.dim(`${p} TTS environment found from config: ${config.python}`)
        return { hasEnv: true, pythonPath: config.python }
      }
    } catch {}
  }
  
  l.dim(`${p} TTS environment not found`)
  return { hasEnv: false, pythonPath: null }
}

export const runTtsSetup = (): boolean => {
  l.wait(`${p} TTS environment not found, running automatic setup...`)
  
  const setupScript = path.join(process.cwd(), '.github/setup/tts/tts-env.sh')
  if (!existsSync(setupScript)) {
    l.dim(`${p} Setup script not found at: ${setupScript}`)
    return false
  }
  
  try {
    execSync(`bash "${setupScript}"`, { 
      stdio: 'inherit',
      cwd: process.cwd()
    })
    
    const venvPath = path.join(process.cwd(), 'build/pyenv/tts/bin/python')
    if (existsSync(venvPath)) {
      l.success(`${p} TTS environment setup completed successfully`)
      return true
    }
  } catch (error) {
    l.dim(`${p} Setup script failed: ${error}`)
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
    throw new Error('TTS environment setup failed. Please run: npm run setup:tts')
  }
  
  const venvPath = path.join(process.cwd(), 'build/pyenv/tts/bin/python')
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

export const runCoquiSetup = (): boolean => {
  l.wait(`${p} Coqui TTS not installed, running automatic setup...`)
  
  const setupScript = path.join(process.cwd(), '.github/setup/tts/coqui.sh')
  if (!existsSync(setupScript)) {
    l.dim(`${p} Coqui setup script not found`)
    return false
  }
  
  try {
    execSync(`bash "${setupScript}"`, { 
      stdio: 'inherit',
      cwd: process.cwd()
    })
    l.success(`${p} Coqui TTS setup completed`)
    return true
  } catch (error) {
    l.dim(`${p} Coqui setup failed: ${error}`)
    return false
  }
}

export const runKittenSetup = (): boolean => {
  l.wait(`${p} Kitten TTS not installed, running automatic setup...`)
  
  const setupScript = path.join(process.cwd(), '.github/setup/tts/kitten.sh')
  if (!existsSync(setupScript)) {
    l.dim(`${p} Kitten setup script not found`)
    return false
  }
  
  try {
    execSync(`bash "${setupScript}"`, { 
      stdio: 'inherit',
      cwd: process.cwd()
    })
    l.success(`${p} Kitten TTS setup completed`)
    return true
  } catch (error) {
    l.dim(`${p} Kitten setup failed: ${error}`)
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
  l.wait(`${p} Installing missing dependencies...`)
  
  const packageJsonPath = path.join(process.cwd(), 'package.json')
  if (!existsSync(packageJsonPath)) {
    l.dim(`${p} package.json not found`)
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
      l.dim(`${p} ${packageName} is not in package.json dependencies`)
      return false
    }
    
    l.dim(`${p} Running npm install to restore ${packageName}`)
    execSync('npm install', {
      stdio: 'inherit',
      cwd: process.cwd()
    })
    
    l.success(`${p} Dependencies restored successfully`)
    return true
  } catch (error) {
    l.dim(`${p} Failed to restore dependencies: ${error}`)
    return false
  }
}