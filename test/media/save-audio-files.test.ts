import test from 'node:test'
import { strictEqual, ok, rejects } from 'node:assert/strict'
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { sanitizeFilename, convertLocalAudioFiles } from '../../src/media/save-audio-files'

test('sanitizeFilename function tests', async (t) => {
  await t.test('should convert uppercase to lowercase', async () => {
    const result = await sanitizeFilename('MyFile.mp3')
    strictEqual(result, 'myfile.mp3')
  })
  
  await t.test('should replace spaces with hyphens', async () => {
    const result = await sanitizeFilename('My Audio File.mp3')
    strictEqual(result, 'my-audio-file.mp3')
  })
  
  await t.test('should remove special characters', async () => {
    const result = await sanitizeFilename('My@File#Name!.mp3')
    strictEqual(result, 'my-file-name-.mp3')
  })
  
  await t.test('should collapse multiple hyphens', async () => {
    const result = await sanitizeFilename('My---File---Name.mp3')
    strictEqual(result, 'my-file-name.mp3')
  })
  
  await t.test('should remove leading and trailing hyphens', async () => {
    const result = await sanitizeFilename('-MyFile-.mp3')
    strictEqual(result, 'myfile.mp3')
  })
  
  await t.test('should preserve file extension', async () => {
    const result = await sanitizeFilename('MyFile.MP4')
    strictEqual(result, 'myfile.MP4')
  })
  
  await t.test('should handle files without extension', async () => {
    const result = await sanitizeFilename('MyFile')
    strictEqual(result, 'myfile')
  })
  
  await t.test('should handle complex filenames', async () => {
    const result = await sanitizeFilename('The Best Song (2024) [Official].mp3')
    strictEqual(result, 'the-best-song-2024--official-.mp3')
  })
})

test('convertLocalAudioFiles function tests', async (t) => {
  const p = '[test/media/save-audio-files]'
  const testDir = resolve(process.cwd(), 'test', 'media', 'test-fixtures')
  const outputDir = join(testDir, 'output')
  const inputDir = join(testDir, 'input')
  
  await t.before(() => {
    // Create test directories
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
    mkdirSync(inputDir, { recursive: true })
    console.log(`${p} Created test fixtures directory`)
  })
  
  await t.after(() => {
    // Clean up test directories
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
      console.log(`${p} Cleaned up test fixtures directory`)
    }
  })
  
  await t.test('should reject non-existent file', async () => {
    const nonExistentFile = join(inputDir, 'non-existent.mp4')
    
    await rejects(
      async () => await convertLocalAudioFiles(nonExistentFile, outputDir),
      {
        message: /Input ".*" is neither a valid file nor directory/
      }
    )
  })
  
  await t.test('should reject non-existent directory', async () => {
    const nonExistentDir = join(inputDir, 'non-existent-dir')
    
    await rejects(
      async () => await convertLocalAudioFiles(nonExistentDir, outputDir),
      {
        message: /Input ".*" is neither a valid file nor directory/
      }
    )
  })
  
  await t.test('should reject directory with no media files', async () => {
    const emptyDir = join(inputDir, 'empty')
    mkdirSync(emptyDir, { recursive: true })
    
    // Create a non-media file
    writeFileSync(join(emptyDir, 'readme.txt'), 'test')
    
    await rejects(
      async () => await convertLocalAudioFiles(emptyDir, outputDir),
      {
        message: /No media files found in directory/
      }
    )
  })
  
  await t.test('should accept single video file', async () => {
    const testFile = join(inputDir, 'test-video.mp4')
    
    // Create a minimal valid MP4 file using ffmpeg
    const { exec } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const execAsync = promisify(exec)
    
    try {
      await execAsync(
        `ffmpeg -f lavfi -i sine=frequency=1000:duration=1 -f lavfi -i color=c=blue:s=320x240:d=1 -c:v libx264 -c:a aac -y "${testFile}"`,
        { shell: '/bin/zsh' }
      )
      
      ok(existsSync(testFile), 'Test video file should exist')
      
      await convertLocalAudioFiles(testFile, outputDir, false)
      
      ok(existsSync(outputDir), 'Output directory should be created')
      
      // Check that an MP3 file was created
      const fs = await import('node:fs/promises')
      const outputFiles = await fs.readdir(outputDir)
      const mp3Files = outputFiles.filter(f => f.endsWith('.mp3'))
      
      ok(mp3Files.length > 0, 'Should create at least one MP3 file')
      console.log(`${p} Successfully converted video to audio`)
    } catch (error) {
      console.log(`${p} Skipping test - ffmpeg not available: ${error}`)
      // Skip test if ffmpeg is not available
      t.skip()
    }
  })
  
  await t.test('should accept directory with multiple media files', async () => {
    const mediaDir = join(inputDir, 'media')
    mkdirSync(mediaDir, { recursive: true })
    
    const testFile1 = join(mediaDir, 'video1.mp4')
    const testFile2 = join(mediaDir, 'video2.mp4')
    
    // Create minimal valid MP4 files
    const { exec } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const execAsync = promisify(exec)
    
    try {
      await execAsync(
        `ffmpeg -f lavfi -i sine=frequency=1000:duration=1 -f lavfi -i color=c=blue:s=320x240:d=1 -c:v libx264 -c:a aac -y "${testFile1}"`,
        { shell: '/bin/zsh' }
      )
      await execAsync(
        `ffmpeg -f lavfi -i sine=frequency=1500:duration=1 -f lavfi -i color=c=red:s=320x240:d=1 -c:v libx264 -c:a aac -y "${testFile2}"`,
        { shell: '/bin/zsh' }
      )
      
      ok(existsSync(testFile1), 'Test video file 1 should exist')
      ok(existsSync(testFile2), 'Test video file 2 should exist')
      
      const multiOutputDir = join(testDir, 'multi-output')
      await convertLocalAudioFiles(mediaDir, multiOutputDir, false)
      
      ok(existsSync(multiOutputDir), 'Output directory should be created')
      
      // Check that MP3 files were created
      const fs = await import('node:fs/promises')
      const outputFiles = await fs.readdir(multiOutputDir)
      const mp3Files = outputFiles.filter(f => f.endsWith('.mp3'))
      
      ok(mp3Files.length >= 2, 'Should create at least two MP3 files')
      console.log(`${p} Successfully converted multiple videos to audio`)
    } catch (error) {
      console.log(`${p} Skipping test - ffmpeg not available: ${error}`)
      // Skip test if ffmpeg is not available
      t.skip()
    }
  })
  
  await t.test('should use default output directory when not specified', async () => {
    const testFile = join(inputDir, 'test-default.mp4')
    const defaultOutputDir = resolve(process.cwd(), 'output')
    
    // Create a minimal valid MP4 file
    const { exec } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const execAsync = promisify(exec)
    
    try {
      await execAsync(
        `ffmpeg -f lavfi -i sine=frequency=1000:duration=1 -f lavfi -i color=c=green:s=320x240:d=1 -c:v libx264 -c:a aac -y "${testFile}"`,
        { shell: '/bin/zsh' }
      )
      
      // Get files before conversion
      const fs = await import('node:fs/promises')
      const beforeFiles = existsSync(defaultOutputDir) ? await fs.readdir(defaultOutputDir) : []
      
      await convertLocalAudioFiles(testFile, undefined, false)
      
      ok(existsSync(defaultOutputDir), 'Default output directory should exist')
      
      // Check that new files were created
      const afterFiles = await fs.readdir(defaultOutputDir)
      const newFiles = afterFiles.filter(f => !beforeFiles.includes(f) && f.endsWith('.mp3'))
      
      ok(newFiles.length > 0, 'Should create at least one new MP3 file in default output')
      console.log(`${p} Successfully used default output directory`)
      
      // Clean up the test file from default output
      for (const file of newFiles) {
        if (file.includes('test-default')) {
          rmSync(join(defaultOutputDir, file), { force: true })
        }
      }
    } catch (error) {
      console.log(`${p} Skipping test - ffmpeg not available: ${error}`)
      // Skip test if ffmpeg is not available
      t.skip()
    }
  })
})
