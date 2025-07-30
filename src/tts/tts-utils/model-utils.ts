import { readFileSync } from 'node:fs'
import { l, err } from '@/logging'
import { path, spawnSync, existsSync } from '@/node-utils'

const p = '[tts/tts-utils/model-utils]'

export const listModels = async (): Promise<void> => {
  l.dim(`${p} Fetching available Coqui TTS models`)
  
  const configPath = path.join(process.cwd(), '.tts-config.json')
  const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : {}
  const pythonPath = config.python || process.env['TTS_PYTHON_PATH'] || process.env['COQUI_PYTHON_PATH'] || 
    (existsSync(path.join(process.cwd(), 'python_env/bin/python')) ? path.join(process.cwd(), 'python_env/bin/python') : 'python3')
  
  l.dim(`${p} Using Python: ${pythonPath}`)
  
  const pythonScriptPath = path.join(path.dirname(import.meta.url.replace('file://', '')), '../tts-services/coqui-list.py')
  l.dim(`${p} Using Python script: ${pythonScriptPath}`)
  
  const result = spawnSync(pythonPath, [pythonScriptPath], { 
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONWARNINGS: 'ignore', TF_CPP_MIN_LOG_LEVEL: '3' }
  })
  
  if (result.error) {
    err(`${p} Failed to execute Python: ${result.error.message}`)
  }
  
  if (result.status !== 0) {
    l.dim(`${p} stderr: ${result.stderr}`)
    err(`${p} Failed to list models: ${result.stderr || 'Unknown error'}`)
  }
  
  const output = result.stdout
  
  if (output.includes('ERROR:')) {
    const errorMatch = output.match(/ERROR: (.+)/)
    err(`${p} Error loading TTS: ${errorMatch ? errorMatch[1] : 'Unknown error'}`)
  }
  
  const startIdx = output.indexOf('MODELS_START:')
  const endIdx = output.indexOf('MODELS_END')
  
  if (startIdx === -1 || endIdx === -1) {
    l.dim(`${p} Attempting alternative method using CLI`)
    
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
        l.dim(`${p} Available Coqui TTS models:`)
        
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
        
        l.dim(`${p} Use a model with: npm run as -- tts file input.md --coqui-model "model_name"`)
        l.dim(`${p} Example: npm run as -- tts file input.md --coqui-model "tts_models/en/ljspeech/tacotron2-DDC"`)
        return
      }
    }
    
    err(`${p} Failed to parse model list. Coqui TTS may not be properly installed.`)
  }
  
  const modelsSection = output.substring(startIdx, endIdx)
  const modelCountMatch = modelsSection.match(/MODELS_START:(\d+)/)
  const modelCount = parseInt(modelCountMatch?.[1] ?? '0')
  
  l.dim(`${p} Found ${modelCount} models`)
  
  const lines = modelsSection.split('\n')
    .slice(1)
    .filter(line => line.trim() && !line.includes('MODELS_START'))
    .map(line => line.trim())
  
  if (lines.length === 0) {
    err(`${p} No models found. Coqui TTS may not be properly installed or initialized.`)
  }
  
  l.dim(`${p} Available Coqui TTS models:`)
  
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
  
  l.dim(`${p} Use a model with: npm run as -- tts file input.md --coqui-model "model_name"`)
  l.dim(`${p} Example: npm run as -- tts file input.md --coqui-model "tts_models/en/ljspeech/tacotron2-DDC"`)
}

export const downloadModel = async (_modelId: string): Promise<boolean> => {
  l.dim(`${p} Model download not applicable for current TTS engines`)
  return true
}