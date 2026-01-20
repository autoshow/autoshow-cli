import { readFileSync } from 'node:fs'
import { l, err } from '@/logging'
import { spawnSync, existsSync, join, dirname } from '@/node-utils'

export const listModels = async (): Promise<void> => {
  const configPath = join(process.cwd(), 'build/config', '.tts-config.json')
  l.dim(`Loading config from: ${configPath}`)
  const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : {}
  const pythonPath = config.python || process.env['TTS_PYTHON_PATH'] || process.env['COQUI_PYTHON_PATH'] || 
    (existsSync(join(process.cwd(), 'build/pyenv/tts/bin/python')) ? join(process.cwd(), 'build/pyenv/tts/bin/python') : 'python3')
  
  l.dim(`Using Python path: ${pythonPath}`)
  
  const pythonScriptPath = join(dirname(import.meta.url.replace('file://', '')), '../tts-local/coqui-list.py')
  
  l.dim(`Listing available TTS models`)
  
  const result = spawnSync(pythonPath, [pythonScriptPath], { 
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONWARNINGS: 'ignore', TF_CPP_MIN_LOG_LEVEL: '3' }
  })
  
  if (result.error) {
    err(`Failed to execute Python: ${result.error.message}`)
  }
  
  if (result.status !== 0) {
    err(`Failed to list models: ${result.stderr || 'Unknown error'}`)
  }
  
  const output = result.stdout
  
  if (output.includes('ERROR:')) {
    const errorMatch = output.match(/ERROR: (.+)/)
    err(`Error loading TTS: ${errorMatch ? errorMatch[1] : 'Unknown error'}`)
  }
  
  const startIdx = output.indexOf('MODELS_START:')
  const endIdx = output.indexOf('MODELS_END')
  
  if (startIdx === -1 || endIdx === -1) {
    l.dim(`Failed to parse model list, trying CLI fallback`)
    const cliResult = spawnSync(pythonPath, ['-m', 'TTS', '--list_models'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONWARNINGS: 'ignore' }
    })
    
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
        
        l.dim(`Use a model with: bun as -- tts file input.md --coqui-model "model_name"`)
        return
      }
    }
    
    err(`Failed to parse model list. Coqui TTS may not be properly installed.`)
  }
  
  const modelsSection = output.substring(startIdx, endIdx)
  
  const lines = modelsSection.split('\n')
    .slice(1)
    .filter(line => line.trim() && !line.includes('MODELS_START'))
    .map(line => line.trim())
  
  if (lines.length === 0) {
    err(`No models found. Coqui TTS may not be properly installed or initialized.`)
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
  
  l.dim(`Use a model with: bun as -- tts file input.md --coqui-model "model_name"`)
}
