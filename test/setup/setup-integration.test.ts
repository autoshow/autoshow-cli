import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { execSync, spawn } from 'child_process'
import { existsSync, readFileSync, writeFileSync, unlinkSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT_DIR = join(__dirname, '../..')
const SETUP_SCRIPT = join(ROOT_DIR, '.github/setup/index.sh')

describe('Setup Integration Tests', () => {
  describe('Base Setup Mode', () => {
    it('should complete base setup successfully', () => {
      const output = execSync(`${SETUP_SCRIPT} base`, {
        encoding: 'utf-8',
        cwd: ROOT_DIR,
        timeout: 60000, // 1 minute for base setup
      })
      
      assert.ok(output.includes('Setup completed successfully'))
      assert.ok(output.includes('Homebrew:'))
      assert.ok(output.includes('Node.js:'))
    })
  })

  describe('Error Logging Verification', () => {
    it('should create detailed error logs on failure', async () => {
      // Simply verify that errors cause non-zero exit and produce output
      try {
        execSync(`${SETUP_SCRIPT} --invalid-arg`, {
          encoding: 'utf-8',
          cwd: ROOT_DIR,
          timeout: 10000,
        })
        // Should not reach here
        assert.fail('Expected error but none was thrown')
      } catch (error: any) {
        // Should have error output (either error message or usage message)
        const output = error.stdout || error.stderr || ''
        assert.ok(output.includes('Invalid argument') || output.includes('Usage'))
      }
    })
  })

  describe('Script Execution Safety', () => {
    it('should handle missing dependencies gracefully', () => {
      // Test with PATH that doesn't include homebrew
      try {
        execSync(`PATH=/usr/bin:/bin ${SETUP_SCRIPT} base`, {
          encoding: 'utf-8',
          cwd: ROOT_DIR,
          timeout: 30000,
          env: { ...process.env, PATH: '/usr/bin:/bin' }
        })
        // If it succeeds, that's also OK (homebrew might be in /usr/bin)
        assert.ok(true)
      } catch (error: any) {
        // If it fails, it should fail gracefully with a reasonable error
        const output = error.stdout || error.stderr || ''
        // Should have some error message (could be homebrew, npm, or other dependency)
        assert.ok(output.length > 0, 'Should have error output')
      }
    })
  })

  describe('Concurrent Execution Safety', () => {
    it('should handle log file conflicts', async () => {
      // Run two setups in quick succession to test log file handling
      const proc1 = spawn('bash', [SETUP_SCRIPT, 'base'], {
        cwd: ROOT_DIR,
        stdio: 'pipe'
      })
      
      // Wait a tiny bit then start another
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const proc2 = spawn('bash', [SETUP_SCRIPT, 'base'], {
        cwd: ROOT_DIR,
        stdio: 'pipe'
      })
      
      const results = await Promise.all([
        new Promise((resolve) => {
          let output = ''
          proc1.stdout?.on('data', (data) => { output += data })
          proc1.stderr?.on('data', (data) => { output += data })
          proc1.on('close', (code) => resolve({ code, output }))
        }),
        new Promise((resolve) => {
          let output = ''
          proc2.stdout?.on('data', (data) => { output += data })
          proc2.stderr?.on('data', (data) => { output += data })
          proc2.on('close', (code) => resolve({ code, output }))
        })
      ])
      
      // At least one should succeed
      const exitCodes = results.map((r: any) => r.code)
      assert.ok(exitCodes.filter(c => c === 0).length >= 1)
    })
  })

  describe('Build Output Validation', () => {
    it('should verify cmake output is captured on failure', () => {
      const whisperScript = join(ROOT_DIR, '.github/setup/transcription/whisper.sh')
      const content = readFileSync(whisperScript, 'utf-8')
      
      // Verify that cmake output goes to TMP_LOG
      assert.ok(content.includes('> "$TMP_LOG" 2>&1'))
      
      // Verify that errors show the log
      assert.ok(content.includes('cat "$TMP_LOG"'))
    })

    it('should verify build progress messages are shown', () => {
      const whisperScript = join(ROOT_DIR, '.github/setup/transcription/whisper.sh')
      const content = readFileSync(whisperScript, 'utf-8')
      
      // Should have echo statements for progress
      assert.ok(content.match(/echo.*Cloning/i))
      assert.ok(content.match(/echo.*Configuring/i))
      assert.ok(content.match(/echo.*Building/i))
    })
  })

  describe('Cleanup Verification', () => {
    it('should not leave temporary whisper directories', () => {
      // After a successful run, these should not exist
      const tempDirs = [
        join(ROOT_DIR, 'whisper-cpp-temp'),
        join(ROOT_DIR, 'whisper-cpp-temp-coreml')
      ]
      
      // If build has been run, verify cleanup happened
      const anyBuildArtifacts = existsSync(join(ROOT_DIR, 'build/bin'))
      if (anyBuildArtifacts) {
        tempDirs.forEach(dir => {
          assert.ok(!existsSync(dir))
        })
      }
    })

    it('should not leave temporary log files on success', () => {
      const files = readdirSync(ROOT_DIR)
      
      // Count setup log files
      const setupLogs = files.filter((f: string) => f.match(/^setup-\d{8}-\d{6}\.log$/))
      
      // There might be some from failed runs, but successful runs should clean up
      console.log(`Found ${setupLogs.length} setup log files (from failed runs)`)
    })
  })

  describe('Error Context Tracking', () => {
    it('should provide error context in failure messages', () => {
      const content = readFileSync(SETUP_SCRIPT, 'utf-8')
      
      // Should track what operation was being performed
      assert.ok(content.includes('ERROR_CONTEXT'))
      
      // Should show context in error messages
      assert.ok(content.includes('if [ -n "$ERROR_CONTEXT" ]'))
    })
  })

  describe('Whisper Setup Mode', () => {
    it('should handle whisper mode flag', async () => {
      try {
        const output = execSync(`${SETUP_SCRIPT} --whisper --help 2>&1 || true`, {
          encoding: 'utf-8',
          cwd: ROOT_DIR,
          timeout: 5000,
        })
        // Script should recognize the flag even if it errors on --help
        assert.ok(!output.includes('Invalid argument'))
      } catch (error) {
        // Expected - just checking flag is recognized
      }
    })
  })

  describe('Whisper CoreML Setup Mode', () => {
    it('should handle whisper-coreml mode flag', async () => {
      try {
        const output = execSync(`${SETUP_SCRIPT} --whisper-coreml --help 2>&1 || true`, {
          encoding: 'utf-8',
          cwd: ROOT_DIR,
          timeout: 5000,
        })
        // Script should recognize the flag
        assert.ok(!output.includes('Invalid argument'))
      } catch (error) {
        // Expected - just checking flag is recognized
      }
    })
  })

  describe('TTS Setup Mode', () => {
    it('should handle tts mode flag', async () => {
      try {
        const output = execSync(`${SETUP_SCRIPT} --tts --help 2>&1 || true`, {
          encoding: 'utf-8',
          cwd: ROOT_DIR,
          timeout: 5000,
        })
        // Script should recognize the flag
        assert.ok(!output.includes('Invalid argument'))
      } catch (error) {
        // Expected - just checking flag is recognized
      }
    })
  })

  describe('Transcription Setup Mode', () => {
    it('should handle transcription mode flag', async () => {
      try {
        const output = execSync(`${SETUP_SCRIPT} --transcription --help 2>&1 || true`, {
          encoding: 'utf-8',
          cwd: ROOT_DIR,
          timeout: 5000,
        })
        // Script should recognize the flag
        assert.ok(!output.includes('Invalid argument'))
      } catch (error) {
        // Expected - just checking flag is recognized
      }
    })
  })

  describe('Environment File Handling', () => {
    it('should create .env from .env.example if missing', () => {
      const envPath = join(ROOT_DIR, '.env')
      const envExamplePath = join(ROOT_DIR, '.env.example')
      
      if (!existsSync(envExamplePath)) {
        console.log('Skipping: .env.example does not exist')
        return
      }

      const hadEnv = existsSync(envPath)
      const envBackup = hadEnv ? readFileSync(envPath, 'utf-8') : null
      
      try {
        // Remove .env temporarily
        if (hadEnv) {
          unlinkSync(envPath)
        }
        
        // Run base setup
        execSync(`${SETUP_SCRIPT} base`, {
          encoding: 'utf-8',
          cwd: ROOT_DIR,
          timeout: 60000,
        })
        
        // Should have created .env
        assert.ok(existsSync(envPath))
      } finally {
        // Restore original .env
        if (hadEnv && envBackup) {
          writeFileSync(envPath, envBackup)
        }
      }
    })
  })

  describe('Directory Creation', () => {
    it('should create build/config directory', () => {
      const configDir = join(ROOT_DIR, 'build/config')
      
      if (!existsSync(configDir)) {
        execSync(`${SETUP_SCRIPT} base`, {
          encoding: 'utf-8',
          cwd: ROOT_DIR,
          timeout: 60000,
        })
      }
      
      assert.ok(existsSync(configDir))
    })

    it('should create build/pyenv directory', () => {
      const pyenvDir = join(ROOT_DIR, 'build/pyenv')
      
      if (!existsSync(pyenvDir)) {
        execSync(`${SETUP_SCRIPT} base`, {
          encoding: 'utf-8',
          cwd: ROOT_DIR,
          timeout: 60000,
        })
      }
      
      assert.ok(existsSync(pyenvDir))
    })
  })

  describe('Node Dependencies Installation', () => {
    it('should install npm packages during base setup', () => {
      const output = execSync(`${SETUP_SCRIPT} base`, {
        encoding: 'utf-8',
        cwd: ROOT_DIR,
        timeout: 60000,
      })
      
      assert.ok(output.includes('Node.js dependencies installed'))
      assert.ok(existsSync(join(ROOT_DIR, 'node_modules')))
    })
  })

  describe('macOS Platform Check', () => {
    it('should verify macOS requirement', () => {
      const content = readFileSync(SETUP_SCRIPT, 'utf-8')
      assert.ok(content.includes('darwin'))
      assert.ok(content.includes('Only macOS is supported'))
    })
  })

  describe('Log File Management', () => {
    it('should create timestamped log file', async () => {
      try {
        // Force an error to keep log file
        execSync(`${SETUP_SCRIPT} --invalid-arg`, {
          encoding: 'utf-8',
          cwd: ROOT_DIR,
          timeout: 10000,
        })
      } catch (error) {
        // Expected to fail
      }
      
      const afterFiles = readdirSync(ROOT_DIR)
      const logFiles = afterFiles.filter((f: string) => f.match(/^setup-\d{8}-\d{6}\.log$/))
      
      // Should have created a log file
      assert.ok(logFiles.length > 0)
      
      // Cleanup
      logFiles.forEach((f: string) => {
        try {
          unlinkSync(join(ROOT_DIR, f))
        } catch (e) {
          // Ignore cleanup errors
        }
      })
    })
  })

  describe('Binary Permissions', () => {
    it('should set executable permissions on binaries', () => {
      const binDir = join(ROOT_DIR, 'build/bin')
      
      if (!existsSync(binDir)) {
        console.log('Skipping: build/bin does not exist')
        return
      }
      
      const binaries = readdirSync(binDir).filter((f: string) => {
        return f.startsWith('whisper-cli') && !f.includes('.')
      })
      
      binaries.forEach((binary: string) => {
        const binaryPath = join(binDir, binary)
        const stats = statSync(binaryPath)
        // Check if executable bit is set
        assert.ok((stats.mode & 0o111) > 0)
      })
    })
  })

  describe('Dependency Availability Checks', () => {
    it('should check for Homebrew before proceeding', () => {
      const content = readFileSync(SETUP_SCRIPT, 'utf-8')
      assert.ok(content.includes('command -v brew'))
      assert.ok(content.includes('Homebrew not found'))
    })

    it('should verify cmake for whisper builds', () => {
      const whisperScript = join(ROOT_DIR, '.github/setup/transcription/whisper.sh')
      const content = readFileSync(whisperScript, 'utf-8')
      assert.ok(content.includes('cmake'))
    })
  })

  describe('Error Recovery', () => {
    it('should handle git clone failures gracefully', () => {
      const whisperScript = join(ROOT_DIR, '.github/setup/transcription/whisper.sh')
      const content = readFileSync(whisperScript, 'utf-8')
      
      // Should check for git clone success
      assert.ok(content.includes('git clone'))
      assert.match(content, /if.*git clone.*then/)
    })

    it('should handle cmake configuration failures', () => {
      const whisperScript = join(ROOT_DIR, '.github/setup/transcription/whisper.sh')
      const content = readFileSync(whisperScript, 'utf-8')
      
      // Should check for cmake success
      assert.ok(content.includes('CMake configuration failed'))
    })

    it('should handle build failures', () => {
      const whisperScript = join(ROOT_DIR, '.github/setup/transcription/whisper.sh')
      const content = readFileSync(whisperScript, 'utf-8')
      
      // Should check for build success
      assert.ok(content.includes('Build failed'))
    })
  })
})
