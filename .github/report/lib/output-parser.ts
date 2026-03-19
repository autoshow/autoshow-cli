/**
 * OutputParser class for parsing setup command output
 */

import type { Phase, Download, ErrorInfo } from '../types.ts'

export class OutputParser {
  private phases: Phase[] = []
  private downloads: Download[] = []
  private errors: ErrorInfo[] = []
  private currentPhase: Phase | null = null
  private lineBuffer: string[] = []

  parseLine(line: string, isStderr: boolean = false): void {
    this.lineBuffer.push(line)
    if (this.lineBuffer.length > 20) {
      this.lineBuffer.shift()
    }

    // Check for errors
    if (isStderr || /error|fail|exception/i.test(line)) {
      if (/error|fail|exception/i.test(line) && !/warning/i.test(line)) {
        this.errors.push({
          timestamp: new Date().toISOString(),
          message: line.trim(),
          context: this.lineBuffer.slice(-5).join('\n'),
        })
      }
    }

    // Check for phase transitions
    this.detectPhase(line)

    // Check for downloads
    this.detectDownloads(line)
  }

  private detectPhase(line: string): void {
    // Look for timestamped log lines (from common.sh log function)
    const timestampMatch = line.match(/^\[(\d{2}:\d{2}:\d{2}\.\d{3})\]\s*(.+)$/)
    if (timestampMatch) {
      const message = timestampMatch[2]

      // End current phase if we see completion markers
      if (/completed|success|done|finished|installed/i.test(message)) {
        if (this.currentPhase) {
          this.currentPhase.endTime = new Date().toISOString()
          this.currentPhase.durationMs = Date.now() - new Date(this.currentPhase.startTime).getTime()
          this.currentPhase.success = !/fail|error/i.test(message)
          this.phases.push(this.currentPhase)
          this.currentPhase = null
        }
        return
      }

      // Start new phase for action verbs
      if (/^(Installing|Cloning|Downloading|Building|Compiling|Creating|Setting up|Updating|Checking)/i.test(message)) {
        // End previous phase if exists
        if (this.currentPhase) {
          this.currentPhase.endTime = new Date().toISOString()
          this.currentPhase.durationMs = Date.now() - new Date(this.currentPhase.startTime).getTime()
          this.currentPhase.success = true
          this.phases.push(this.currentPhase)
        }

        this.currentPhase = {
          name: message.replace(/\.{3}$/, '').trim(),
          startTime: new Date().toISOString(),
          success: true,
        }
      }
    }
  }

  private detectDownloads(line: string): void {
    // Git clone
    const gitMatch = line.match(/git\s+clone\s+(?:--[^\s]+\s+)*([^\s]+)/i)
    if (gitMatch) {
      this.downloads.push({
        url: gitMatch[1],
        success: true,
      })
    }

    // wget/curl
    const wgetMatch = line.match(/(?:wget|curl)\s+.*?(https?:\/\/[^\s'"]+)/i)
    if (wgetMatch) {
      this.downloads.push({
        url: wgetMatch[1],
        success: true,
      })
    }

    // pip install
    const pipMatch = line.match(/pip\s+install\s+(?!-)([^\s><=]+)/gi)
    if (pipMatch) {
      for (const match of pipMatch) {
        const pkg = match.replace(/pip\s+install\s+/i, '').trim()
        if (pkg && !pkg.startsWith('-')) {
          this.downloads.push({
            url: `pypi:///${pkg}`,
            success: true,
          })
        }
      }
    }

    // Downloading messages
    const downloadingMatch = line.match(/Downloading\s+(https?:\/\/[^\s]+)/i)
    if (downloadingMatch) {
      this.downloads.push({
        url: downloadingMatch[1],
        success: true,
      })
    }

    // HuggingFace hub downloads
    if (/huggingface_hub|from_pretrained|snapshot_download/i.test(line)) {
      const hfMatch = line.match(/([\w\-]+\/[\w\-\.]+)/g)
      if (hfMatch) {
        for (const repo of hfMatch) {
          if (repo.includes('/') && !repo.startsWith('http')) {
            this.downloads.push({
              url: `huggingface:///${repo}`,
              success: true,
            })
          }
        }
      }
    }
  }

  finalize(): void {
    // Close any open phase
    if (this.currentPhase) {
      this.currentPhase.endTime = new Date().toISOString()
      this.currentPhase.durationMs = Date.now() - new Date(this.currentPhase.startTime).getTime()
      this.phases.push(this.currentPhase)
      this.currentPhase = null
    }
  }

  getPhases(): Phase[] {
    return this.phases
  }

  getDownloads(): Download[] {
    // Deduplicate downloads
    const seen = new Set<string>()
    return this.downloads.filter((d) => {
      if (seen.has(d.url)) return false
      seen.add(d.url)
      return true
    })
  }

  getErrors(): ErrorInfo[] {
    return this.errors
  }
}
