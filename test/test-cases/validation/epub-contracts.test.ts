import { expect, test } from 'bun:test'
import { cleanEpubHtmlToText } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/epub/cleanup'
import { inspectEpubWithReader } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/epub/inspect-core'
import { runEpubCalibreInspect } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/epub/run-epub-calibre-inspect'
import { buildEpubTextOutput } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/epub/export'
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

const WINDOWS_1252_TEST_BYTES: Record<string, number> = {
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '–': 0x96,
  '—': 0x97,
  '…': 0x85
}

const encodeLegacyPuaText = (text: string): string =>
  Array.from(text).map((char) => {
    const byte = WINDOWS_1252_TEST_BYTES[char] ?? char.codePointAt(0)
    if (byte === undefined || byte > 0xff) {
      throw new Error(`Test helper cannot encode character: ${char}`)
    }
    return String.fromCodePoint(0xf000 + byte)
  }).join('')

const encodeReversedLegacyPuaText = (text: string): string =>
  Array.from(text).map((char) => {
    const byte = WINDOWS_1252_TEST_BYTES[char] ?? char.codePointAt(0)
    if (byte === undefined || byte > 0xff) {
      throw new Error(`Test helper cannot encode character: ${char}`)
    }
    return String.fromCodePoint(0xf000 + (byte === 0x20 ? 0x20 : 0x120 - byte))
  }).join('')

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

  expect(text).toBe('A B & C – D — E ‘F’ “G” … © ® ™ © — &unknown;')
})

test('EPUB cleanup decodes dense legacy PUA Windows-1252 text content', async () => {
  const encodedText = encodeLegacyPuaText('He said “Hello” — then left...')
  const text = await cleanEpubHtmlToText(`
    <html><body>
      <p data-title="${encodedText}">${encodedText}</p>
    </body></html>
  `)

  expect(text).toBe('He said “Hello” — then left...')
})

test('EPUB cleanup decodes reversed legacy PUA byte mapping', async () => {
  const encodedText = encodeReversedLegacyPuaText('Top: H.G. Wells. “Only”')
  const text = await cleanEpubHtmlToText(`
    <html><body>
      <p>${encodedText}</p>
      <p>Chapter <span>${encodeReversedLegacyPuaText('28')}</span>:</p>
    </body></html>
  `)

  expect(text).toBe('Top: H.G. Wells. “Only”\n\nChapter 28:')
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

test('EPUB chapter export groups spine fragments by TOC starts', async () => {
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
          <item id="preface" href="Text/preface.xhtml" media-type="application/xhtml+xml"/>
          <item id="ch1" href="Text/CR%21-ch1.xhtml" media-type="application/xhtml+xml"/>
          <item id="ch1b" href="Text/ch1b.xhtml" media-type="application/xhtml+xml"/>
          <item id="notes" href="Text/notes.xhtml" media-type="application/xhtml+xml"/>
          <item id="ch2" href="Text/ch2.xhtml" media-type="application/xhtml+xml"/>
        </manifest>
        <spine toc="toc">
          <itemref idref="preface"/>
          <itemref idref="ch1"/>
          <itemref idref="ch1b"/>
          <itemref idref="notes"/>
          <itemref idref="ch2"/>
        </spine>
      </package>
    `,
    'OEBPS/toc.ncx': `
      <ncx>
        <navMap>
          <navPoint id="toc-ch1" playOrder="1">
            <navLabel><text>Chapter One</text></navLabel>
            <content src="Text/CR%21-ch1.xhtml"/>
          </navPoint>
          <navPoint id="toc-ch2" playOrder="2">
            <navLabel><text>Chapter Two</text></navLabel>
            <content src="Text/ch2.xhtml"/>
          </navPoint>
        </navMap>
      </ncx>
    `,
    'OEBPS/Text/preface.xhtml': '<html><head><title>Generic Book</title></head><body><p>Preface text.</p></body></html>',
    'OEBPS/Text/CR!-ch1.xhtml': '<html><head><title>Generic Book</title></head><body><p>Chapter one start.</p></body></html>',
    'OEBPS/Text/ch1b.xhtml': '<html><head><title>Generic Book</title></head><body><p>Chapter one continuation.</p></body></html>',
    'OEBPS/Text/notes.xhtml': '<html><head><title>Generic Book</title></head><body><p>Footnote detail.</p></body></html>',
    'OEBPS/Text/ch2.xhtml': '<html><head><title>Generic Book</title></head><body><p>Chapter two start.</p></body></html>'
  }), 'bun')

  const tocMatchedChapter = inspected.payload.chapters.find((chapter) => chapter.path === 'OEBPS/Text/CR!-ch1.xhtml')
  expect(tocMatchedChapter?.title).toBe('Chapter One')
  expect(tocMatchedChapter?.isTocStart).toBe(true)

  const output = buildEpubTextOutput('book', inspected.payload.chapters, { chapterFiles: true })

  expect(output.exportPlan?.summary.logicalChapterSource).toBe('toc')
  expect(output.exportPlan?.summary.logicalChapterCount).toBe(2)
  expect(output.exportPlan?.summary.tocStartSections).toBe(2)
  expect(output.exportPlan?.summary.prefaceSectionsDropped).toBe(1)
  expect(output.exportPlan?.files.map((file) => file.relativePath)).toEqual([
    'chapters/001-chapter-one.txt',
    'chapters/002-chapter-two.txt'
  ])
  expect(output.exportPlan?.files[0]?.text).toContain('Chapter one start.')
  expect(output.exportPlan?.files[0]?.text).toContain('Chapter one continuation.')
  expect(output.exportPlan?.files[0]?.text).toContain('Footnote detail.')
  expect(output.exportPlan?.files[0]?.text).not.toContain('Preface text.')
})

test('EPUB chapter export splits multiple TOC fragments within one spine file', async () => {
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
          <item id="multi" href="Text/multi.xhtml" media-type="application/xhtml+xml"/>
          <item id="tail" href="Text/tail.xhtml" media-type="application/xhtml+xml"/>
        </manifest>
        <spine toc="toc">
          <itemref idref="multi"/>
          <itemref idref="tail"/>
        </spine>
      </package>
    `,
    'OEBPS/toc.ncx': `
      <ncx>
        <navMap>
          <navPoint id="toc-contents" playOrder="1">
            <navLabel><text>Table of Contents</text></navLabel>
            <content src="Text/multi.xhtml#toc"/>
          </navPoint>
          <navPoint id="toc-intro" playOrder="2">
            <navLabel><text>Introduction</text></navLabel>
            <content src="Text/multi.xhtml#intro-page"/>
          </navPoint>
          <navPoint id="toc-one" playOrder="3">
            <navLabel><text>Chapter One</text></navLabel>
            <content src="Text/multi.xhtml#chapter-one-page"/>
          </navPoint>
          <navPoint id="toc-two" playOrder="4">
            <navLabel><text>Chapter Two</text></navLabel>
            <content src="Text/multi.xhtml#chapter-two-anchor"/>
          </navPoint>
          <navPoint id="toc-three" playOrder="5">
            <navLabel><text>Chapter Three</text></navLabel>
            <content src="Text/tail.xhtml#chapter-three-page"/>
          </navPoint>
        </navMap>
      </ncx>
    `,
    'OEBPS/Text/multi.xhtml': `
      <html>
        <head><title>Fragmented Book</title></head>
        <body>
          <nav id="toc">
            <h1>Table of Contents</h1>
            <ol>
              <li>Introduction</li>
              <li>Chapter One</li>
              <li>Chapter Two</li>
              <li>Chapter Three</li>
            </ol>
          </nav>
          <a id="intro-page"></a>
          <p>Page 1</p>
          <h1>Introduction</h1>
          <p>Intro body.</p>
          <a id="chapter-one-page"></a>
          <p>Page 2</p>
          <h1>Chapter One</h1>
          <p>One body.</p>
          <h1>Chapter Two</h1>
          <a id="chapter-two-anchor"></a>
          <p>Two body starts after an anchor that follows the heading.</p>
        </body>
      </html>
    `,
    'OEBPS/Text/tail.xhtml': `
      <html>
        <head><title>Fragmented Book</title></head>
        <body>
          <p>Two body continues in the next spine file before chapter three.</p>
          <a id="chapter-three-page"></a>
          <p>Page 3</p>
          <h1>Chapter Three</h1>
          <p>Three body.</p>
        </body>
      </html>
    `
  }), 'bun')

  expect(inspected.payload.toc.items.map((item) => item.fragment)).toEqual([
    'toc',
    'intro-page',
    'chapter-one-page',
    'chapter-two-anchor',
    'chapter-three-page'
  ])

  const output = buildEpubTextOutput('book', inspected.payload.chapters, { chapterFiles: true })
  const files = output.exportPlan?.files ?? []

  expect(output.exportPlan?.summary.logicalChapterSource).toBe('toc')
  expect(output.exportPlan?.summary.logicalChapterCount).toBe(5)
  expect(output.exportPlan?.summary.tocStartSections).toBe(5)
  expect(files.map((file) => file.relativePath)).toEqual([
    'chapters/001-table-of-contents.txt',
    'chapters/002-introduction.txt',
    'chapters/003-chapter-one.txt',
    'chapters/004-chapter-two.txt',
    'chapters/005-chapter-three.txt'
  ])

  expect(files[1]?.text).toStartWith('Introduction')
  expect(files[2]?.text).toStartWith('Chapter One')
  expect(files[2]?.text).not.toContain('Chapter Two')
  expect(files[3]?.text).toStartWith('Chapter Two')
  expect(files[3]?.text).toContain('Two body continues in the next spine file before chapter three.')
  expect(files[3]?.text).not.toContain('Chapter Three')
  expect(files[4]?.text).toStartWith('Chapter Three')
  expect(files[4]?.text).not.toContain('Two body continues in the next spine file before chapter three.')
})

test('EPUB chapter export ignores page-list TOCs and groups decoded heading sections', async () => {
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
          <item id="page1" href="Text/page1.xhtml" media-type="application/xhtml+xml"/>
          <item id="page2" href="Text/page2.xhtml" media-type="application/xhtml+xml"/>
          <item id="page3" href="Text/page3.xhtml" media-type="application/xhtml+xml"/>
          <item id="page4" href="Text/page4.xhtml" media-type="application/xhtml+xml"/>
        </manifest>
        <spine toc="toc">
          <itemref idref="page1"/>
          <itemref idref="page2"/>
          <itemref idref="page3"/>
          <itemref idref="page4"/>
        </spine>
      </package>
    `,
    'OEBPS/toc.ncx': `
      <ncx>
        <navMap>
          <navPoint id="page1" playOrder="1">
            <navLabel><text>page1</text></navLabel>
            <content src="Text/page1.xhtml"/>
          </navPoint>
          <navPoint id="page2" playOrder="2">
            <navLabel><text>page2</text></navLabel>
            <content src="Text/page2.xhtml"/>
          </navPoint>
          <navPoint id="page3" playOrder="3">
            <navLabel><text>page3</text></navLabel>
            <content src="Text/page3.xhtml"/>
          </navPoint>
          <navPoint id="page4" playOrder="4">
            <navLabel><text>page4</text></navLabel>
            <content src="Text/page4.xhtml"/>
          </navPoint>
        </navMap>
      </ncx>
    `,
    'OEBPS/Text/page1.xhtml': `
      <html><body>
        <p>${encodeLegacyPuaText('Introduction:')}</p>
        <p>${encodeLegacyPuaText('Opening “decoded” text.')}</p>
      </body></html>
    `,
    'OEBPS/Text/page2.xhtml': `
      <html><body>
        <p>${encodeLegacyPuaText('This page continues the introduction — without a new heading.')}</p>
      </body></html>
    `,
    'OEBPS/Text/page3.xhtml': `
      <html><body>
        <p>${encodeLegacyPuaText('Chapter 1:')}</p>
        <p>${encodeLegacyPuaText('First chapter starts here.')}</p>
      </body></html>
    `,
    'OEBPS/Text/page4.xhtml': `
      <html><body>
        <p>${encodeLegacyPuaText('Finality')}</p>
        <p>${encodeLegacyPuaText('Closing thought…')}</p>
      </body></html>
    `
  }), 'bun')

  const output = buildEpubTextOutput('book', inspected.payload.chapters, { chapterFiles: true })
  const files = output.exportPlan?.files ?? []

  expect(output.text).toContain('Opening “decoded” text.')
  expect(output.text).not.toMatch(/[-]/)
  expect(output.exportPlan?.summary.logicalChapterSource).toBe('heading')
  expect(output.exportPlan?.summary.tocStartSections).toBe(4)
  expect(output.exportPlan?.summary.pageLikeTocStartsIgnored).toBe(4)
  expect(files.map((file) => file.relativePath)).toEqual([
    'chapters/001-introduction.txt',
    'chapters/002-chapter-1.txt',
    'chapters/003-finality.txt'
  ])
  expect(files[0]?.text).toContain('This page continues the introduction — without a new heading.')
  expect(files[0]?.relativePath).not.toContain('page')
})
