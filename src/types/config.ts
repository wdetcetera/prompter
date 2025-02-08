export interface SourceConfig {
  type: 'url' | 'file' | 'git';
  location: string;
  options: UrlConfig | FileConfig | GitConfig;
}

export interface UrlConfig {
  depth: number;
  filter?: string[];
  limit?: number;
  timeout?: number;
  respectRobotsTxt?: boolean;
  concurrency?: number;
}

export interface FileConfig {
  format?: string;
  encoding?: string;
  include?: string[];
  exclude?: string[];
}

export interface GitConfig {
  branch?: string;
  depth?: number | 'full';
  include?: string[];
  exclude?: string[];
  submodules?: boolean;
  history?: boolean;
}

export interface ContentCollection {
  items: ContentItem[];
  metadata: ContentMetadata;
}

export interface ContentItem {
  id: string;
  type: string;
  content: string;
  path?: string;
  metadata?: {
    size?: number;
    created?: Date;
    modified?: Date;
    format?: string;
    encoding?: string;
    git?: GitMetadata;
    title?: string;
    description?: string;
    contentType?: string;
    lastModified?: string;
    depth?: number;
    links?: string[];
    headers?: Record<string, string>;
  };
}

export interface ContentMetadata {
  timestamp: number;
  source: SourceConfig;
  stats: {
    totalItems: number;
    processedItems: number;
    errors: number;
  };
}

export interface GitMetadata {
  lastCommit?: {
    hash: string;
    date: string;
    message: string;
    author_name: string;
    author_email: string;
  };
  blame?: Record<string, {
    author: string;
    email: string;
    timestamp: number;
    summary: string;
  }>;
}

export interface DocumentationConfig {
  sections: string[];
  format: 'markdown' | 'html' | 'pdf';
  templates?: Record<string, string>;
  metadata: {
    title: string;
    version: string;
    date: string;
    authors: string[];
  };
  output: {
    path: string;
    filename?: string;
  };
} 