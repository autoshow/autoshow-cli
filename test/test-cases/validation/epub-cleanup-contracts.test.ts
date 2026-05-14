import { expect, test } from 'bun:test'
import { cleanEpubHtmlToText } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/epub/cleanup'
import { inspectEpubWithReader } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/epub/inspect-core'
import { runEpubCalibreInspect } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/epub/run-epub-calibre-inspect'
import type { EpubContentReader } from '~/types'

const createReader = (files: Record<string, string>): EpubContentReader => ({
  adapterLabel: 'test',
  entries: Object.entries(files).map(([path, text]) => ({ path, size: text.length })),
  hasEntry: (entryPath: string) => Object.hasOwn(files, entryPath),
  readText: async (entryPath: string) => {
    const text = files[entryPath]
    if (typeof text !== 'string') {
      throw new Error(`Missing test EPUB entry: ${entryPath}`)
    }
    return text
  }
})

test('EPUB cleanup prefers body output and falls back to document text without body', async () => {
  await expect(cleanEpubHtmlToText('<section><p>Document fallback text.</p></section>'))
    .resolves.toBe('Document fallback text.')

  await expect(cleanEpubHtmlToText(`
    <html>
      <p>Document-level text before body.</p>
      <body><p>Body text only.</p></body>
      <p>Document-level text after body.</p>
    </html>
  `)).resolves.toBe('Body text only.')
})

test('EPUB cleanup skips metadata, scripts, styles, noscript, and footnote subtrees', async () => {
  const text = await cleanEpubHtmlToText(`
    <html>
      <head><title>Hidden Title</title></head>
      <body>
        <style>.hidden { display: none }</style>
        <script>hiddenScript()</script>
        <noscript>Hidden noscript text.</noscript>
        <p>Visible<sup>1</sup><a href="#fn1">note ref</a><span epub:type="noteref">label</span> text.</p>
        <section epub:type="endnotes"><p>Hidden child endnote text.</p></section>
      </body>
    </html>
  `)

  expect(text).toBe('Visible text.')
})

test('EPUB cleanup preserves block spacing, line breaks, and table cell tabs', async () => {
  const text = await cleanEpubHtmlToText(`
    <html>
      <body>
        <p>First paragraph.</p>
        <div>Second <em>paragraph</em>.</div>
        <p>Line one<br/>Line two<br>Line three.</p>
        <table>
          <tr><th>A</th><th>B</th></tr>
          <tr><td>C</td><td>D</td></tr>
        </table>
      </body>
    </html>
  `)

  expect(text).toBe([
    'First paragraph.',
    '',
    'Second paragraph.',
    '',
    'Line one',
    'Line two',
    'Line three.',
    '',
    'A\tB',
    '',
    'C\tD'
  ].join('\n'))
})

test('EPUB cleanup decodes numeric, XML, and common EPUB named entities', async () => {
  const text = await cleanEpubHtmlToText(`
    <html><body>
      <p>A&nbsp;B &amp; C &ndash; D &mdash; E &lsquo;F&rsquo; &ldquo;G&rdquo; &hellip; &copy; &reg; &trade; &#169; &#x2014; &unknown;</p>
    </body></html>
  `)

  expect(text).toBe('A B & C \u2013 D \u2014 E \u2018F\u2019 \u201cG\u201d \u2026 \u00a9 \u00ae \u2122 \u00a9 \u2014 &unknown;')
})

test('EPUB TOC heading matching uses cleaned HTML fragments', async () => {
  const inspected = await inspectEpubWithReader(createReader({
    'META-INF/container.xml': `
      <container>
        <rootfiles>
          <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
        </rootfiles>
      </container>
    `,
    'OEBPS/content.opf': `
      <package>
        <manifest>
          <item id="toc" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
          <item id="chapter1" href="Text/chapter1.xhtml" media-type="application/xhtml+xml"/>
        </manifest>
        <spine toc="toc"><itemref idref="chapter1"/></spine>
      </package>
    `,
    'OEBPS/toc.ncx': `
      <ncx>
        <navMap>
          <navPoint id="toc-ch1" playOrder="1">
            <navLabel><text>Chapter One</text></navLabel>
            <content src="Text/chapter1.xhtml#chapter-one-page"/>
          </navPoint>
        </navMap>
      </ncx>
    `,
    'OEBPS/Text/chapter1.xhtml': `
      <html>
        <head><title>Fragment Cleanup Book</title></head>
        <body>
          <a id="chapter-one-page"></a>
          <p>Page 1</p>
          <h1><span>Chapter&nbsp;One</span><sup>1</sup></h1>
          <p>Body text.</p>
        </body>
      </html>
    `
  }), 'bun')

  expect(inspected.payload.chapters[0]?.text).toBe('Chapter One\n\nBody text.')
})

test('EPUB nav TOC titles use cleaned HTML fragments', async () => {
  const inspected = await inspectEpubWithReader(createReader({
    'META-INF/container.xml': `
      <container>
        <rootfiles>
          <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
        </rootfiles>
      </container>
    `,
    'OEBPS/content.opf': `
      <package>
        <manifest>
          <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
          <item id="chapter1" href="Text/chapter1.xhtml" media-type="application/xhtml+xml"/>
        </manifest>
        <spine><itemref idref="chapter1"/></spine>
      </package>
    `,
    'OEBPS/nav.xhtml': `
      <html>
        <body>
          <nav epub:type="toc">
            <ol>
              <li><a href="Text/chapter1.xhtml"><span>Chapter&nbsp;One</span><sup>1</sup></a></li>
            </ol>
          </nav>
        </body>
      </html>
    `,
    'OEBPS/Text/chapter1.xhtml': `
      <html>
        <body>
          <h1>Chapter One</h1>
          <p>Body text.</p>
        </body>
      </html>
    `
  }), 'bun')

  expect(inspected.payload.toc.source).toBe('nav')
  expect(inspected.payload.toc.items[0]?.title).toBe('Chapter One')
  expect(inspected.payload.chapters[0]?.title).toBe('Chapter One')
})

test('--epub-calibre compatibility path uses the native Bun EPUB reader', async () => {
  const inspected = await runEpubCalibreInspect('input/examples/document/1-epub.epub')

  expect(inspected.payload.engine).toBe('calibre')
  expect(inspected.payload.diagnostics.adapter).toBe('bun-zip')
  expect(inspected.payload.chapters.length).toBeGreaterThan(0)
})
