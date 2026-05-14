import { join, dirname } from 'node:path'
import { mkdir, rm } from 'node:fs/promises'
import * as l from '~/utils/logger'
import { exec } from '~/utils/cli-utils'
import { calibreBin } from '~/cli/commands/setup-and-utilities/setup/setup-download/dl-document/calibre'
import type { FixtureDef, GenerateResult, ToolName } from '~/types'

// ─── Media generation helpers ─────────────────────────────────────────────

const generateSilentAudio = async (outPath: string, format: string): Promise<void> => {
  const formatArgs: Record<string, string[]> = {
    wav: ['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '1', '-ar', '44100'],
    mp3: ['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '1'],
    m4a: ['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '1'],
    opus: ['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '1'],
    ogg: ['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '1'],
    aac: ['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '1'],
    flac: ['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '1'],
  }
  const args = formatArgs[format] ?? ['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '1']
  const result = await exec('ffmpeg', ['-y', ...args, outPath])
  if (result.exitCode !== 0) {
    throw new Error(`ffmpeg failed for ${outPath}: ${result.stderr}`)
  }
}

const generateSilentVideo = async (outPath: string, format: string): Promise<void> => {
  const result = await exec('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', 'color=black:s=64x64:r=1',
    '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono',
    '-t', '1',
    '-c:v', format === 'webm' ? 'libvpx' : format === 'mkv' ? 'libx264' : 'libx264',
    outPath
  ])
  if (result.exitCode !== 0) {
    throw new Error(`ffmpeg failed for ${outPath}: ${result.stderr}`)
  }
}

// ─── Document generation helpers ──────────────────────────────────────────

const SAMPLE_TEXT = 'Sample document for testing.'

type ZipFixtureEntry = {
  path: string
  content: string | Uint8Array
}

const CRC32_TABLE = new Uint32Array(256)
for (let i = 0; i < CRC32_TABLE.length; i++) {
  let crc = i
  for (let bit = 0; bit < 8; bit++) {
    crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  }
  CRC32_TABLE[i] = crc >>> 0
}

const crc32 = (data: Buffer): number => {
  let crc = 0xffffffff
  for (const byte of data) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

const zipContentBuffer = (content: string | Uint8Array): Buffer =>
  typeof content === 'string' ? Buffer.from(content, 'utf8') : Buffer.from(content)

const writeZipFixture = async (outPath: string, entries: ZipFixtureEntry[]): Promise<void> => {
  const fileParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    const name = Buffer.from(entry.path, 'utf8')
    const data = zipContentBuffer(entry.content)
    const crc = crc32(data)

    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(0x04034b50, 0)
    localHeader.writeUInt16LE(20, 4)
    localHeader.writeUInt16LE(0x0800, 6)
    localHeader.writeUInt16LE(0, 8)
    localHeader.writeUInt16LE(0, 10)
    localHeader.writeUInt16LE(0, 12)
    localHeader.writeUInt32LE(crc, 14)
    localHeader.writeUInt32LE(data.length, 18)
    localHeader.writeUInt32LE(data.length, 22)
    localHeader.writeUInt16LE(name.length, 26)

    fileParts.push(localHeader, name, data)

    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(0x02014b50, 0)
    centralHeader.writeUInt16LE(20, 4)
    centralHeader.writeUInt16LE(20, 6)
    centralHeader.writeUInt16LE(0x0800, 8)
    centralHeader.writeUInt16LE(0, 10)
    centralHeader.writeUInt16LE(0, 12)
    centralHeader.writeUInt16LE(0, 14)
    centralHeader.writeUInt32LE(crc, 16)
    centralHeader.writeUInt32LE(data.length, 20)
    centralHeader.writeUInt32LE(data.length, 24)
    centralHeader.writeUInt16LE(name.length, 28)
    centralHeader.writeUInt32LE(offset, 42)
    centralParts.push(centralHeader, name)

    offset += localHeader.length + name.length + data.length
  }

  const centralOffset = offset
  const centralDirectory = Buffer.concat(centralParts)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralDirectory.length, 12)
  end.writeUInt32LE(centralOffset, 16)

  await Bun.write(outPath, Buffer.concat([...fileParts, centralDirectory, end]))
}

const generateDocxFromScratch = async (outPath: string): Promise<void> => {
  await writeZipFixture(outPath, [
    {
      path: '[Content_Types].xml',
      content: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
    },
    {
      path: 'word/document.xml',
      content: `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${SAMPLE_TEXT}</w:t></w:r></w:p></w:body></w:document>`
    }
  ])
}

const generatePptxFromScratch = async (outPath: string): Promise<void> => {
  await writeZipFixture(outPath, [
    {
      path: '[Content_Types].xml',
      content: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>'
    },
    {
      path: 'ppt/slides/slide1.xml',
      content: `<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>${SAMPLE_TEXT}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`
    }
  ])
}

const generateXlsxFromScratch = async (outPath: string): Promise<void> => {
  await writeZipFixture(outPath, [
    {
      path: '[Content_Types].xml',
      content: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>'
    },
    {
      path: 'xl/sharedStrings.xml',
      content: '<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="4" uniqueCount="4"><si><t>ID</t></si><si><t>Name</t></si><si><t>1</t></si><si><t>Sample</t></si></sst>'
    },
    {
      path: 'xl/worksheets/sheet1.xml',
      content: '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c></row></sheetData></worksheet>'
    }
  ])
}

const generateOdfFromScratch = async (outPath: string, mimetype: string): Promise<void> => {
  await writeZipFixture(outPath, [
    { path: 'mimetype', content: mimetype },
    {
      path: 'content.xml',
      content: `<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"><office:body><office:text><text:p>${SAMPLE_TEXT}</text:p></office:text></office:body></office:document-content>`
    }
  ])
}

const generateEpubFromScratch = async (outPath: string): Promise<void> => {
  await writeZipFixture(outPath, [
    { path: 'mimetype', content: 'application/epub+zip' },
    {
      path: 'META-INF/container.xml',
      content: '<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'
    },
    {
      path: 'OEBPS/content.opf',
      content: '<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Sample EPUB</dc:title><dc:language>en</dc:language><dc:identifier id="bookid">sample-epub</dc:identifier></metadata><manifest><item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chapter1"/></spine></package>'
    },
    {
      path: 'OEBPS/chapter1.xhtml',
      content: `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter 1</title></head><body><h1>Chapter 1</h1><p>${SAMPLE_TEXT}</p></body></html>`
    }
  ])
}

const generatePdfFromScratch = async (outPath: string): Promise<void> => {
  const text = SAMPLE_TEXT.replace(/[\\()]/g, '\\$&')
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`
  ]

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  for (let index = 0; index < objects.length; index++) {
    offsets.push(Buffer.byteLength(pdf, 'ascii'))
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`
  }

  const xrefOffset = Buffer.byteLength(pdf, 'ascii')
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`

  await Bun.write(outPath, pdf)
}

const generateCsvFromScratch = async (outPath: string): Promise<void> => {
  const content = 'id,name,value\n1,alpha,100\n2,beta,200\n3,gamma,300\n'
  await Bun.write(outPath, content)
}

const generateRtfFromScratch = async (outPath: string): Promise<void> => {
  const content = '{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}} \\f0\\fs24 Sample document for testing.}'
  await Bun.write(outPath, content)
}

const generateMarkdownFromScratch = async (outPath: string): Promise<void> => {
  const content = '# Sample TTS Text\n\nThis is a sample text file for text-to-speech testing.\n'
  await Bun.write(outPath, content)
}

const generateUrlListFromScratch = async (outPath: string): Promise<void> => {
  const content = '# URL List Sample\n\n- https://example.com/video1\n- https://example.com/video2\n'
  await Bun.write(outPath, content)
}

const generateMinimalPng = async (outPath: string): Promise<void> => {
  // 1x1 white PNG
  const pngBytes = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
    0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc,
    0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
    0x44, 0xae, 0x42, 0x60, 0x82
  ])
  await Bun.write(outPath, pngBytes)
}

const generateMinimalJpg = async (outPath: string): Promise<void> => {
  // Minimal JPEG
  const jpgBytes = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
    0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
    0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
    0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0a, 0x0b, 0xff, 0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03,
    0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7d,
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xfb, 0xff,
    0xd9
  ])
  await Bun.write(outPath, jpgBytes)
}

const generateMinimalTif = async (outPath: string): Promise<void> => {
  // Minimal TIFF (little-endian, 1x1 white)
  const tifBytes = new Uint8Array([
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, // II + magic + offset
    0x04, 0x00, // 4 IFD entries
    0x00, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, // ImageWidth = 1
    0x01, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, // ImageLength = 1
    0x11, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, 0x56, 0x00, 0x00, 0x00, // StripOffsets
    0x17, 0x01, 0x04, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, // StripByteCounts = 1
    0x00, 0x00, 0x00, 0x00, // next IFD offset = 0
    0xff // image data
  ])
  await Bun.write(outPath, tifBytes)
}

const generateImageWithMagick = async (outPath: string, _format: string): Promise<void> => {
  const result = await exec('convert', [
    '-size', '1x1', 'xc:white', outPath
  ])
  if (result.exitCode !== 0) {
    throw new Error(`ImageMagick failed for ${outPath}: ${result.stderr}`)
  }
}

// ─── Invalid fixtures ──────────────────────────────────────────────────────

const generateInvalidPdf = async (outPath: string): Promise<void> => {
  // Truncated PDF header (valid magic, truncated body)
  const bytes = new Uint8Array(64)
  const header = '%PDF-1.4\n%âãÏÓ\n'
  for (let i = 0; i < header.length && i < 64; i++) {
    bytes[i] = header.charCodeAt(i)
  }
  await Bun.write(outPath, bytes)
}

const generateInvalidZip = async (outPath: string): Promise<void> => {
  // ZIP signature followed by garbage
  const bytes = new Uint8Array([0x50, 0x4b, 0x00, 0x00, 0xff, 0xfe, 0xfd, 0xfc])
  await Bun.write(outPath, bytes)
}

const generateEmptyMp3 = async (outPath: string): Promise<void> => {
  await Bun.write(outPath, new Uint8Array(0))
}

const generateBinaryPng = async (outPath: string): Promise<void> => {
  // PNG extension but binary non-image content
  const bytes = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05])
  await Bun.write(outPath, bytes)
}

const generateMalformedCsv = async (outPath: string): Promise<void> => {
  // Unterminated quote
  const content = 'id,name\n1,"unterminated\n2,ok\n'
  await Bun.write(outPath, content)
}

const generateBinaryCsv = async (outPath: string): Promise<void> => {
  // Binary content with .csv extension
  const bytes = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x89, 0x50, 0x4e, 0x47])
  await Bun.write(outPath, bytes)
}

// ─── Main fixture generator ────────────────────────────────────────────────

export const generateFixture = async (
  fixture: FixtureDef,
  outDir: string,
  availableTools: Set<ToolName>
): Promise<GenerateResult> => {
  const filePath = join(outDir, fixture.path)
  await mkdir(dirname(filePath), { recursive: true })

  // Check required tools
  for (const tool of fixture.requiredTools) {
    if (!availableTools.has(tool)) {
      return { generated: false, reason: `missing-tool:${tool}` }
    }
  }

  try {
    const format = fixture.format

    if (fixture.validity === 'invalid') {
      switch (fixture.invalidReason) {
        case 'truncated-at-byte-64':
          await generateInvalidPdf(filePath)
          break
        case 'corrupt-zip-container':
          await generateInvalidZip(filePath)
          break
        case 'empty-file':
          await generateEmptyMp3(filePath)
          break
        case 'non-image-bytes-with-image-extension':
          await generateBinaryPng(filePath)
          break
        case 'malformed-csv-unterminated-quotes':
          await generateMalformedCsv(filePath)
          break
        case 'binary-content-with-csv-extension':
          await generateBinaryCsv(filePath)
          break
        default:
          await generateEmptyMp3(filePath)
      }
      return { generated: true }
    }

    switch (format) {
      case 'wav':
        await generateSilentAudio(filePath, 'wav')
        break
      case 'mp3':
        await generateSilentAudio(filePath, 'mp3')
        break
      case 'm4a':
        await generateSilentAudio(filePath, 'm4a')
        break
      case 'opus':
        await generateSilentAudio(filePath, 'opus')
        break
      case 'ogg':
        await generateSilentAudio(filePath, 'ogg')
        break
      case 'aac':
        await generateSilentAudio(filePath, 'aac')
        break
      case 'flac':
        await generateSilentAudio(filePath, 'flac')
        break
      case 'mp4':
      case 'mov':
        await generateSilentVideo(filePath, format)
        break
      case 'webm':
        await generateSilentVideo(filePath, 'webm')
        break
      case 'mkv':
        await generateSilentVideo(filePath, 'mkv')
        break
      case 'pdf':
        await generatePdfFromScratch(filePath)
        break
      case 'epub':
        await generateEpubFromScratch(filePath)
        break
      case 'docx':
        await generateDocxFromScratch(filePath)
        break
      case 'pptx':
        await generatePptxFromScratch(filePath)
        break
      case 'xlsx':
        await generateXlsxFromScratch(filePath)
        break
      case 'odt':
        await generateOdfFromScratch(filePath, 'application/vnd.oasis.opendocument.text')
        break
      case 'ods':
        await generateOdfFromScratch(filePath, 'application/vnd.oasis.opendocument.spreadsheet')
        break
      case 'odp':
        await generateOdfFromScratch(filePath, 'application/vnd.oasis.opendocument.presentation')
        break
      case 'rtf':
        await generateRtfFromScratch(filePath)
        break
      case 'csv':
        await generateCsvFromScratch(filePath)
        break
      case 'png':
        await generateMinimalPng(filePath)
        break
      case 'jpg':
      case 'jpeg':
        await generateMinimalJpg(filePath)
        break
      case 'tif':
      case 'tiff':
        await generateMinimalTif(filePath)
        break
      case 'webp':
      case 'bmp':
      case 'gif':
        await generateImageWithMagick(filePath, format)
        break
      case 'cbz': {
        const tmpPng = filePath + '.tmp.png'
        await generateMinimalPng(tmpPng)
        const pngBytes = new Uint8Array(await Bun.file(tmpPng).arrayBuffer())
        await rm(tmpPng, { force: true }).catch(() => {})
        await writeZipFixture(filePath, [{ path: 'page.png', content: pngBytes }])
        break
      }
      case 'mobi':
      case 'azw3':
      case 'fb2':
      case 'lit': {
        // Convert minimal HTML directly to target format via Calibre (supports HTML input natively)
        const tmpHtml = filePath + '.tmp.html'
        await Bun.write(tmpHtml, '<html><body><p>Sample document for testing.</p></body></html>')
        const convertResult = await exec(calibreBin('ebook-convert'), [tmpHtml, filePath])
        await rm(tmpHtml, { force: true }).catch(() => {})
        if (convertResult.exitCode !== 0) {
          throw new Error(`Calibre ebook-convert failed for ${filePath}: ${convertResult.stderr || convertResult.stdout}`)
        }
        break
      }
      case 'md':
        await generateMarkdownFromScratch(filePath)
        break
      case 'txt':
        await generateUrlListFromScratch(filePath)
        break
      default:
        throw new Error(`No generator implemented for format: ${format}`)
    }

    return { generated: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    l.error(`Failed to generate fixture ${fixture.path}: ${message}`)
    return { generated: false, reason: message }
  }
}
