import * as fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'glob';
import { BaseSource } from './base-source';
import { ContentCollection, ContentItem, FileConfig, SourceConfig } from '../types/config';

type SupportedEncoding = 'utf-8' | 'ascii' | 'utf16le' | 'ucs2' | 'base64' | 'latin1'; 

export class FileSystemSource extends BaseSource {
  private readonly fileConfig: FileConfig;
  private readonly supportedEncodings: readonly SupportedEncoding[] = [
    'utf-8',
    'ascii',
    'utf16le',
    'ucs2',
    'base64',
    'latin1',
  ];

  constructor(config: SourceConfig) {
    super(config);
    this.fileConfig = config.options as FileConfig;
  }

  async fetch(): Promise<ContentCollection> {
    if (!(await this.validate())) {
      return this.createContentCollection([], 0);
    }

    try {
      const files = await this.findFiles();
      const items = await this.processFiles(files);
      return this.createContentCollection(items, files.length);
    } catch (error) {
      this.addError(error instanceof Error ? error : new Error(String(error)));
      return this.createContentCollection([], 0);
    }
  }

  async validate(): Promise<boolean> {
    if (!super.validateCommonConfig()) return false;

    if (!fs.existsSync(this.config.location)) {
      this.addError(new Error(`Source path does not exist: ${this.config.location}`));
      return false;
    }

    if (this.fileConfig.encoding && !this.supportedEncodings.includes(this.fileConfig.encoding as SupportedEncoding)) {
      this.addError(new Error(`Unsupported encoding: ${this.fileConfig.encoding}`));
      return false;
    }

    return true;
  }

  private async findFiles(): Promise<string[]> {
    const options = {
      cwd: this.config.location,
      dot: false,
      nodir: true,
      absolute: true,
      ignore: this.fileConfig.exclude,
    };

    const patterns = this.fileConfig.include || ['**/*'];
    const files: string[] = [];

    for (const pattern of patterns) {
      const matches = await glob(pattern, options);
      if (Array.isArray(matches)) {
        files.push(...matches);
      }
    }

    return [...new Set(files)]; // Remove duplicates
  }

  private async processFiles(files: string[]): Promise<ContentItem[]> {
    const items: ContentItem[] = [];

    for (const file of files) {
      try {
        const item = await this.processFile(file);
        if (item) {
          items.push(item);
        }
      } catch (error) {
        this.addError(error instanceof Error ? error : new Error(String(error)));
      }
    }

    return items;
  }

  private async processFile(filePath: string): Promise<ContentItem | null> {
    try {
      const stats = await fs.stat(filePath);
      const encoding = (this.fileConfig.encoding || 'utf-8') as SupportedEncoding;
      const content = await fs.readFile(filePath, encoding);

      const relativePath = path.relative(this.config.location, filePath);

      return {
        id: Buffer.from(relativePath).toString('base64'),
        type: this.getFileType(filePath),
        content: content.toString(),
        path: relativePath,
        metadata: {
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          format: this.fileConfig.format || 'auto',
          encoding,
        },
      };
    } catch (error) {
      this.addError(error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  private getFileType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const typeMap: Record<string, string> = {
      '.txt': 'text',
      '.md': 'markdown',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.xml': 'xml',
      '.html': 'html',
      '.htm': 'html',
      '.css': 'css',
      '.js': 'javascript',
      '.ts': 'typescript',
      '.jsx': 'jsx',
      '.tsx': 'tsx',
      '.csv': 'csv',
    };

    return typeMap[ext] || 'unknown';
  }
} 