import * as fs from 'fs-extra';
import * as path from 'path';
import { simpleGit } from 'simple-git';
import { GitHandler } from '../git-handler';
import { SourceConfig } from '../../types/config';

describe('GitHandler', () => {
  const testDir = path.join(__dirname, 'test-repo');
  const repoDir = path.join(testDir, 'repo');

  beforeAll(async () => {
    // Create a test repository
    await fs.ensureDir(repoDir);
    const git = simpleGit(repoDir);

    // Initialize repository
    await git.init();
    await git.addConfig('user.name', 'Test User');
    await git.addConfig('user.email', 'test@example.com');

    // Create test files
    await fs.writeFile(path.join(repoDir, 'test.txt'), 'Hello, World!');
    await fs.writeFile(path.join(repoDir, 'test.md'), '# Markdown Test');
    await fs.ensureDir(path.join(repoDir, 'nested'));
    await fs.writeFile(
      path.join(repoDir, 'nested/test.json'),
      '{"key": "value"}'
    );

    // Commit files
    await git.add('.');
    await git.commit('Initial commit');

    // Create a branch and add more files
    await git.checkoutLocalBranch('feature');
    await fs.writeFile(
      path.join(repoDir, 'feature.txt'),
      'Feature branch content'
    );
    await git.add('.');
    await git.commit('Add feature file');
    await git.checkout('main');
  });

  afterAll(async () => {
    await fs.remove(testDir);
  });

  it('should fetch files from a Git repository', async () => {
    const config: SourceConfig = {
      type: 'git',
      location: repoDir,
      options: {
        branch: 'main',
      },
    };

    const handler = new GitHandler(config);
    const result = await handler.fetch();

    expect(result.items).toHaveLength(3);
    expect(result.metadata.stats.totalItems).toBe(3);
    expect(result.metadata.stats.errors).toBe(0);

    const fileTypes = result.items.map(item => item.type);
    expect(fileTypes).toContain('text');
    expect(fileTypes).toContain('markdown');
    expect(fileTypes).toContain('json');

    // Check Git metadata
    const textFile = result.items.find(item => item.type === 'text');
    expect(textFile?.metadata?.git).toBeDefined();
    expect(textFile?.metadata?.git?.lastCommit).toBeDefined();
  });

  it('should fetch files from a specific branch', async () => {
    const config: SourceConfig = {
      type: 'git',
      location: repoDir,
      options: {
        branch: 'feature',
      },
    };

    const handler = new GitHandler(config);
    const result = await handler.fetch();

    expect(result.items).toHaveLength(4);
    const featureFile = result.items.find(
      item => item.path === 'feature.txt'
    );
    expect(featureFile).toBeDefined();
    expect(featureFile?.content).toBe('Feature branch content');
  });

  it('should respect include patterns', async () => {
    const config: SourceConfig = {
      type: 'git',
      location: repoDir,
      options: {
        branch: 'main',
        include: ['**/*.txt'],
      },
    };

    const handler = new GitHandler(config);
    const result = await handler.fetch();

    expect(result.items).toHaveLength(1);
    expect(result.items[0].type).toBe('text');
  });

  it('should respect exclude patterns', async () => {
    const config: SourceConfig = {
      type: 'git',
      location: repoDir,
      options: {
        branch: 'main',
        exclude: ['**/*.txt', '**/*.json'],
      },
    };

    const handler = new GitHandler(config);
    const result = await handler.fetch();

    expect(result.items).toHaveLength(1);
    expect(result.items[0].type).toBe('markdown');
  });

  it('should handle invalid repository URLs', async () => {
    const config: SourceConfig = {
      type: 'git',
      location: 'invalid-url',
      options: {},
    };

    const handler = new GitHandler(config);
    const result = await handler.fetch();

    expect(result.items).toHaveLength(0);
    expect(result.metadata.stats.errors).toBe(1);
    expect(handler.getErrors()[0].message).toContain('Invalid Git URL');
  });

  it('should handle repository clone failures', async () => {
    const config: SourceConfig = {
      type: 'git',
      location: 'https://github.com/nonexistent/repo.git',
      options: {},
    };

    const handler = new GitHandler(config);
    const result = await handler.fetch();

    expect(result.items).toHaveLength(0);
    expect(result.metadata.stats.errors).toBeGreaterThan(0);
  });

  it('should include Git blame information when history is enabled', async () => {
    const config: SourceConfig = {
      type: 'git',
      location: repoDir,
      options: {
        branch: 'main',
        history: true,
      },
    };

    const handler = new GitHandler(config);
    const result = await handler.fetch();

    const textFile = result.items.find(item => item.type === 'text');
    expect(textFile?.metadata?.git?.blame).toBeDefined();
    expect(Object.keys(textFile?.metadata?.git?.blame || {})).toHaveLength(1);
  });
}); 