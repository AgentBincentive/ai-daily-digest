import { describe, expect, test } from 'bun:test';
import { stripHtml, extractCDATA, getTagContent, getAttrValue, parseDate, parseRSSItems } from './digest';

// ============================================================================
// stripHtml
// ============================================================================

describe('stripHtml', () => {
  test('removes HTML tags', () => {
    expect(stripHtml('<p>Hello <b>world</b></p>')).toBe('Hello world');
  });

  test('decodes &amp; entity', () => {
    expect(stripHtml('A &amp; B')).toBe('A & B');
  });

  test('decodes &lt; and &gt;', () => {
    expect(stripHtml('&lt;div&gt;')).toBe('<div>');
  });

  test('decodes &quot; and &#39;', () => {
    expect(stripHtml('&quot;hello&#39;s&quot;')).toBe('"hello\'s"');
  });

  test('decodes &nbsp;', () => {
    expect(stripHtml('hello&nbsp;world')).toBe('hello world');
  });

  test('decodes numeric entities', () => {
    expect(stripHtml('&#65;&#66;')).toBe('AB');
  });

  test('trims whitespace', () => {
    expect(stripHtml('  hello  ')).toBe('hello');
  });

  test('handles empty string', () => {
    expect(stripHtml('')).toBe('');
  });
});

// ============================================================================
// extractCDATA
// ============================================================================

describe('extractCDATA', () => {
  test('extracts CDATA content', () => {
    expect(extractCDATA('<![CDATA[Hello World]]>')).toBe('Hello World');
  });

  test('extracts CDATA with HTML inside', () => {
    expect(extractCDATA('<![CDATA[<p>Hello</p>]]>')).toBe('<p>Hello</p>');
  });

  test('returns original text when no CDATA', () => {
    expect(extractCDATA('plain text')).toBe('plain text');
  });

  test('handles multiline CDATA', () => {
    expect(extractCDATA('<![CDATA[line1\nline2]]>')).toBe('line1\nline2');
  });
});

// ============================================================================
// getTagContent
// ============================================================================

describe('getTagContent', () => {
  test('extracts simple tag content', () => {
    expect(getTagContent('<title>My Title</title>', 'title')).toBe('My Title');
  });

  test('extracts tag with attributes', () => {
    expect(getTagContent('<title type="text">My Title</title>', 'title')).toBe('My Title');
  });

  test('extracts CDATA within tag', () => {
    expect(getTagContent('<description><![CDATA[Hello]]></description>', 'description')).toBe('Hello');
  });

  test('returns empty for missing tag', () => {
    expect(getTagContent('<title>Hello</title>', 'missing')).toBe('');
  });

  test('case insensitive matching', () => {
    expect(getTagContent('<TITLE>Hello</TITLE>', 'title')).toBe('Hello');
  });

  test('extracts namespaced tag', () => {
    expect(getTagContent('<dc:date>2024-01-01</dc:date>', 'dc:date')).toBe('2024-01-01');
  });
});

// ============================================================================
// getAttrValue
// ============================================================================

describe('getAttrValue', () => {
  test('extracts attribute with double quotes', () => {
    expect(getAttrValue('<link href="https://example.com"/>', 'link', 'href')).toBe('https://example.com');
  });

  test('extracts attribute with single quotes', () => {
    expect(getAttrValue("<link href='https://example.com'/>", 'link', 'href')).toBe('https://example.com');
  });

  test('extracts attribute from non-self-closing tag', () => {
    expect(getAttrValue('<link href="https://example.com">text</link>', 'link', 'href')).toBe('https://example.com');
  });

  test('returns empty for missing attribute', () => {
    expect(getAttrValue('<link href="url"/>', 'link', 'missing')).toBe('');
  });

  test('returns empty for missing tag', () => {
    expect(getAttrValue('<div>hello</div>', 'link', 'href')).toBe('');
  });
});

// ============================================================================
// parseDate
// ============================================================================

describe('parseDate', () => {
  test('parses ISO 8601 date', () => {
    const d = parseDate('2024-01-15T10:30:00Z');
    expect(d).not.toBeNull();
    expect(d!.getUTCFullYear()).toBe(2024);
    expect(d!.getUTCMonth()).toBe(0);
    expect(d!.getUTCDate()).toBe(15);
  });

  test('parses RFC 2822 date', () => {
    const d = parseDate('Mon, 15 Jan 2024 10:30:00 GMT');
    expect(d).not.toBeNull();
    expect(d!.getUTCFullYear()).toBe(2024);
  });

  test('returns null for empty string', () => {
    expect(parseDate('')).toBeNull();
  });

  test('returns null for invalid date', () => {
    expect(parseDate('not-a-date')).toBeNull();
  });

  test('parses date with timezone offset', () => {
    const d = parseDate('2024-01-15T10:30:00+08:00');
    expect(d).not.toBeNull();
    expect(d!.getUTCFullYear()).toBe(2024);
  });
});

// ============================================================================
// parseRSSItems
// ============================================================================

describe('parseRSSItems', () => {
  test('parses RSS items', () => {
    const xml = `
      <rss version="2.0">
        <channel>
          <item>
            <title>Article One</title>
            <link>https://example.com/1</link>
            <pubDate>Mon, 15 Jan 2024 10:00:00 GMT</pubDate>
            <description>First article description</description>
          </item>
          <item>
            <title>Article Two</title>
            <link>https://example.com/2</link>
            <pubDate>Tue, 16 Jan 2024 12:00:00 GMT</pubDate>
            <description>Second article description</description>
          </item>
        </channel>
      </rss>`;

    const items = parseRSSItems(xml);
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe('Article One');
    expect(items[0].link).toBe('https://example.com/1');
    expect(items[1].title).toBe('Article Two');
  });

  test('parses Atom entries', () => {
    const xml = `
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <title>Atom Article</title>
          <link href="https://example.com/atom1" rel="alternate"/>
          <published>2024-01-15T10:00:00Z</published>
          <summary>Atom summary</summary>
        </entry>
      </feed>`;

    const items = parseRSSItems(xml);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Atom Article');
    expect(items[0].link).toBe('https://example.com/atom1');
    expect(items[0].pubDate).toBe('2024-01-15T10:00:00Z');
  });

  test('handles CDATA in RSS items', () => {
    const xml = `
      <rss version="2.0">
        <channel>
          <item>
            <title><![CDATA[CDATA Title]]></title>
            <link>https://example.com/cdata</link>
            <description><![CDATA[<p>Rich content</p>]]></description>
          </item>
        </channel>
      </rss>`;

    const items = parseRSSItems(xml);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('CDATA Title');
    expect(items[0].description).toBe('Rich content');
  });

  test('returns empty array for empty XML', () => {
    expect(parseRSSItems('')).toHaveLength(0);
  });

  test('truncates long descriptions to 500 chars', () => {
    const longDesc = 'x'.repeat(1000);
    const xml = `
      <rss version="2.0">
        <channel>
          <item>
            <title>Long</title>
            <link>https://example.com</link>
            <description>${longDesc}</description>
          </item>
        </channel>
      </rss>`;

    const items = parseRSSItems(xml);
    expect(items[0].description.length).toBeLessThanOrEqual(500);
  });
});
