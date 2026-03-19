/**
 * Formatting utility functions
 */

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60000)
  const seconds = ((ms % 60000) / 1000).toFixed(1)
  return `${minutes}m ${seconds}s`
}

export function sanitizeForFilename(str: string): string {
  return str.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-')
}

export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleString()
}

export function formatDateShort(isoString: string): string {
  return new Date(isoString).toLocaleDateString()
}
