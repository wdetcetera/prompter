import axios from 'axios';
import { UrlCrawler } from '../url-crawler';
import { SourceConfig } from '../../types/config';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('UrlCrawler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.create.mockReturnValue(mockedAxios as any);
  });

  it('should fetch content from a single URL', async () => {
    const htmlContent = `
      <html>
        <head>
          <title>Test Page</title>
          <meta name="description" content="Test description">
        </head>
        <body>
          <h1>Test Content</h1>
          <a href="https://example.com/page1">Link 1</a>
          <a href="https://example.com/page2">Link 2</a>
        </body>
      </html>
    `;

    mockedAxios.get.mockResolvedValueOnce({
      data: htmlContent,
      headers: {
        'content-type': 'text/html',
        'last-modified': new Date().toUTCString(),
      },
      status: 200,
    });

    const config: SourceConfig = {
      type: 'url',
      location: 'https://example.com',
      options: {
        depth: 0,
      },
    };

    const crawler = new UrlCrawler(config);
    const result = await crawler.fetch();

    expect(result.items).toHaveLength(1);
    expect(result.metadata.stats.totalItems).toBe(1);
    expect(result.metadata.stats.errors).toBe(0);

    const item = result.items[0];
    expect(item.type).toBe('html');
    expect(item.path).toBe('https://example.com');
    expect(item.metadata?.title).toBe('Test Page');
    expect(item.metadata?.description).toBe('Test description');
    expect(item.metadata?.links).toHaveLength(2);
  });

  it('should crawl multiple pages respecting depth', async () => {
    const baseHtml = `
      <html>
        <head><title>Page {n}</title></head>
        <body>
          <a href="https://example.com/page1">Link 1</a>
          <a href="https://example.com/page2">Link 2</a>
        </body>
      </html>
    `;

    mockedAxios.get
      .mockResolvedValueOnce({
        data: baseHtml.replace('{n}', 'Home'),
        headers: { 'content-type': 'text/html' },
        status: 200,
      })
      .mockResolvedValueOnce({
        data: baseHtml.replace('{n}', '1'),
        headers: { 'content-type': 'text/html' },
        status: 200,
      })
      .mockResolvedValueOnce({
        data: baseHtml.replace('{n}', '2'),
        headers: { 'content-type': 'text/html' },
        status: 200,
      });

    const config: SourceConfig = {
      type: 'url',
      location: 'https://example.com',
      options: {
        depth: 1,
        concurrency: 2,
      },
    };

    const crawler = new UrlCrawler(config);
    const result = await crawler.fetch();

    expect(result.items).toHaveLength(3);
    expect(result.metadata.stats.totalItems).toBe(3);
    expect(mockedAxios.get).toHaveBeenCalledTimes(3);
  });

  it('should respect URL filters', async () => {
    const htmlContent = `
      <html>
        <head><title>Test Page</title></head>
        <body>
          <a href="https://example.com/blog/post1">Blog 1</a>
          <a href="https://example.com/about">About</a>
        </body>
      </html>
    `;

    mockedAxios.get.mockResolvedValue({
      data: htmlContent,
      headers: { 'content-type': 'text/html' },
      status: 200,
    });

    const config: SourceConfig = {
      type: 'url',
      location: 'https://example.com',
      options: {
        depth: 1,
        filter: ['.*/blog/.*'],
      },
    };

    const crawler = new UrlCrawler(config);
    const result = await crawler.fetch();

    expect(result.items).toHaveLength(2); // Home page + 1 blog post
    const paths = result.items.map(item => item.path);
    expect(paths).toContain('https://example.com');
    expect(paths).toContain('https://example.com/blog/post1');
    expect(paths).not.toContain('https://example.com/about');
  });

  it('should handle robots.txt rules', async () => {
    const robotsTxt = `
      User-agent: *
      Disallow: /private/
      Disallow: /admin/
    `;

    const htmlContent = `
      <html>
        <head><title>Test Page</title></head>
        <body>
          <a href="https://example.com/public">Public</a>
          <a href="https://example.com/private/secret">Private</a>
          <a href="https://example.com/admin/dashboard">Admin</a>
        </body>
      </html>
    `;

    mockedAxios.get
      .mockResolvedValueOnce({
        data: robotsTxt,
        headers: { 'content-type': 'text/plain' },
        status: 200,
      })
      .mockResolvedValue({
        data: htmlContent,
        headers: { 'content-type': 'text/html' },
        status: 200,
      });

    const config: SourceConfig = {
      type: 'url',
      location: 'https://example.com',
      options: {
        depth: 1,
        respectRobotsTxt: true,
      },
    };

    const crawler = new UrlCrawler(config);
    const result = await crawler.fetch();

    expect(result.items.length).toBeGreaterThan(0);
    const paths = result.items.map(item => item.path);
    expect(paths).toContain('https://example.com/public');
    expect(paths).not.toContain('https://example.com/private/secret');
    expect(paths).not.toContain('https://example.com/admin/dashboard');
  });

  it('should handle network errors gracefully', async () => {
    mockedAxios.get.mockRejectedValue(new Error('Network error'));

    const config: SourceConfig = {
      type: 'url',
      location: 'https://example.com',
      options: {
        depth: 0,
      },
    };

    const crawler = new UrlCrawler(config);
    const result = await crawler.fetch();

    expect(result.items).toHaveLength(0);
    expect(result.metadata.stats.errors).toBe(1);
    expect(crawler.getErrors()[0].message).toContain('Network error');
  });

  it('should validate configuration', async () => {
    const invalidConfig: SourceConfig = {
      type: 'url',
      location: 'not-a-url',
      options: {
        depth: -1,
      },
    };

    const crawler = new UrlCrawler(invalidConfig);
    const result = await crawler.fetch();

    expect(result.items).toHaveLength(0);
    expect(result.metadata.stats.errors).toBeGreaterThan(0);
    const errors = crawler.getErrors();
    expect(errors.some(e => e.message.includes('Invalid URL'))).toBe(true);
    expect(errors.some(e => e.message.includes('Depth must be'))).toBe(true);
  });

  it('should respect item limit', async () => {
    const htmlContent = `
      <html>
        <head><title>Test Page</title></head>
        <body>
          <a href="https://example.com/page1">Link 1</a>
          <a href="https://example.com/page2">Link 2</a>
          <a href="https://example.com/page3">Link 3</a>
        </body>
      </html>
    `;

    mockedAxios.get.mockResolvedValue({
      data: htmlContent,
      headers: { 'content-type': 'text/html' },
      status: 200,
    });

    const config: SourceConfig = {
      type: 'url',
      location: 'https://example.com',
      options: {
        depth: 1,
        limit: 2,
      },
    };

    const crawler = new UrlCrawler(config);
    const result = await crawler.fetch();

    expect(result.items).toHaveLength(2);
    expect(result.metadata.stats.totalItems).toBe(2);
  });
}); 