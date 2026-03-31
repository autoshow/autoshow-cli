import { describe, expect, test } from 'bun:test'
import { stripCdata, decodeXmlEntities } from '~/utils/xml-scan'

describe('stripCdata', () => {
  test('returns unchanged string with no CDATA sections', () => {
    expect(stripCdata('Hello world')).toBe('Hello world')
  })

  test('strips single CDATA section', () => {
    expect(stripCdata('<![CDATA[inner content]]>')).toBe('inner content')
  })

  test('strips multiple CDATA sections', () => {
    expect(stripCdata('before<![CDATA[first]]>middle<![CDATA[second]]>after'))
      .toBe('beforefirstmiddlesecondafter')
  })

  test('handles unclosed CDATA gracefully', () => {
    const result = stripCdata('text<![CDATA[unclosed content')
    expect(result).toContain('text')
    expect(result).toContain('<![CDATA[unclosed content')
  })

  test('handles empty CDATA', () => {
    expect(stripCdata('<![CDATA[]]>')).toBe('')
  })

  test('returns empty string for empty input', () => {
    expect(stripCdata('')).toBe('')
  })
})

describe('decodeXmlEntities', () => {
  test('decodes named entities', () => {
    expect(decodeXmlEntities('&amp;')).toBe('&')
    expect(decodeXmlEntities('&lt;')).toBe('<')
    expect(decodeXmlEntities('&gt;')).toBe('>')
    expect(decodeXmlEntities('&quot;')).toBe('"')
    expect(decodeXmlEntities('&apos;')).toBe("'")
  })

  test('decodes decimal numeric entities', () => {
    expect(decodeXmlEntities('&#65;')).toBe('A')
    expect(decodeXmlEntities('&#97;')).toBe('a')
  })

  test('decodes hex numeric entities', () => {
    expect(decodeXmlEntities('&#x41;')).toBe('A')
    expect(decodeXmlEntities('&#x61;')).toBe('a')
  })

  test('handles mixed entities in text', () => {
    expect(decodeXmlEntities('Tom &amp; Jerry &lt;3')).toBe('Tom & Jerry <3')
  })

  test('leaves unknown entities unchanged', () => {
    expect(decodeXmlEntities('&unknown;')).toBe('&unknown;')
  })

  test('returns unchanged string with no entities', () => {
    expect(decodeXmlEntities('plain text')).toBe('plain text')
  })

  test('returns empty string for empty input', () => {
    expect(decodeXmlEntities('')).toBe('')
  })
})
