import { join, dirname } from 'node:path'
import { mkdir, mkdtemp, rename, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
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

const SAMPLE_HTML = '<html><body><p>Sample document for testing.</p></body></html>'

const generateViaLibreOffice = async (
  outPath: string,
  targetExt: string,
  sourceExt: string,
  sourceContent: string,
  intermediateExt?: string
): Promise<void> => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'autoshow-sample-'))
  try {
    const srcFile = join(tmpDir, `source.${sourceExt}`)
    await Bun.write(srcFile, sourceContent)

    let convertFrom = srcFile
    if (intermediateExt) {
      const intResult = await exec('soffice', ['--headless', '--convert-to', intermediateExt, '--outdir', tmpDir, srcFile])
      if (intResult.exitCode !== 0) {
        throw new Error(`LibreOffice ${sourceExt}→${intermediateExt} failed: ${intResult.stderr}`)
      }
      convertFrom = join(tmpDir, `source.${intermediateExt}`)
    }

    const result = await exec('soffice', ['--headless', '--convert-to', targetExt, '--outdir', tmpDir, convertFrom])
    if (result.exitCode !== 0) {
      throw new Error(`LibreOffice ${intermediateExt ?? sourceExt}→${targetExt} failed: ${result.stderr}`)
    }
    await rename(join(tmpDir, `source.${targetExt}`), outPath)
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }
}

// FODS (flat-XML spreadsheet) → ODS/XLSX (LibreOffice Calc handles FODS natively)
const MINIMAL_FODS = `<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:mimetype="application/vnd.oasis.opendocument.spreadsheet">
<office:body><office:spreadsheet>
<table:table table:name="Sheet1">
<table:table-row><table:table-cell><text:p>ID</text:p></table:table-cell><table:table-cell><text:p>Name</text:p></table:table-cell></table:table-row>
<table:table-row><table:table-cell><text:p>1</text:p></table:table-cell><table:table-cell><text:p>Sample</text:p></table:table-cell></table:table-row>
</table:table>
</office:spreadsheet></office:body></office:document>`

// FODP (flat-XML presentation) → ODP/PPTX (LibreOffice Impress handles FODP natively)
const MINIMAL_FODP = `<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" office:mimetype="application/vnd.oasis.opendocument.presentation">
<office:body><office:presentation>
<draw:page draw:name="Slide1" draw:master-page-name="">
<draw:frame draw:layer="layout" svg:width="25cm" svg:height="2cm" svg:x="1cm" svg:y="1cm">
<draw:text-box><text:p>Sample document for testing.</text:p></draw:text-box>
</draw:frame>
</draw:page>
</office:presentation></office:body></office:document>`

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
      case 'odt':
        await generateViaLibreOffice(filePath, format, 'html', SAMPLE_HTML)
        break
      case 'epub':
      case 'docx':
        await generateViaLibreOffice(filePath, format, 'html', SAMPLE_HTML, 'odt')
        break
      case 'ods':
      case 'xlsx':
        await generateViaLibreOffice(filePath, format, 'fods', MINIMAL_FODS)
        break
      case 'odp':
      case 'pptx':
        await generateViaLibreOffice(filePath, format, 'fodp', MINIMAL_FODP)
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
        // Create a ZIP with a minimal PNG image
        const tmpPng = filePath + '.tmp.png'
        await generateMinimalPng(tmpPng)
        const zipResult = await exec('zip', ['-j', filePath, tmpPng])
        await rm(tmpPng, { force: true }).catch(() => {})
        if (zipResult.exitCode !== 0) {
          throw new Error(`zip failed for CBZ ${filePath}: ${zipResult.stderr}`)
        }
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
