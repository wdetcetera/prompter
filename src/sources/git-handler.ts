import * as fs from 'fs-extra';
import * as path from 'path';
import { simpleGit, SimpleGit, DefaultLogFields, ListLogLine } from 'simple-git';
import { BaseSource } from './base-source';
import { ContentCollection, ContentItem, GitConfig, GitMetadata, SourceConfig } from '../types/config';
import { FileSystemSource } from './file-system';

export class GitHandler extends BaseSource {
  private readonly gitConfig: GitConfig;
  private readonly git: SimpleGit;
  private tempDir: string | null = null;

  constructor(config: SourceConfig) {
    super(config);
    this.gitConfig = config.options as GitConfig;
    this.git = simpleGit();
  }

  async fetch(): Promise<ContentCollection> {
    if (!(await this.validate())) {
      return this.createContentCollection([], 0);
    }

    try {
      await this.cloneRepository();
      if (!this.tempDir) {
        throw new Error('Failed to create temporary directory');
      }

      const fileSource = new FileSystemSource({
        type: 'file',
        location: this.tempDir,
        options: {
          include: this.gitConfig.include,
          exclude: this.gitConfig.exclude,
        },
      });

      const result = await fileSource.fetch();

      // Add Git-specific metadata to each item
      const items = await Promise.all(
        result.items.map(async item => this.addGitMetadata(item))
      );

      await this.cleanup();
      return this.createContentCollection(items, items.length);
    } catch (error) {
      this.addError(error instanceof Error ? error : new Error(String(error)));
      await this.cleanup();
      return this.createContentCollection([], 0);
    }
  }

  async validate(): Promise<boolean> {
    if (!super.validateCommonConfig()) return false;

    if (!this.isValidGitUrl(this.config.location)) {
      this.addError(new Error('Invalid Git URL provided'));
      return false;
    }

    return true;
  }

  private async cloneRepository(): Promise<void> {
    this.tempDir = path.join(process.cwd(), '.tmp', `repo-${Date.now()}`);
    await fs.ensureDir(this.tempDir);

    const cloneOptions = ['--no-checkout'];

    if (this.gitConfig.depth && this.gitConfig.depth !== 'full') {
      cloneOptions.push('--depth', this.gitConfig.depth.toString());
    }

    if (this.gitConfig.branch) {
      cloneOptions.push('--branch', this.gitConfig.branch);
    }

    if (!this.gitConfig.submodules) {
      cloneOptions.push('--no-recurse-submodules');
    }

    await this.git.clone(this.config.location, this.tempDir, cloneOptions);

    // Checkout the specified branch or default branch
    const git = simpleGit(this.tempDir);
    if (this.gitConfig.branch) {
      await git.checkout(this.gitConfig.branch);
    }

    // Initialize and update submodules if requested
    if (this.gitConfig.submodules) {
      await git.submoduleInit();
      await git.submoduleUpdate();
    }

    // Checkout files after cloning
    await git.checkout('.');
  }

  private async cleanup(): Promise<void> {
    if (this.tempDir) {
      try {
        await fs.remove(this.tempDir);
        this.tempDir = null;
      } catch (error) {
        this.addError(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  private async addGitMetadata(item: ContentItem): Promise<ContentItem> {
    if (!this.tempDir || !item.path) {
      return item;
    }

    try {
      const git = simpleGit(this.tempDir);
      const filePath = path.join(this.tempDir, item.path);
      
      const [log, blame] = await Promise.all([
        git.log({ file: filePath, maxCount: 1 }),
        this.gitConfig.history ? git.raw(['blame', '--porcelain', filePath]) : null,
      ]);

      const gitMetadata: GitMetadata = {};

      if (log.latest) {
        gitMetadata.lastCommit = {
          hash: log.latest.hash,
          date: log.latest.date,
          message: log.latest.message,
          author_name: log.latest.author_name,
          author_email: log.latest.author_email,
        };
      }

      if (blame) {
        gitMetadata.blame = this.parseBlame(blame);
      }

      return {
        ...item,
        metadata: {
          ...item.metadata,
          git: gitMetadata,
        },
      };
    } catch (error) {
      this.addError(error instanceof Error ? error : new Error(String(error)));
      return {
        ...item,
        metadata: {
          ...item.metadata,
          git: {},
        },
      };
    }
  }

  private parseBlame(blameOutput: string): GitMetadata['blame'] {
    const lines = blameOutput.split('\n');
    const blame: NonNullable<GitMetadata['blame']> = {};
    let currentCommit: {
      hash?: string;
      author?: string;
      email?: string;
      timestamp?: number;
      summary?: string;
    } | null = null;

    for (const line of lines) {
      if (line.match(/^[0-9a-f]{40}/)) {
        if (currentCommit?.hash && this.isCompleteCommit(currentCommit)) {
          blame[currentCommit.hash] = {
            author: currentCommit.author!,
            email: currentCommit.email!,
            timestamp: currentCommit.timestamp!,
            summary: currentCommit.summary!,
          };
        }
        currentCommit = {
          hash: line.substring(0, 40),
        };
      } else if (line.startsWith('author ') && currentCommit) {
        currentCommit.author = line.substring(7);
      } else if (line.startsWith('author-mail ') && currentCommit) {
        currentCommit.email = line.substring(12).replace(/[<>]/g, '');
      } else if (line.startsWith('author-time ') && currentCommit) {
        currentCommit.timestamp = parseInt(line.substring(12), 10);
      } else if (line.startsWith('summary ') && currentCommit) {
        currentCommit.summary = line.substring(8);
      }
    }

    if (currentCommit?.hash && this.isCompleteCommit(currentCommit)) {
      blame[currentCommit.hash] = {
        author: currentCommit.author!,
        email: currentCommit.email!,
        timestamp: currentCommit.timestamp!,
        summary: currentCommit.summary!,
      };
    }

    return blame;
  }

  private isCompleteCommit(commit: {
    hash?: string;
    author?: string;
    email?: string;
    timestamp?: number;
    summary?: string;
  }): boolean {
    return !!(
      commit.hash &&
      commit.author &&
      commit.email &&
      commit.timestamp &&
      commit.summary
    );
  }

  private isValidGitUrl(url: string): boolean {
    // Support for HTTPS and SSH URLs
    const httpsPattern = /^https:\/\/[^\s]+\.git$/;
    const sshPattern = /^git@[^\s]+:.+\.git$/;
    const localPattern = /^(\/|\.\/|\.\.\/).+$/;

    return (
      httpsPattern.test(url) ||
      sshPattern.test(url) ||
      localPattern.test(url)
    );
  }
} 