interface FileType {
  ext: string
  mime: string
}

function check(buffer: Uint8Array, header: number[], options: { offset?: number } = {}): boolean {
  const offset = options.offset || 0
  
  if (buffer.length < offset + header.length) {
    return false
  }
  
  return header.every((byte, index) => buffer[offset + index] === byte)
}

function checkString(buffer: Uint8Array, str: string, options: { offset?: number } = {}): boolean {
  const bytes = Array.from(str).map(char => char.charCodeAt(0))
  return check(buffer, bytes, options)
}

export async function detectFileTypeFromBuffer(buffer: Uint8Array): Promise<FileType | undefined> {
  if (!buffer || buffer.length < 4) {
    return undefined
  }
  
  if (check(buffer, [0x52, 0x49, 0x46, 0x46]) && buffer.length >= 12) {
    if (check(buffer, [0x57, 0x41, 0x56, 0x45], { offset: 8 })) {
      return { ext: 'wav', mime: 'audio/wav' }
    }
    if (check(buffer, [0x41, 0x56, 0x49], { offset: 8 })) {
      return { ext: 'avi', mime: 'video/vnd.avi' }
    }
  }
  
  if (check(buffer, [0xFF, 0xFB]) || check(buffer, [0xFF, 0xF3]) || check(buffer, [0xFF, 0xF2])) {
    return { ext: 'mp3', mime: 'audio/mpeg' }
  }
  
  if (checkString(buffer, 'ID3')) {
    return { ext: 'mp3', mime: 'audio/mpeg' }
  }
  
  if (checkString(buffer, 'ftyp', { offset: 4 }) && buffer.length >= 12) {
    const brandMajor = Array.from(buffer.slice(8, 12))
      .filter(b => b !== 0)
      .map(b => String.fromCharCode(b))
      .join('')
    
    switch (brandMajor) {
      case 'M4A':
        return { ext: 'm4a', mime: 'audio/x-m4a' }
      case 'M4V':
      case 'mp42':
      case 'isom':
        return { ext: 'mp4', mime: 'video/mp4' }
      case 'qt':
        return { ext: 'mov', mime: 'video/quicktime' }
      default:
        if (brandMajor.startsWith('3g')) {
          return { ext: 'mp4', mime: 'video/mp4' }
        }
        return { ext: 'mp4', mime: 'video/mp4' }
    }
  }
  
  if (check(buffer, [0x66, 0x72, 0x65, 0x65], { offset: 4 }) ||
      check(buffer, [0x6D, 0x64, 0x61, 0x74], { offset: 4 }) ||
      check(buffer, [0x6D, 0x6F, 0x6F, 0x76], { offset: 4 }) ||
      check(buffer, [0x77, 0x69, 0x64, 0x65], { offset: 4 })) {
    return { ext: 'mov', mime: 'video/quicktime' }
  }
  
  if (checkString(buffer, 'OggS')) {
    return { ext: 'ogg', mime: 'audio/ogg' }
  }
  
  if (checkString(buffer, 'fLaC')) {
    return { ext: 'flac', mime: 'audio/flac' }
  }
  
  if (check(buffer, [0xFF, 0xF1]) || check(buffer, [0xFF, 0xF9])) {
    return { ext: 'aac', mime: 'audio/aac' }
  }
  
  if (check(buffer, [0xFF, 0xE0], { offset: 0 }) && check(buffer, [0xE0], { offset: 1 })) {
    const byte2 = buffer[1]
    if (byte2 && (byte2 & 0xE0) === 0xE0) {
      return { ext: 'aac', mime: 'audio/aac' }
    }
  }
  
  if (check(buffer, [0x1A, 0x45, 0xDF, 0xA3])) {
    if (buffer.length >= 64) {
      const data = buffer.slice(0, 64)
      const dataStr = Array.from(data)
        .map(b => String.fromCharCode(b))
        .join('')
      
      if (dataStr.includes('webm')) {
        return { ext: 'webm', mime: 'video/webm' }
      }
      if (dataStr.includes('matroska')) {
        return { ext: 'mkv', mime: 'video/matroska' }
      }
    }
    return { ext: 'mkv', mime: 'video/matroska' }
  }
  
  return undefined
}

export function isSupportedAudioFormat(ext: string): boolean {
  const supportedAudioFormats = new Set(['wav', 'mp3', 'm4a', 'aac', 'ogg', 'flac'])
  return supportedAudioFormats.has(ext.toLowerCase())
}

export function isSupportedVideoFormat(ext: string): boolean {
  const supportedVideoFormats = new Set(['mp4', 'mkv', 'avi', 'mov', 'webm'])
  return supportedVideoFormats.has(ext.toLowerCase())
}

export function isSupportedFormat(ext: string): boolean {
  return isSupportedAudioFormat(ext) || isSupportedVideoFormat(ext)
}