const humanizeKey = (value: string): string => {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase())
}

const renderObject = (input: Record<string, unknown>, headingLevel: 2 | 3): string => {
  const headingPrefix = headingLevel === 2 ? '##' : '###'
  const chunks: string[] = []

  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string') {
      chunks.push(`${headingPrefix} ${humanizeKey(key)}\n\n${value}`)
      continue
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        chunks.push(`${headingPrefix} ${humanizeKey(key)}\n\n- (none)`)
        continue
      }

      if (value.every((item) => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean')) {
        const lines = value.map((item) => `- ${String(item)}`).join('\n')
        chunks.push(`${headingPrefix} ${humanizeKey(key)}\n\n${lines}`)
        continue
      }

      const renderedItems = value.map((item, index) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          return `#### Item ${index + 1}\n\n${renderObject(item as Record<string, unknown>, 3)}`
        }
        return `- ${JSON.stringify(item)}`
      }).join('\n\n')

      chunks.push(`${headingPrefix} ${humanizeKey(key)}\n\n${renderedItems}`)
      continue
    }

    if (value && typeof value === 'object') {
      chunks.push(`${headingPrefix} ${humanizeKey(key)}\n\n${renderObject(value as Record<string, unknown>, 3)}`)
      continue
    }

    chunks.push(`${headingPrefix} ${humanizeKey(key)}\n\n${String(value)}`)
  }

  return chunks.join('\n\n').trim()
}

const stripDuplicateSongTitleHeading = (lyrics: string, title: string): string => {
  const normalized = lyrics.trimStart()
  const [firstLine, ...rest] = normalized.split(/\r?\n/)
  const headingMatch = firstLine?.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/u)
  if (headingMatch?.[1]?.trim() !== title.trim()) {
    return lyrics.trim()
  }

  return rest.join('\n').replace(/^\s*\n/u, '').trim()
}

const renderSongLyrics = (record: Record<string, unknown>): string | undefined => {
  if (typeof record['title'] !== 'string' || typeof record['lyrics'] !== 'string') {
    return undefined
  }

  const title = record['title'].trim()
  const lyrics = stripDuplicateSongTitleHeading(record['lyrics'], title)
  return title.length > 0
    ? `# ${title}\n\n${lyrics}`.trim()
    : lyrics
}

const renderSingle = (json: unknown): string => {
  if (typeof json === 'string') {
    return json
  }

  if (json && typeof json === 'object' && !Array.isArray(json)) {
    const record = json as Record<string, unknown>
    const renderedSongLyrics = renderSongLyrics(record)
    if (renderedSongLyrics) {
      return renderedSongLyrics
    }

    if (typeof record['content'] === 'string') {
      return record['content']
    }
    return renderObject(record, 2)
  }

  if (Array.isArray(json)) {
    return json.map((entry) => `- ${typeof entry === 'string' ? entry : JSON.stringify(entry)}`).join('\n')
  }

  if (json === null || json === undefined) {
    return '(No output generated)'
  }

  return String(json)
}

export const renderToPlainText = (json: unknown, promptNames: string[]): string => {
  if (
    promptNames.length > 1
    && json
    && typeof json === 'object'
    && !Array.isArray(json)
  ) {
    const root = json as Record<string, unknown>
    const sections: string[] = []

    for (const promptName of promptNames) {
      const value = root[promptName]
      if (value === undefined) {
        continue
      }
      sections.push(`## ${humanizeKey(promptName)}\n\n${renderSingle(value)}`)
    }

    if (sections.length > 0) {
      return sections.join('\n\n').trim()
    }
  }

  return renderSingle(json)
}
