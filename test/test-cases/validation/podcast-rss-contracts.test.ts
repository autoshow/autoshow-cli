import { describe, expect, test } from 'bun:test'
import { parsePodcastFeedXml } from '~/cli/commands/process-steps/step-1-download/targets/podcast-rss'

describe('podcast RSS parsing contracts', () => {
  test('ignores image enclosures and selects downloadable media enclosures', () => {
    const parsed = parsePodcastFeedXml(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Fixture Feed</title>
    <item>
      <guid>episode-a</guid>
      <title>Episode A</title>
      <enclosure url="https://example.test/artwork.jpg" length="1234" type="image/jpeg" />
      <enclosure url="https://example.test/audio-a.mp3" length="2345" type="audio/mpeg" />
    </item>
    <item>
      <guid>image-only</guid>
      <title>Image Only</title>
      <enclosure url="https://example.test/card.png" length="1234" type="image/png" />
    </item>
    <item>
      <guid>episode-b</guid>
      <title>Episode B</title>
      <enclosure url="https://example.test/audio-b.m4a?download=1" length="3456" />
    </item>
  </channel>
</rss>`, 'https://example.test/feed')

    expect(parsed?.episodes.map(ep => ({
      id: ep.id,
      title: ep.title,
      enclosureUrl: ep.enclosureUrl
    }))).toEqual([
      {
        id: 'episode-a',
        title: 'Episode A',
        enclosureUrl: 'https://example.test/audio-a.mp3'
      },
      {
        id: 'episode-b',
        title: 'Episode B',
        enclosureUrl: 'https://example.test/audio-b.m4a?download=1'
      }
    ])
  })

  test('ignores image Atom enclosure links', () => {
    const parsed = parsePodcastFeedXml(`<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Fixture Atom Feed</title>
  <entry>
    <id>atom-episode</id>
    <title>Atom Episode</title>
    <link rel="enclosure" href="https://example.test/atom-image.png" type="image/png" />
    <link rel="enclosure" href="https://example.test/atom-audio.ogg" type="audio/ogg" />
  </entry>
</feed>`, 'https://example.test/atom')

    expect(parsed?.episodes).toHaveLength(1)
    expect(parsed?.episodes[0]?.enclosureUrl).toBe('https://example.test/atom-audio.ogg')
  })
})
