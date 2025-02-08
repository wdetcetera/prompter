import * as dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Configuration schema
const configSchema = z.object({
  anthropic: z.object({
    apiKey: z.string().min(1, 'Anthropic API key is required'),
    defaultModel: z.enum(['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240229']).default('claude-3-sonnet-20240229'),
    maxTokens: z.number().positive().default(4096),
    temperature: z.number().min(0).max(1).default(0.7),
  }),
  openai: z.object({
    apiKey: z.string().optional(),
    defaultModel: z.string().default('gpt-4'),
    maxTokens: z.number().positive().default(4096),
    temperature: z.number().min(0).max(1).default(0.7),
  }).optional(),
});

// Configuration type
export type Config = z.infer<typeof configSchema>;

// Default configuration
const defaultConfig: Config = {
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    defaultModel: 'claude-3-sonnet-20240229',
    maxTokens: 4096,
    temperature: 0.7,
  },
};

// Validate configuration
export function validateConfig(config: Partial<Config> = {}): Config {
  const mergedConfig = {
    ...defaultConfig,
    ...config,
    anthropic: {
      ...defaultConfig.anthropic,
      ...config.anthropic,
    },
  };

  try {
    return configSchema.parse(mergedConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Configuration validation failed: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
}

// Get configuration
export function getConfig(): Config {
  return validateConfig();
}

// Check if configuration is valid
export function isConfigValid(): boolean {
  try {
    validateConfig();
    return true;
  } catch {
    return false;
  }
} 