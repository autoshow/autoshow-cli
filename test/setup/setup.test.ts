import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { execSync } from 'child_process'
import { existsSync, statSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT_DIR = join(__dirname, '../..')
const SETUP_SCRIPT = join(ROOT_DIR, '.github/setup/index.sh')
const BUILD_DIR = join(ROOT_DIR, 'build')
const BIN_DIR = join(BUILD_DIR, 'bin')
const CONFIG_DIR = join(BUILD_DIR, 'config')

describe('Setup Script Tests', () => {
  describe('Script Existence and Permissions', () => {
    it('should have main setup script', () => {
      assert.ok(existsSync(SETUP_SCRIPT))
    })

    it('should have executable permissions on main setup script', () => {
      const stats = statSync(SETUP_SCRIPT)
      // Check if executable bit is set (0o111 = executable for owner, group, others)
      assert.ok((stats.mode & 0o111) > 0)
    })

    it('should have whisper.sh script', () => {
      const whisperScript = join(ROOT_DIR, '.github/setup/transcription/whisper.sh')
      assert.ok(existsSync(whisperScript))
    })

    it('should have whisper-coreml.sh script', () => {
      const coremlScript = join(ROOT_DIR, '.github/setup/transcription/coreml/whisper-coreml.sh')
      assert.ok(existsSync(coremlScript))
    })
  })

  describe('Script Syntax Validation', () => {
    it('should have valid bash syntax in index.sh', () => {
      assert.doesNotThrow(() => {
        execSync(`bash -n ${SETUP_SCRIPT}`, { encoding: 'utf-8' })
      })
    })

    it('should have valid bash syntax in whisper.sh', () => {
      const whisperScript = join(ROOT_DIR, '.github/setup/transcription/whisper.sh')
      assert.doesNotThrow(() => {
        execSync(`bash -n ${whisperScript}`, { encoding: 'utf-8' })
      })
    })

    it('should have valid bash syntax in whisper-coreml.sh', () => {
      const coremlScript = join(ROOT_DIR, '.github/setup/transcription/coreml/whisper-coreml.sh')
      assert.doesNotThrow(() => {
        execSync(`bash -n ${coremlScript}`, { encoding: 'utf-8' })
      })
    })
  })

  describe('Error Handling', () => {
    it('should have set -euo pipefail in index.sh', () => {
      const content = readFileSync(SETUP_SCRIPT, 'utf-8')
      assert.ok(content.includes('set -euo pipefail'))
    })

    it('should have error handler in index.sh', () => {
      const content = readFileSync(SETUP_SCRIPT, 'utf-8')
      assert.ok(content.includes('error_handler'))
      assert.ok(content.includes('trap'))
    })

    it('should have cleanup_log function in index.sh', () => {
      const content = readFileSync(SETUP_SCRIPT, 'utf-8')
      assert.ok(content.includes('cleanup_log()'))
    })

    it('should log ERROR_CONTEXT on failure', () => {
      const content = readFileSync(SETUP_SCRIPT, 'utf-8')
      assert.ok(content.includes('ERROR_CONTEXT'))
    })

    it('should capture build errors in whisper.sh', () => {
      const whisperScript = join(ROOT_DIR, '.github/setup/transcription/whisper.sh')
      const content = readFileSync(whisperScript, 'utf-8')
      assert.ok(content.includes('TMP_LOG'))
      assert.ok(content.includes('ERROR: Build failed'))
    })

    it('should capture cmake errors in whisper.sh', () => {
      const whisperScript = join(ROOT_DIR, '.github/setup/transcription/whisper.sh')
      const content = readFileSync(whisperScript, 'utf-8')
      assert.ok(content.includes('ERROR: CMake configuration failed'))
    })

    it('should have error handler in whisper-coreml.sh', () => {
      const coremlScript = join(ROOT_DIR, '.github/setup/transcription/coreml/whisper-coreml.sh')
      const content = readFileSync(coremlScript, 'utf-8')
      assert.ok(content.includes('error_handler'))
    })
  })

  describe('Build Output Verification', () => {
    // These tests check if the build artifacts exist (assumes setup has been run)
    it('should have build/bin directory', () => {
      // Only check if setup has been run
      if (!existsSync(BIN_DIR)) {
        console.log('Skipping: build/bin does not exist (setup may not have been run)')
        return
      }
      assert.ok(existsSync(BIN_DIR))
    })

    it('should have whisper-cli binary if whisper setup was run', () => {
      const whisperCli = join(BIN_DIR, 'whisper-cli')
      if (!existsSync(BIN_DIR)) {
        console.log('Skipping: build/bin does not exist')
        return
      }
      if (existsSync(whisperCli)) {
        const stats = statSync(whisperCli)
        assert.ok((stats.mode & 0o111) > 0) // Check executable
      }
    })

    it('should have whisper-cli-coreml binary if coreml setup was run', () => {
      const coremlCli = join(BIN_DIR, 'whisper-cli-coreml')
      if (!existsSync(BIN_DIR)) {
        console.log('Skipping: build/bin does not exist')
        return
      }
      if (existsSync(coremlCli)) {
        const stats = statSync(coremlCli)
        assert.ok((stats.mode & 0o111) > 0) // Check executable
      }
    })

    it('should have CoreML config file if coreml setup was run', () => {
      const coremlEnv = join(CONFIG_DIR, '.coreml-env')
      if (!existsSync(CONFIG_DIR)) {
        console.log('Skipping: build/config does not exist')
        return
      }
      if (existsSync(coremlEnv)) {
        const content = readFileSync(coremlEnv, 'utf-8')
        assert.ok(content.includes('COREML_PYTHON'))
        assert.ok(content.includes('COREML_VENV'))
      }
    })
  })

  describe('Progress Messaging', () => {
    it('should have informative progress messages in whisper.sh', () => {
      const whisperScript = join(ROOT_DIR, '.github/setup/transcription/whisper.sh')
      const content = readFileSync(whisperScript, 'utf-8')
      assert.ok(content.includes('Cloning whisper.cpp repository'))
      assert.ok(content.includes('Configuring build with CMake'))
      assert.ok(content.includes('Building whisper.cpp'))
      assert.ok(content.includes('Installing whisper-cli binary'))
    })

    it('should have informative progress messages in whisper-coreml.sh', () => {
      const coremlScript = join(ROOT_DIR, '.github/setup/transcription/coreml/whisper-coreml.sh')
      const content = readFileSync(coremlScript, 'utf-8')
      assert.ok(content.includes('Checking for Python 3.11'))
      assert.ok(content.includes('Configuring build with CMake (CoreML + Metal)'))
      assert.ok(content.includes('Setting up Python virtual environment'))
      assert.ok(content.includes('Installing Python packages'))
    })
  })

  describe('Invalid Argument Handling', () => {
    it('should reject invalid setup mode', () => {
      assert.throws(() => {
        execSync(`${SETUP_SCRIPT} --invalid-mode`, {
          encoding: 'utf-8',
          cwd: ROOT_DIR,
          stdio: 'pipe'
        })
      })
    })

    it('should show usage message on invalid argument', () => {
      try {
        execSync(`${SETUP_SCRIPT} --invalid-mode`, {
          encoding: 'utf-8',
          cwd: ROOT_DIR,
          stdio: 'pipe'
        })
      } catch (error: any) {
        const output = error.stderr?.toString() || error.stdout?.toString() || ''
        assert.match(output, /Usage:|Invalid argument/)
      }
    })
  })

  describe('Dependency Checks', () => {
    it('should check for required dependencies', () => {
      const content = readFileSync(SETUP_SCRIPT, 'utf-8')
      assert.ok(content.includes('command -v brew'))
      assert.ok(content.includes('log_dependency_info'))
    })

    it('should verify cmake is available for whisper builds', () => {
      const whisperScript = join(ROOT_DIR, '.github/setup/transcription/whisper.sh')
      const content = readFileSync(whisperScript, 'utf-8')
      assert.ok(content.includes('cmake'))
    })

    it('should verify git is available for cloning', () => {
      const whisperScript = join(ROOT_DIR, '.github/setup/transcription/whisper.sh')
      const content = readFileSync(whisperScript, 'utf-8')
      assert.ok(content.includes('git clone'))
    })
  })

  describe('Cleanup and Error Recovery', () => {
    it('should cleanup temporary directories on success', () => {
      const whisperScript = join(ROOT_DIR, '.github/setup/transcription/whisper.sh')
      const content = readFileSync(whisperScript, 'utf-8')
      assert.ok(content.includes('rm -rf "$WHISPER_DIR"'))
    })

    it('should cleanup log file on successful completion', () => {
      const content = readFileSync(SETUP_SCRIPT, 'utf-8')
      assert.match(content, /rm -f.*LOGFILE/)
    })

    it('should preserve log file on failure', () => {
      const content = readFileSync(SETUP_SCRIPT, 'utf-8')
      assert.ok(content.includes('Logs saved in'))
    })
  })

  describe('TTS Setup Scripts', () => {
    it('should have tts-env.sh script', () => {
      const ttsEnvScript = join(ROOT_DIR, '.github/setup/tts/tts-env.sh')
      assert.ok(existsSync(ttsEnvScript))
    })

    it('should have valid bash syntax in tts-env.sh', () => {
      const ttsEnvScript = join(ROOT_DIR, '.github/setup/tts/tts-env.sh')
      assert.doesNotThrow(() => {
        execSync(`bash -n ${ttsEnvScript}`, { encoding: 'utf-8' })
      })
    })

    it('should have coqui.sh script', () => {
      const coquiScript = join(ROOT_DIR, '.github/setup/tts/coqui.sh')
      assert.ok(existsSync(coquiScript))
    })

    it('should have valid bash syntax in coqui.sh', () => {
      const coquiScript = join(ROOT_DIR, '.github/setup/tts/coqui.sh')
      assert.doesNotThrow(() => {
        execSync(`bash -n ${coquiScript}`, { encoding: 'utf-8' })
      })
    })

    it('should have kitten.sh script', () => {
      const kittenScript = join(ROOT_DIR, '.github/setup/tts/kitten.sh')
      assert.ok(existsSync(kittenScript))
    })

    it('should have valid bash syntax in kitten.sh', () => {
      const kittenScript = join(ROOT_DIR, '.github/setup/tts/kitten.sh')
      assert.doesNotThrow(() => {
        execSync(`bash -n ${kittenScript}`, { encoding: 'utf-8' })
      })
    })

    it('should have tts models.sh script', () => {
      const modelsScript = join(ROOT_DIR, '.github/setup/tts/models.sh')
      assert.ok(existsSync(modelsScript))
    })

    it('should have valid bash syntax in tts models.sh', () => {
      const modelsScript = join(ROOT_DIR, '.github/setup/tts/models.sh')
      assert.doesNotThrow(() => {
        execSync(`bash -n ${modelsScript}`, { encoding: 'utf-8' })
      })
    })

    it('should check for Python 3.11 in tts-env.sh', () => {
      const ttsEnvScript = join(ROOT_DIR, '.github/setup/tts/tts-env.sh')
      const content = readFileSync(ttsEnvScript, 'utf-8')
      assert.ok(content.includes('python3.11'))
      assert.ok(content.includes('ensure_python311'))
    })

    it('should setup virtual environment in tts-env.sh', () => {
      const ttsEnvScript = join(ROOT_DIR, '.github/setup/tts/tts-env.sh')
      const content = readFileSync(ttsEnvScript, 'utf-8')
      assert.ok(content.includes('VENV="build/pyenv/tts"'))
    })

    it('should have error handling in tts-env.sh', () => {
      const ttsEnvScript = join(ROOT_DIR, '.github/setup/tts/tts-env.sh')
      const content = readFileSync(ttsEnvScript, 'utf-8')
      assert.ok(content.includes('set -euo pipefail'))
    })
  })

  describe('Model Download Scripts', () => {
    it('should have download-ggml-model.sh script', () => {
      const downloadScript = join(ROOT_DIR, '.github/setup/transcription/download-ggml-model.sh')
      assert.ok(existsSync(downloadScript))
    })

    it('should have valid bash syntax in download-ggml-model.sh', () => {
      const downloadScript = join(ROOT_DIR, '.github/setup/transcription/download-ggml-model.sh')
      assert.doesNotThrow(() => {
        execSync(`bash -n ${downloadScript}`, { encoding: 'utf-8' })
      })
    })

    it('should have models.sh script for transcription', () => {
      const modelsScript = join(ROOT_DIR, '.github/setup/transcription/models.sh')
      assert.ok(existsSync(modelsScript))
    })

    it('should have valid bash syntax in transcription models.sh', () => {
      const modelsScript = join(ROOT_DIR, '.github/setup/transcription/models.sh')
      assert.doesNotThrow(() => {
        execSync(`bash -n ${modelsScript}`, { encoding: 'utf-8' })
      })
    })

    it('should specify Hugging Face as source in download script', () => {
      const downloadScript = join(ROOT_DIR, '.github/setup/transcription/download-ggml-model.sh')
      const content = readFileSync(downloadScript, 'utf-8')
      assert.ok(content.includes('huggingface.co'))
    })

    it('should support multiple model sizes', () => {
      const downloadScript = join(ROOT_DIR, '.github/setup/transcription/download-ggml-model.sh')
      const content = readFileSync(downloadScript, 'utf-8')
      assert.ok(content.includes('tiny'))
      assert.ok(content.includes('base'))
      assert.ok(content.includes('small'))
      assert.ok(content.includes('medium'))
      assert.ok(content.includes('large'))
    })
  })

  describe('CoreML Setup Scripts', () => {
    it('should have generate-coreml-model.sh script', () => {
      const generateScript = join(ROOT_DIR, '.github/setup/transcription/coreml/generate-coreml-model.sh')
      assert.ok(existsSync(generateScript))
    })

    it('should have valid bash syntax in generate-coreml-model.sh', () => {
      const generateScript = join(ROOT_DIR, '.github/setup/transcription/coreml/generate-coreml-model.sh')
      assert.doesNotThrow(() => {
        execSync(`bash -n ${generateScript}`, { encoding: 'utf-8' })
      })
    })

    it('should have convert-whisper-to-coreml.py script', () => {
      const convertScript = join(ROOT_DIR, '.github/setup/transcription/coreml/convert-whisper-to-coreml.py')
      assert.ok(existsSync(convertScript))
    })

    it('should have valid Python syntax in convert-whisper-to-coreml.py', () => {
      const convertScript = join(ROOT_DIR, '.github/setup/transcription/coreml/convert-whisper-to-coreml.py')
      assert.doesNotThrow(() => {
        execSync(`python3 -m py_compile ${convertScript}`, { encoding: 'utf-8' })
      })
    })

    it('should configure CoreML in whisper-coreml.sh', () => {
      const coremlScript = join(ROOT_DIR, '.github/setup/transcription/coreml/whisper-coreml.sh')
      const content = readFileSync(coremlScript, 'utf-8')
      assert.ok(content.includes('WHISPER_COREML=ON'))
    })

    it('should setup CoreML Python environment', () => {
      const coremlScript = join(ROOT_DIR, '.github/setup/transcription/coreml/whisper-coreml.sh')
      const content = readFileSync(coremlScript, 'utf-8')
      assert.ok(content.includes('build/pyenv/coreml'))
    })
  })

  describe('Python Version Management', () => {
    it('should have python-version.sh script', () => {
      const pythonScript = join(ROOT_DIR, '.github/setup/transcription/python-version.sh')
      assert.ok(existsSync(pythonScript))
    })

    it('should have valid bash syntax in python-version.sh', () => {
      const pythonScript = join(ROOT_DIR, '.github/setup/transcription/python-version.sh')
      assert.doesNotThrow(() => {
        execSync(`bash -n ${pythonScript}`, { encoding: 'utf-8' })
      })
    })
  })

  describe('Setup Mode Selection', () => {
    it('should support base mode', () => {
      const content = readFileSync(SETUP_SCRIPT, 'utf-8')
      assert.ok(content.includes('base)'))
    })

    it('should support transcription mode', () => {
      const content = readFileSync(SETUP_SCRIPT, 'utf-8')
      assert.ok(content.includes('transcription)'))
    })

    it('should support whisper mode', () => {
      const content = readFileSync(SETUP_SCRIPT, 'utf-8')
      assert.ok(content.includes('whisper)'))
    })

    it('should support whisper-coreml mode', () => {
      const content = readFileSync(SETUP_SCRIPT, 'utf-8')
      assert.ok(content.includes('whisper-coreml)'))
    })

    it('should support tts mode', () => {
      const content = readFileSync(SETUP_SCRIPT, 'utf-8')
      assert.ok(content.includes('tts)'))
    })

    it('should strip -- prefix from arguments', () => {
      const content = readFileSync(SETUP_SCRIPT, 'utf-8')
      assert.ok(content.includes('${SETUP_MODE#--}'))
    })
  })

  describe('Homebrew Package Installation', () => {
    it('should have quiet_brew_install function', () => {
      const content = readFileSync(SETUP_SCRIPT, 'utf-8')
      assert.ok(content.includes('quiet_brew_install()'))
    })

    it('should check if package already installed', () => {
      const content = readFileSync(SETUP_SCRIPT, 'utf-8')
      assert.ok(content.includes('brew list --formula'))
    })

    it('should install required packages for whisper', () => {
      const content = readFileSync(SETUP_SCRIPT, 'utf-8')
      assert.ok(content.includes('cmake'))
      assert.ok(content.includes('ffmpeg'))
      assert.ok(content.includes('pkg-config'))
    })

    it('should install espeak-ng for TTS', () => {
      const content = readFileSync(SETUP_SCRIPT, 'utf-8')
      assert.ok(content.includes('espeak-ng'))
    })
  })

  describe('Dependency Version Logging', () => {
    it('should log Node.js version', () => {
      const content = readFileSync(SETUP_SCRIPT, 'utf-8')
      assert.ok(content.includes('log_dependency_info "Node.js" "node"'))
    })

    it('should log npm version', () => {
      const content = readFileSync(SETUP_SCRIPT, 'utf-8')
      assert.ok(content.includes('log_dependency_info "npm"'))
    })

    it('should log Homebrew version', () => {
      const content = readFileSync(SETUP_SCRIPT, 'utf-8')
      assert.ok(content.includes('log_dependency_info "Homebrew" "brew"'))
    })

    it('should check and update yt-dlp', () => {
      const content = readFileSync(SETUP_SCRIPT, 'utf-8')
      assert.ok(content.includes('check_and_update_ytdlp()'))
    })
  })
})
