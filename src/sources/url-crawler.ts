import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import { BaseSource } from './base-source';
import { ContentCollection, ContentItem, SourceConfig, UrlConfig } from '../types/config';

interface QueueItem {
  url: string;
  depth: number;
}

export class UrlCrawler extends BaseSource {
  private readonly urlConfig: UrlConfig;
  private readonly visited: Set<string> = new Set();
  private readonly queue: QueueItem[] = [];
  private readonly http: AxiosInstance;
  private robotsTxtRules: Set<string> = new Set();

  constructor(config: SourceConfig) {
    super(config);
    this.urlConfig = config.options as UrlConfig;
    this.http = axios.create({
      timeout: this.urlConfig.timeout || 5000,
      maxRedirects: 5,
      validateStatus: status => status < 400,
    });
  }

  async fetch(): Promise<ContentCollection> {
    if (!(await this.validate())) {
      return this.createContentCollection([], 0);
    }

    try {
      if (this.urlConfig.respectRobotsTxt) {
        await this.loadRobotsTxt();
      }

      const startUrl = new URL(this.config.location);
      if (this.urlConfig.respectRobotsTxt && !this.isAllowedByRobotsTxt(startUrl)) {
        return this.createContentCollection([], 0);
      }

      this.queue.push({ url: this.config.location, depth: 0 });
      const items: ContentItem[] = [];
      const limit = this.urlConfig.limit || Infinity;

      while (this.queue.length > 0 && items.length < limit) {
        const batch = this.getBatch(limit - items.length);
        const results = await Promise.all(
          batch.map(item => this.crawlUrl(item.url, item.depth))
        );

        for (const result of results) {
          if (result && items.length < limit) {
            items.push(result);
          }
        }
      }

      return this.createContentCollection(items, items.length);
    } catch (error) {
      this.addError(error instanceof Error ? error : new Error(String(error)));
      return this.createContentCollection([], 0);
    }
  }

  async validate(): Promise<boolean> {
    if (!super.validateCommonConfig()) return false;

    let isValid = true;

    try {
      new URL(this.config.location);
    } catch {
      this.addError(new Error('Invalid URL provided'));
      isValid = false;
    }

    if (this.urlConfig.depth !== undefined && this.urlConfig.depth < 0) {
      this.addError(new Error('Depth must be a non-negative number'));
      isValid = false;
    }

    return isValid;
  }

  private async loadRobotsTxt(): Promise<void> {
    try {
      const baseUrl = new URL(this.config.location);
      const robotsTxtUrl = new URL('/robots.txt', baseUrl).toString();
      const response = await this.http.get(robotsTxtUrl);
      
      const rules = response.data
        .split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line.toLowerCase().startsWith('disallow:'))
        .map((line: string) => line.split(':')[1].trim());

      this.robotsTxtRules = new Set(rules);
    } catch (error) {
      // Ignore robots.txt errors, just proceed with crawling
      console.warn(`Failed to load robots.txt: ${error}`);
      this.robotsTxtRules = new Set();
    }
  }

  private getBatch(remainingLimit: number): QueueItem[] {
    const batchSize = Math.min(
      this.urlConfig.concurrency || 5,
      remainingLimit,
      this.queue.length
    );
    return this.queue.splice(0, batchSize);
  }

  private async crawlUrl(url: string, depth: number): Promise<ContentItem | null> {
    if (this.visited.has(url)) {
      return null;
    }

    const urlObj = new URL(url);
    if (this.urlConfig.respectRobotsTxt && !this.isAllowedByRobotsTxt(urlObj)) {
      return null;
    }

    this.visited.add(url);

    try {
      const response = await this.http.get(url);
      const $ = cheerio.load(response.data);
      
      if (depth < (this.urlConfig.depth || 0)) {
        this.queueLinks($, url, depth + 1);
      }

      return {
        id: Buffer.from(url).toString('base64'),
        type: this.getContentType(response.headers['content-type']),
        content: response.data,
        path: url,
        metadata: {
          title: $('title').text(),
          description: $('meta[name="description"]').attr('content'),
          contentType: response.headers['content-type'],
          lastModified: response.headers['last-modified'],
          depth,
          links: this.extractLinks($),
          headers: Object.fromEntries(
            Object.entries(response.headers).map(([key, value]) => [
              key,
              Array.isArray(value) ? value.join(', ') : String(value || '')
            ])
          ),
        },
      };
    } catch (error) {
      this.addError(error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  private queueLinks($: cheerio.CheerioAPI, baseUrl: string, depth: number): void {
    const links = this.extractLinks($);
    const baseUrlObj = new URL(baseUrl);

    for (const link of links) {
      try {
        const url = new URL(link, baseUrl);
        if (
          this.shouldCrawl(url, baseUrlObj) &&
          !this.visited.has(url.href) &&
          !this.queue.some(item => item.url === url.href) &&
          (!this.urlConfig.respectRobotsTxt || this.isAllowedByRobotsTxt(url))
        ) {
          this.queue.push({ url: url.href, depth });
        }
      } catch {
        // Ignore invalid URLs
      }
    }
  }

  private extractLinks($: cheerio.CheerioAPI): string[] {
    const links = new Set<string>();
    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      if (href) {
        links.add(href);
      }
    });
    return Array.from(links);
  }

  private shouldCrawl(url: URL, baseUrl: URL): boolean {
    // Only crawl same domain
    if (url.hostname !== baseUrl.hostname) {
      return false;
    }

    // Check against filters if they exist
    if (this.urlConfig.filter && this.urlConfig.filter.length > 0) {
      return this.urlConfig.filter.some(pattern =>
        this.matchUrlPattern(url.href, pattern)
      );
    }

    return true;
  }

  private isAllowedByRobotsTxt(url: URL): boolean {
    if (this.robotsTxtRules.size === 0) {
      return true;
    }

    for (const rule of this.robotsTxtRules) {
      if (url.pathname.startsWith(rule)) {
        return false;
      }
    }

    return true;
  }

  private matchUrlPattern(url: string, pattern: string): boolean {
    try {
      const regex = new RegExp(pattern);
      return regex.test(url);
    } catch {
      return false;
    }
  }

  private getContentType(contentType: string | undefined): string {
    if (!contentType) return 'unknown';

    const type = contentType.toLowerCase();
    if (type.includes('html')) return 'html';
    if (type.includes('json')) return 'json';
    if (type.includes('xml')) return 'xml';
    if (type.includes('text')) return 'text';
    return 'unknown';
  }
} 