import { describe, expect, test } from 'bun:test';
import { stripHtml, extractCDATA, getTagContent, getAttrValue, parseDate, parseRSSItems, loadProfile, listProfiles, buildScoringPrompt, buildSummaryPrompt } from './digest';
import type { DomainProfile } from './digest';

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

// ============================================================================
// Profile Loading
// ============================================================================

describe('loadProfile', () => {
  test('loads ai profile successfully', async () => {
    const profile = await loadProfile('ai');
    expect(profile.id).toBe('ai');
    expect(profile.name).toBe('AI 部落格每日精選');
    expect(profile.feeds.length).toBeGreaterThan(0);
    expect(profile.categories).toHaveProperty('ai-ml');
    expect(profile.categories).toHaveProperty('other');
    expect(profile.prompts.curatorRole).toContain('技術');
    expect(profile.report.title).toContain('AI');
  });

  test('loads quant profile successfully', async () => {
    const profile = await loadProfile('quant');
    expect(profile.id).toBe('quant');
    expect(profile.name).toBe('量化金融每日精選');
    expect(profile.feeds.length).toBeGreaterThan(0);
    expect(profile.categories).toHaveProperty('alpha-research');
    expect(profile.categories).toHaveProperty('risk-management');
    expect(profile.prompts.curatorRole).toContain('量化');
    expect(profile.report.title).toContain('量化');
  });

  test('throws for non-existent profile', async () => {
    await expect(loadProfile('nonexistent')).rejects.toThrow('Profile "nonexistent" not found');
  });

  test('profile has all required fields', async () => {
    const profile = await loadProfile('ai');
    // Check DomainProfile structure
    expect(typeof profile.id).toBe('string');
    expect(typeof profile.name).toBe('string');
    expect(typeof profile.description).toBe('string');
    expect(Array.isArray(profile.feeds)).toBe(true);
    expect(typeof profile.categories).toBe('object');
    expect(typeof profile.prompts).toBe('object');
    expect(typeof profile.prompts.curatorRole).toBe('string');
    expect(typeof profile.prompts.audience).toBe('string');
    expect(typeof profile.prompts.relevanceRubric).toBe('object');
    expect(typeof profile.prompts.categoryDescriptions).toBe('object');
    expect(typeof profile.prompts.keywordInstruction).toBe('string');
    expect(typeof profile.prompts.summaryRole).toBe('string');
    expect(typeof profile.prompts.summaryDomainHint).toBe('string');
    expect(typeof profile.prompts.highlightsDomain).toBe('string');
    expect(typeof profile.report).toBe('object');
    expect(typeof profile.report.title).toBe('string');
    expect(typeof profile.report.subtitle).toBe('string');
    expect(Array.isArray(profile.report.footerLines)).toBe(true);
  });

  test('feed entries have required fields', async () => {
    const profile = await loadProfile('ai');
    for (const feed of profile.feeds) {
      expect(typeof feed.name).toBe('string');
      expect(typeof feed.xmlUrl).toBe('string');
      expect(typeof feed.htmlUrl).toBe('string');
    }
  });

  test('category entries have emoji and label', async () => {
    const profile = await loadProfile('quant');
    for (const [, meta] of Object.entries(profile.categories)) {
      expect(typeof meta.emoji).toBe('string');
      expect(typeof meta.label).toBe('string');
    }
  });
});

describe('listProfiles', () => {
  test('returns available profile names', async () => {
    const profiles = await listProfiles();
    expect(profiles).toContain('ai');
    expect(profiles).toContain('quant');
  });

  test('returns array of strings', async () => {
    const profiles = await listProfiles();
    expect(Array.isArray(profiles)).toBe(true);
    for (const name of profiles) {
      expect(typeof name).toBe('string');
    }
  });
});

// ============================================================================
// Parameterized Prompt Building
// ============================================================================

const mockProfile: DomainProfile = {
  id: 'test',
  name: 'Test Profile',
  description: 'A test profile',
  feeds: [],
  categories: {
    'cat-a': { emoji: '🅰️', label: 'Category A' },
    'cat-b': { emoji: '🅱️', label: 'Category B' },
    'other': { emoji: '📝', label: 'Other' },
  },
  prompts: {
    curatorRole: 'You are a test curator.',
    audience: 'test audience value',
    relevanceRubric: {
      score10: 'top score description',
      score7to9: 'high score description',
      score4to6: 'mid score description',
      score1to3: 'low score description',
    },
    categoryDescriptions: {
      'cat-a': 'Description for category A',
      'cat-b': 'Description for category B',
      'other': 'Everything else',
    },
    keywordInstruction: 'use test keywords like "foo", "bar"',
    summaryRole: 'You are a test summary expert.',
    summaryDomainHint: 'test-specific terms and data',
    highlightsDomain: 'test domain',
  },
  report: {
    title: '# Test Report',
    subtitle: '> From {totalFeeds} sources, Top {topN}',
    footerLines: ['*Test footer line*'],
  },
};

describe('buildScoringPrompt with profile', () => {
  const articles = [
    { index: 0, title: 'Test Article', description: 'A test description', sourceName: 'test-source' },
  ];

  test('includes curatorRole from profile', () => {
    const prompt = buildScoringPrompt(articles, mockProfile);
    expect(prompt).toContain('You are a test curator.');
  });

  test('includes audience from profile', () => {
    const prompt = buildScoringPrompt(articles, mockProfile);
    expect(prompt).toContain('test audience value');
  });

  test('includes relevance rubric from profile', () => {
    const prompt = buildScoringPrompt(articles, mockProfile);
    expect(prompt).toContain('top score description');
    expect(prompt).toContain('high score description');
    expect(prompt).toContain('mid score description');
    expect(prompt).toContain('low score description');
  });

  test('includes category descriptions from profile', () => {
    const prompt = buildScoringPrompt(articles, mockProfile);
    expect(prompt).toContain('cat-a: Description for category A');
    expect(prompt).toContain('cat-b: Description for category B');
  });

  test('includes keyword instruction from profile', () => {
    const prompt = buildScoringPrompt(articles, mockProfile);
    expect(prompt).toContain('use test keywords like "foo", "bar"');
  });

  test('includes article data', () => {
    const prompt = buildScoringPrompt(articles, mockProfile);
    expect(prompt).toContain('Test Article');
    expect(prompt).toContain('test-source');
  });
});

describe('buildSummaryPrompt with profile', () => {
  const articles = [
    { index: 0, title: 'Test Article', description: 'A test description', sourceName: 'test-source', link: 'https://example.com' },
  ];

  test('includes summaryRole from profile', () => {
    const prompt = buildSummaryPrompt(articles, 'zh', mockProfile);
    expect(prompt).toContain('You are a test summary expert.');
  });

  test('includes summaryDomainHint from profile', () => {
    const prompt = buildSummaryPrompt(articles, 'zh', mockProfile);
    expect(prompt).toContain('test-specific terms and data');
  });

  test('respects lang=zh', () => {
    const prompt = buildSummaryPrompt(articles, 'zh', mockProfile);
    expect(prompt).toContain('繁體中文');
  });

  test('respects lang=en', () => {
    const prompt = buildSummaryPrompt(articles, 'en', mockProfile);
    expect(prompt).toContain('Write summaries');
  });

  test('includes article data', () => {
    const prompt = buildSummaryPrompt(articles, 'zh', mockProfile);
    expect(prompt).toContain('Test Article');
    expect(prompt).toContain('https://example.com');
  });
});
