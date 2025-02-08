import * as fs from 'fs-extra';
import * as path from 'path';
import { FileSystemSource } from '../file-system';
import { SourceConfig } from '../../types/config';

describe('FileSystemSource', () => {
  const testDir = path.join(__dirname, 'test-files');
  const testFiles = {
    'test.txt': 'Hello, World!',
    'test.md': '# Markdown Test',
    'nested/test.json': '{"key": "value"}',
  };

  beforeAll(async () => {
    await fs.ensureDir(testDir);
    await fs.ensureDir(path.join(testDir, 'nested'));

    for (const [filePath, content] of Object.entries(testFiles)) {
      await fs.writeFile(path.join(testDir, filePath), content);
    }
  });

  afterAll(async () => {
    await fs.remove(testDir);
  });

  it('should fetch files with default configuration', async () => {
    const config: SourceConfig = {
      type: 'file',
      location: testDir,
      options: {},
    };

    const source = new FileSystemSource(config);
    const result = await source.fetch();

    expect(result.items).toHaveLength(3);
    expect(result.metadata.stats.totalItems).toBe(3);
    expect(result.metadata.stats.errors).toBe(0);

    const fileTypes = result.items.map(item => item.type);
    expect(fileTypes).toContain('text');
    expect(fileTypes).toContain('markdown');
    expect(fileTypes).toContain('json');
  });

  it('should respect include patterns', async () => {
    const config: SourceConfig = {
      type: 'file',
      location: testDir,
      options: {
        include: ['**/*.txt'],
      },
    };

    const source = new FileSystemSource(config);
    const result = await source.fetch();

    expect(result.items).toHaveLength(1);
    expect(result.items[0].type).toBe('text');
  });

  it('should respect exclude patterns', async () => {
    const config: SourceConfig = {
      type: 'file',
      location: testDir,
      options: {
        exclude: ['**/*.txt', '**/*.json'],
      },
    };

    const source = new FileSystemSource(config);
    const result = await source.fetch();

    expect(result.items).toHaveLength(1);
    expect(result.items[0].type).toBe('markdown');
  });

  it('should handle invalid paths', async () => {
    const config: SourceConfig = {
      type: 'file',
      location: path.join(testDir, 'non-existent'),
      options: {},
    };

    const source = new FileSystemSource(config);
    const result = await source.fetch();

    expect(result.items).toHaveLength(0);
    expect(result.metadata.stats.errors).toBe(1);
    expect(source.getErrors()[0].message).toContain('does not exist');
  });

  it('should handle invalid encoding', async () => {
    const config: SourceConfig = {
      type: 'file',
      location: testDir,
      options: {
        encoding: 'invalid-encoding',
      },
    };

    const source = new FileSystemSource(config);
    const result = await source.fetch();

    expect(result.items).toHaveLength(0);
    expect(result.metadata.stats.errors).toBe(1);
    expect(source.getErrors()[0].message).toContain('Unsupported encoding');
  });
}); 