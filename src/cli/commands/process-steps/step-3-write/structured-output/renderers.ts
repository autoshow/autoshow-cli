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

const STANDARD_SONG_SECTIONS = ['verse1', 'chorus', 'verse2', 'bridge', 'finalChorus'] as const
const RAP_SONG_SECTIONS = ['verse1', 'chorus1', 'verse2', 'chorus2', 'verse3', 'chorus3'] as const
const RAP_SONG_LONG_SECTIONS = ['verse1', 'chorus1', 'verse2', 'chorus2', 'verse3', 'bridge', 'chorus3'] as const

const SECTION_LABELS: Record<string, string> = {
  verse1: 'Verse 1',
  verse2: 'Verse 2',
  verse3: 'Verse 3',
  chorus: 'Chorus',
  chorus1: 'Chorus',
  chorus2: 'Chorus',
  chorus3: 'Chorus',
  bridge: 'Bridge',
  finalChorus: 'Chorus'
}

const sectionToText = (content: unknown): string | undefined => {
  if (typeof content === 'string') return content.trim()
  if (Array.isArray(content)) {
    const lines = content.filter((l): l is string => typeof l === 'string').map(l => l.trim())
    return lines.length > 0 ? lines.join('\n') : undefined
  }
  return undefined
}

const hasSectionContent = (value: unknown): boolean =>
  typeof value === 'string' || (Array.isArray(value) && value.length > 0)

const renderSongLyrics = (record: Record<string, unknown>): string | undefined => {
  if (typeof record['title'] !== 'string' || !hasSectionContent(record['verse1'])) {
    return undefined
  }

  const title = record['title'].trim()
  const hasVerse3 = hasSectionContent(record['verse3'])
  const hasBridge = hasSectionContent(record['bridge'])
  const sections = hasVerse3 && hasBridge ? RAP_SONG_LONG_SECTIONS : hasVerse3 ? RAP_SONG_SECTIONS : STANDARD_SONG_SECTIONS
  const parts: string[] = []

  for (const key of sections) {
    const text = sectionToText(record[key])
    if (text) {
      const label = SECTION_LABELS[key] ?? humanizeKey(key)
      parts.push(`${label}\n\n${text}`)
    }
  }

  const body = parts.join('\n\n')
  return title.length > 0 ? `# ${title}\n\n${body}` : body
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
