import type { FixtureDef } from '~/types'

// ─── Valid fixtures ────────────────────────────────────────────────────────

const VALID_MEDIA: FixtureDef[] = [
  { path: 'valid/1-audio.wav', format: 'wav', supportLevel: 'current', validity: 'valid', requiredTools: ['ffmpeg'] },
  { path: 'valid/1-audio.mp3', format: 'mp3', supportLevel: 'current', validity: 'valid', requiredTools: ['ffmpeg'] },
  { path: 'valid/1-audio.m4a', format: 'm4a', supportLevel: 'current', validity: 'valid', requiredTools: ['ffmpeg'] },
  { path: 'valid/2-video.mp4', format: 'mp4', supportLevel: 'current', validity: 'valid', requiredTools: ['ffmpeg'] },
  { path: 'valid/2-video.webm', format: 'webm', supportLevel: 'current', validity: 'valid', requiredTools: ['ffmpeg'] },
  { path: 'valid/2-video.mkv', format: 'mkv', supportLevel: 'current', validity: 'valid', requiredTools: ['ffmpeg'] },
  { path: 'valid/1-audio.opus', format: 'opus', supportLevel: 'current', validity: 'valid', requiredTools: ['ffmpeg'] },
  { path: 'valid/1-audio.ogg', format: 'ogg', supportLevel: 'current', validity: 'valid', requiredTools: ['ffmpeg'] },
  { path: 'valid/1-audio.aac', format: 'aac', supportLevel: 'current', validity: 'valid', requiredTools: ['ffmpeg'] },
  { path: 'valid/2-video.mov', format: 'mov', supportLevel: 'current', validity: 'valid', requiredTools: ['ffmpeg'] },
  { path: 'valid/1-audio.flac', format: 'flac', supportLevel: 'current', validity: 'valid', requiredTools: ['ffmpeg'] },
]

const VALID_DOCS_CURRENT: FixtureDef[] = [
  { path: 'valid/1-document.pdf', format: 'pdf', supportLevel: 'current', validity: 'valid', requiredTools: [] },
  { path: 'valid/1-document.epub', format: 'epub', supportLevel: 'current', validity: 'valid', requiredTools: [] },
  { path: 'valid/1-document.docx', format: 'docx', supportLevel: 'current', validity: 'valid', requiredTools: [] },
  { path: 'valid/1-document.pptx', format: 'pptx', supportLevel: 'current', validity: 'valid', requiredTools: [] },
  { path: 'valid/1-document.xlsx', format: 'xlsx', supportLevel: 'current', validity: 'valid', requiredTools: [] },
  { path: 'valid/1-document.odt', format: 'odt', supportLevel: 'current', validity: 'valid', requiredTools: [] },
  { path: 'valid/1-document.ods', format: 'ods', supportLevel: 'current', validity: 'valid', requiredTools: [] },
  { path: 'valid/1-document.odp', format: 'odp', supportLevel: 'current', validity: 'valid', requiredTools: [] },
]

const VALID_IMAGES_CURRENT: FixtureDef[] = [
  { path: 'valid/1-image.png', format: 'png', supportLevel: 'current', validity: 'valid', requiredTools: [] },
  { path: 'valid/1-image.jpg', format: 'jpg', supportLevel: 'current', validity: 'valid', requiredTools: [] },
  { path: 'valid/1-image.jpeg', format: 'jpeg', supportLevel: 'current', validity: 'valid', requiredTools: [] },
  { path: 'valid/1-image.tif', format: 'tif', supportLevel: 'current', validity: 'valid', requiredTools: [] },
  { path: 'valid/1-image.tiff', format: 'tiff', supportLevel: 'current', validity: 'valid', requiredTools: [] },
]

const VALID_TEXT: FixtureDef[] = [
  { path: 'valid/1-tts.md', format: 'md', supportLevel: 'current', validity: 'valid', requiredTools: [] },
  { path: 'valid/2-urls.txt', format: 'txt', supportLevel: 'current', validity: 'valid', requiredTools: [] },
]

const VALID_DOCS_PLANNED: FixtureDef[] = [
  { path: 'valid/1-document.mobi', format: 'mobi', supportLevel: 'planned', validity: 'valid', requiredTools: ['calibre'] },
  { path: 'valid/1-document.azw3', format: 'azw3', supportLevel: 'planned', validity: 'valid', requiredTools: ['calibre'] },
  { path: 'valid/1-document.fb2', format: 'fb2', supportLevel: 'planned', validity: 'valid', requiredTools: ['calibre'] },
  { path: 'valid/1-document.lit', format: 'lit', supportLevel: 'planned', validity: 'valid', requiredTools: ['calibre'] },
  { path: 'valid/1-document.cbz', format: 'cbz', supportLevel: 'planned', validity: 'valid', requiredTools: [] },
  { path: 'valid/1-document.rtf', format: 'rtf', supportLevel: 'planned', validity: 'valid', requiredTools: [] },
  { path: 'valid/1-document.csv', format: 'csv', supportLevel: 'planned', validity: 'valid', requiredTools: [] },
]

const VALID_IMAGES_PLANNED: FixtureDef[] = [
  { path: 'valid/1-image.webp', format: 'webp', supportLevel: 'planned', validity: 'valid', requiredTools: ['imagemagick'] },
  { path: 'valid/1-image.bmp', format: 'bmp', supportLevel: 'planned', validity: 'valid', requiredTools: ['imagemagick'] },
  { path: 'valid/1-image.gif', format: 'gif', supportLevel: 'planned', validity: 'valid', requiredTools: ['imagemagick'] },
]

// ─── Invalid fixtures ──────────────────────────────────────────────────────

const INVALID_FIXTURES: FixtureDef[] = [
  {
    path: 'invalid/corrupt.pdf',
    format: 'pdf',
    supportLevel: 'current',
    validity: 'invalid',
    requiredTools: [],
    invalidReason: 'truncated-at-byte-64'
  },
  {
    path: 'invalid/corrupt.zip',
    format: 'zip',
    supportLevel: 'current',
    validity: 'invalid',
    requiredTools: [],
    invalidReason: 'corrupt-zip-container'
  },
  {
    path: 'invalid/empty.mp3',
    format: 'mp3',
    supportLevel: 'current',
    validity: 'invalid',
    requiredTools: [],
    invalidReason: 'empty-file'
  },
  {
    path: 'invalid/binary.png',
    format: 'png',
    supportLevel: 'current',
    validity: 'invalid',
    requiredTools: [],
    invalidReason: 'non-image-bytes-with-image-extension'
  },
  {
    path: 'invalid/malformed.csv',
    format: 'csv',
    supportLevel: 'current',
    validity: 'invalid',
    requiredTools: [],
    invalidReason: 'malformed-csv-unterminated-quotes'
  },
  {
    path: 'invalid/binary.csv',
    format: 'csv',
    supportLevel: 'current',
    validity: 'invalid',
    requiredTools: [],
    invalidReason: 'binary-content-with-csv-extension'
  },
]

export const ALL_FIXTURES: FixtureDef[] = [
  ...VALID_MEDIA,
  ...VALID_DOCS_CURRENT,
  ...VALID_IMAGES_CURRENT,
  ...VALID_TEXT,
  ...VALID_DOCS_PLANNED,
  ...VALID_IMAGES_PLANNED,
  ...INVALID_FIXTURES,
]
