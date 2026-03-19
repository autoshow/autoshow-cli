import * as l from '~/logger'
import { exec, ensureDirectory } from '~/utils/cli-utils'

export const splitAudioFile = async (audioPath: string, outputDir: string, segmentDurationMinutes: number = 10): Promise<string[]> => {
  l.info(`Splitting audio file into ${segmentDurationMinutes}-minute segments`)
  
  const segmentDurationSeconds = segmentDurationMinutes * 60
  const segmentsDir = `${outputDir}/segments`
  await ensureDirectory(segmentsDir)
  
  const durationResult = await exec('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    audioPath
  ])
  
  const totalDuration = parseFloat(durationResult.stdout.trim())
  const totalSegments = Math.ceil(totalDuration / segmentDurationSeconds)
  
  l.info(`Audio duration: ${Math.floor(totalDuration / 60)} minutes`)
  l.info(`Will create ${totalSegments} segments`)
  
  const segmentPaths: string[] = []
  
  const tasks = Array.from({ length: totalSegments }, (_, i) => i).map(async (i) => {
    const startTime = i * segmentDurationSeconds
    const segmentPath = `${segmentsDir}/segment_${String(i + 1).padStart(3, '0')}.wav`
    
    const result = await exec('ffmpeg', [
      '-i', audioPath,
      '-ss', String(startTime),
      '-t', String(segmentDurationSeconds),
      '-acodec', 'pcm_s16le',
      '-ar', '16000',
      '-ac', '1',
      '-y',
      segmentPath
    ])
    
    if (result.exitCode !== 0) {
      l.error(`Failed to create segment ${i + 1}: ${result.stderr}`)
      throw new Error(`Failed to create segment ${i + 1}`)
    }
    
    l.success(`Segment ${i + 1}/${totalSegments} created`)
    return segmentPath
  })
  
  for (let i = 0; i < tasks.length; i++) {
    const segmentPath = await tasks[i]
    if (segmentPath) {
      segmentPaths.push(segmentPath)
    }
  }
  
  return segmentPaths
}

export const getAudioDuration = async (audioPath: string): Promise<number> => {
  const result = await exec('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    audioPath
  ])
  
  return parseFloat(result.stdout.trim())
}
