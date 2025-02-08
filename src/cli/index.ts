#!/usr/bin/env node

import { Parser } from '../parser';
import { loadConfig } from '../config';
import { OpenAIService } from '../services/ai-service';
import * as fs from 'fs';
import * as path from 'path';

function showHelp(): void {
  console.log(`
Prompter Language CLI - A tool for AI prompt engineering

Usage:
  prompter <command> [options]

Commands:
  run <file>     Run a prompt file
  init           Create a new prompt file
  version        Show version number
  help           Show this help message

Examples:
  prompter run ./my-prompt.prompt
  prompter init
  `);
}

function showVersion(): void {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')
  );
  console.log(`v${packageJson.version}`);
}

function createNewPrompt(): void {
  const template = `// Basic prompt definition
prompt ExamplePrompt {
  source: file("./template.txt") {
    format: "text";
    encoding: "utf-8";
  }

  variables {
    name: string;
    tone: "formal" | "casual";
  }

  validation {
    name: required;
    tone: required;
  }

  output {
    format: "markdown";
  }
}`;

  const filename = 'example.prompt';
  if (!fs.existsSync(filename)) {
    fs.writeFileSync(filename, template);
    console.log(`Created new prompt file: ${filename}`);
  } else {
    console.error(`File ${filename} already exists`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    process.exit(0);
  }

  if (command === 'version' || command === '--version' || command === '-v') {
    showVersion();
    process.exit(0);
  }

  if (command === 'init') {
    createNewPrompt();
    process.exit(0);
  }

  if (command === 'run') {
    const promptFile = args[1];
    if (!promptFile) {
      console.error('Please provide a prompt file path');
      process.exit(1);
    }

    try {
      const promptContent = fs.readFileSync(promptFile, 'utf-8');
      const config = loadConfig();
      const parser = new Parser();
      const ast = parser.parse(promptContent);
      const aiService = new OpenAIService(config);

      // For now, we'll use some dummy variables
      const variables = {
        title: "Example Article",
        summary: "This is a test article",
        tone: "analytical",
        style: "news",
        targetAudience: "general readers",
        wordCount: 500,
        keyPoints: [
          "Key point 1",
          "Key point 2",
          "Key point 3"
        ],
        categories: ["Test", "Example"]
      };

      console.log('\n=== Processing Prompt ===\n');
      const result = await aiService.executePrompt(ast, variables);
      console.log(result);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  } else {
    console.error(`Unknown command: ${command}`);
    showHelp();
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 