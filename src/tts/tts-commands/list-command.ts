import { readFileSync } from 'node:fs'
import { l, err } from '@/logging'
import { spawnSync, existsSync, join, dirname } from '@/node-utils'

export const listModels = async (): Promise<void> => {
  const configPath = join(process.cwd(), 'build/config', '.tts-config.json')
  l('Loading config from path', { configPath })
  
  let config: any = {}
  try {
    config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : {}
  } catch (parseError) {
    l('Failed to parse TTS config, using defaults', { configPath, error: parseError })
  }
  
  const pythonPath = config.python || process.env['TTS_PYTHON_PATH'] || process.env['COQUI_PYTHON_PATH'] || 
    (existsSync(join(process.cwd(), 'build/pyenv/tts/bin/python')) ? join(process.cwd(), 'build/pyenv/tts/bin/python') : 'python3')
  
  l('Using Python path', { pythonPath })
  
  const pythonScriptPath = join(dirname(import.meta.url.replace('file://', '')), '../tts-local/coqui-list.py')
  
  l(`Listing available TTS models`)
  
  const result = spawnSync(pythonPath, [pythonScriptPath], { 
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONWARNINGS: 'ignore', TF_CPP_MIN_LOG_LEVEL: '3' }
  })
  
  if (result.error) {
    const errorWithCode = result.error as NodeJS.ErrnoException
    if (errorWithCode.code === 'ENOENT') {
      err(`Python not found at: ${pythonPath}

SOLUTION:
  1. Run setup: bun setup:tts
  2. Or install Python 3.11+ and set TTS_PYTHON_PATH environment variable`)
    } else {
      l('Python execution error', { error: result.error, pythonPath })
      err('Failed to execute Python script', { errorCode: errorWithCode.code, message: result.error.message })
    }
  }
  
  if (result.status !== 0) {
    const stderr = result.stderr || ''
    l('Python script failed', { status: result.status, stderr, stdout: result.stdout || '' })
    
    if (stderr.includes('ModuleNotFoundError') || stderr.includes('No module named')) {
      const missingModule = stderr.match(/No module named ['"]([^'"]+)['"]/)?.[1]
      err(`Coqui TTS dependency missing${missingModule ? `: ${missingModule}` : ''}.

SOLUTION: Run setup to install all dependencies:
  bun setup:tts`)
    } else {
      err('Failed to list models', { stderr: stderr || 'Unknown error' })
    }
  }
  
  const output = result.stdout
  
  if (output.includes('ERROR:')) {
    const errorMatch = output.match(/ERROR: (.+)/)
    err('Error loading TTS', { error: errorMatch ? errorMatch[1] : 'Unknown error' })
  }
  
  const startIdx = output.indexOf('MODELS_START:')
  const endIdx = output.indexOf('MODELS_END')
  
  if (startIdx === -1 || endIdx === -1) {
    l('Failed to parse model list, trying CLI fallback')
    const cliResult = spawnSync(pythonPath, ['-m', 'TTS', '--list_models'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONWARNINGS: 'ignore' }
    })
    
    if (cliResult.error) {
      l('CLI fallback failed', { error: cliResult.error })
    }
    
    if (cliResult.status === 0 && cliResult.stdout) {
      const cliOutput = cliResult.stdout
      const lines = cliOutput.split('\n')
        .filter(line => 
          line.trim() && 
          line.includes('/') &&
          !line.includes('UserWarning') &&
          !line.includes('DeprecationWarning')
        )
      
      if (lines.length > 0) {
        const modelsByCategory = lines.reduce((acc, model) => {
          const trimmedModel = model.trim()
          const parts = trimmedModel.split('/')
          if (parts.length >= 3) {
            const category = `${parts[0]}/${parts[1]}`
            if (!acc[category]) acc[category] = []
            acc[category].push(trimmedModel)
          }
          return acc
        }, {} as Record<string, string[]>)
        
        Object.entries(modelsByCategory)
          .sort(([a], [b]) => a.localeCompare(b))
          .forEach(([category, models]) => {
            console.log(`\n  ${category}:`)
            models.sort().forEach(model => {
              const modelName = model.split('/').slice(2).join('/')
              console.log(`    - ${modelName}`)
            })
          })
        
        l('Use a model with: bun as -- tts file input.md --coqui-model "model_name"')
        return
      }
    }
    
    l('Both primary and CLI fallback methods failed', { 
      primaryStderr: result.stderr,
      cliStderr: cliResult?.stderr 
    })
    err(`Failed to list Coqui TTS models.

Coqui TTS may not be properly installed or initialized.

SOLUTION:
  1. Run setup: bun setup:tts
  2. Verify installation: build/pyenv/tts/bin/python -c "import TTS; print(TTS.__version__)"
  3. If issues persist, try reinstalling: rm -rf build/pyenv/tts && bun setup:tts`)
  }
  
  const modelsSection = output.substring(startIdx, endIdx)
  
  const lines = modelsSection.split('\n')
    .slice(1)
    .filter(line => line.trim() && !line.includes('MODELS_START'))
    .map(line => line.trim())
  
  if (lines.length === 0) {
    err('No models found. Coqui TTS may not be properly installed or initialized.')
  }
  
  const modelsByCategory = lines.reduce((acc, model) => {
    const parts = model.split('/')
    if (parts.length >= 3) {
      const category = `${parts[0]}/${parts[1]}`
      if (!acc[category]) acc[category] = []
      acc[category].push(model)
    } else {
      if (!acc['other']) acc['other'] = []
      acc['other'].push(model)
    }
    return acc
  }, {} as Record<string, string[]>)
  
  Object.entries(modelsByCategory)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([category, models]) => {
      console.log(`\n  ${category}:`)
      models.sort().forEach(model => {
        const modelName = model.split('/').slice(2).join('/')
        console.log(`    - ${modelName || model}`)
      })
    })
  
  l('Use a model with: bun as -- tts file input.md --coqui-model "model_name"')
}
