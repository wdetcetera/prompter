export interface Config {
  openai?: {
    apiKey: string;
    defaultModel?: string;
    maxTokens?: number;
    temperature?: number;
  };
}

export function loadConfig(): Config {
  return {
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      defaultModel: process.env.OPENAI_MODEL || 'gpt-4',
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '2000'),
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
    }
  };
} 