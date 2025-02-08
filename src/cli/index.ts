#!/usr/bin/env node

import { Parser } from '../parser';
import { loadConfig } from '../config';
import { OpenAIService } from '../services/ai-service';
import * as fs from 'fs';

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Please provide a prompt file path');
    process.exit(1);
  }

  const promptFile = args[0];
  const promptContent = fs.readFileSync(promptFile, 'utf-8');

  try {
    const config = loadConfig();
    const parser = new Parser();
    const ast = parser.parse(promptContent);
    const aiService = new OpenAIService(config);

    // For now, we'll use some dummy variables
    const variables = {
      title: "Trump's Market Impact and Business Election Concerns",
      summary: "Analysis of Trump's influence on markets and Australian business leaders' election concerns",
      tone: "analytical",
      style: "news",
      targetAudience: "business professionals and investors",
      wordCount: 800,
      keyPoints: [
        "Trump's influence on market dynamics",
        "Australian business leaders' election concerns",
        "Market volatility implications",
        "Business sentiment analysis"
      ],
      categories: ["Markets", "Politics", "Business", "Economy"]
    };

    // Preview the messages that will be sent to OpenAI
    console.log('\n=== OpenAI Messages Preview ===\n');
    const messages = aiService.previewMessages(ast, variables);
    messages.forEach((msg, i) => {
      console.log(`[${msg.role.toUpperCase()}]:`);
      console.log(msg.content);
      console.log('-'.repeat(50) + '\n');
    });

    // Ask for confirmation
    console.log('Proceeding with OpenAI API call...\n');

    const result = await aiService.executePrompt(ast, variables);
    console.log(result);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main(); 