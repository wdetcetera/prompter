import OpenAI from 'openai';
import { Config } from '../config';
import { Node, Program, PromptDefinition, Expression } from '../types/ast';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export class OpenAIService {
  private client: OpenAI;
  private config: Config;

  constructor(config: Config) {
    if (!config.openai?.apiKey) {
      throw new Error('OpenAI API key is required');
    }
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  previewMessages(ast: Node, variables: Record<string, any>): ChatCompletionMessageParam[] {
    if (ast.type !== 'Program') {
      throw new Error('Expected a Program node');
    }

    const program = ast as Program;
    if (program.body.length === 0) {
      throw new Error('No prompt definitions found');
    }

    const promptDef = program.body[0] as PromptDefinition;
    this.validateVariables(promptDef, variables);
    const systemMessage = this.constructSystemMessage(promptDef, variables);

    return [
      {
        role: 'system',
        content: systemMessage
      },
      {
        role: 'assistant',
        content: "I understand. I'll help you generate the article according to the specified requirements."
      },
      {
        role: 'user',
        content: `Generate a ${variables.style} article based on the provided information and requirements.`
      }
    ] as ChatCompletionMessageParam[];
  }

  async executePrompt(ast: Node, variables: Record<string, any>): Promise<string> {
    if (ast.type !== 'Program') {
      throw new Error('Expected a Program node');
    }

    const program = ast as Program;
    if (program.body.length === 0) {
      throw new Error('No prompt definitions found');
    }

    const promptDef = program.body[0] as PromptDefinition;
    this.validateVariables(promptDef, variables);

    const messages = this.previewMessages(ast, variables);

    const response = await this.client.chat.completions.create({
      model: this.config.openai?.defaultModel || 'gpt-4',
      max_tokens: this.config.openai?.maxTokens,
      temperature: this.config.openai?.temperature,
      messages
    });

    const lastMessage = response.choices[0]?.message?.content;
    if (!lastMessage) {
      throw new Error('No response received from OpenAI');
    }

    return this.formatOutput(lastMessage, promptDef, variables);
  }

  private validateVariables(promptDef: PromptDefinition, variables: Record<string, any>): void {
    if (!promptDef.variables) return;

    for (const varDef of promptDef.variables.variables) {
      const value = variables[varDef.name];
      if (value === undefined) {
        throw new Error(`Missing required variable: ${varDef.name}`);
      }
      // TODO: Add type validation based on varDef.variableType
    }
  }

  private constructSystemMessage(promptDef: PromptDefinition, variables: Record<string, any>): string {
    const instructions = [
      `You are writing a ${variables.style} article for ${variables.targetAudience}.`,
      `The tone should be ${variables.tone}.`,
      `The article should be approximately ${variables.wordCount} words.`,
      'Key points to cover:',
      ...variables.keyPoints.map((point: string) => `- ${point}`),
      '',
      'Requirements:',
      '1. Follow AP style guidelines',
      '2. Use clear, concise language',
      '3. Include relevant quotes and statistics when available',
      '4. Maintain objectivity and factual accuracy',
      '5. Structure the article with a strong lead, body, and conclusion',
      '6. Use proper markdown formatting:',
      '   - Use # for the main title',
      '   - Use ## for section headings',
      '   - Use > for quotes',
      '   - Use **bold** for emphasis',
      '   - Use proper markdown line breaks',
      '',
      'Article metadata:',
      `Title: ${variables.title}`,
      `Summary: ${variables.summary}`,
      `Categories: ${variables.categories.join(', ')}`,
    ].join('\n');

    return instructions;
  }

  private formatOutput(content: string, promptDef: PromptDefinition, variables: Record<string, any>): string {
    const format = promptDef.output?.format as Expression;
    if (format?.type === 'StringLiteral' && format.value === 'markdown') {
      // Format the content as markdown
      const formattedContent = content
        .split('\n\n')
        .map(paragraph => {
          // If paragraph starts with "Title:", make it a main heading
          if (paragraph.startsWith('Title:')) {
            return `# ${paragraph.replace('Title:', '').trim()}`;
          }
          return paragraph;
        })
        .join('\n\n');

      const frontMatter = [
        '---',
        `title: "${variables.title}"`,
        `summary: "${variables.summary}"`,
        `categories: [${variables.categories.map((c: string) => `"${c}"`).join(', ')}]`,
        `wordCount: ${variables.wordCount}`,
        `date: "${new Date().toISOString()}"`,
        'author: "AI News Generator"',
        '---',
        '',
      ].join('\n');

      return `${frontMatter}${formattedContent}`;
    }

    return content;
  }
} 