import { ContentCollection, SourceConfig } from '../types/config';

export abstract class BaseSource {
  protected config: SourceConfig;
  protected errors: Error[] = [];

  constructor(config: SourceConfig) {
    this.config = config;
  }

  abstract fetch(): Promise<ContentCollection>;

  async validate(): Promise<boolean> {
    return this.validateCommonConfig();
  }

  protected validateCommonConfig(): boolean {
    if (!this.config.location) {
      this.errors.push(new Error('Source location is required'));
      return false;
    }

    if (!this.config.type) {
      this.errors.push(new Error('Source type is required'));
      return false;
    }

    return true;
  }

  protected createContentCollection(
    items: ContentCollection['items'],
    totalItems: number
  ): ContentCollection {
    return {
      items,
      metadata: {
        timestamp: Date.now(),
        source: this.config,
        stats: {
          totalItems,
          processedItems: items.length,
          errors: this.errors.length,
        },
      },
    };
  }

  getErrors(): Error[] {
    return [...this.errors];
  }

  protected addError(error: Error): void {
    this.errors.push(error);
  }

  protected clearErrors(): void {
    this.errors = [];
  }
} 