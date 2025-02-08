# Prompter Language

Prompter Language is a domain-specific language (DSL) designed to bring structure, type safety, and reusability to AI prompt engineering. It provides a declarative way to define, validate, and execute prompts for AI language models.

## Overview

Think of Prompter Language as "TypeScript for prompts" - it adds static typing, validation, and structured composition to what would otherwise be plain text prompts. Key aspects include:

### Declarative Syntax
```
prompt NewsArticle {
  source: url("https://api.news.com/data") {
    depth: 1
  }
  variables {
    title: string;
    tone: "neutral" | "critical";
  }
  validation {
    title: required, minLength(10);
  }
}
```

### Type Safety
- Strong typing for variables and parameters
- Union types for constrained choices
- Runtime validation of inputs
- Compile-time checking of prompt structure

### Content Pipeline
1. **Source**: Fetch content from URLs, files, or Git repos
2. **Variables**: Define and validate input parameters
3. **Processing**: Transform content before/after AI processing
4. **Output**: Format and structure the final result

### Integration Features
- Built-in support for OpenAI and other AI providers
- Extensible source system for content fetching
- Markdown and other output formats
- Version control friendly

The language aims to solve common prompt engineering challenges:
- Inconsistent prompt formatting
- Lack of input validation
- Difficulty in maintaining prompt versions
- Poor reusability across projects
- Missing type safety
- Ad-hoc content processing

## Features

- 🎯 **Semantic Prompt Definition**: Define prompts using a clear, structured language
- 🔍 **Source Integration**: Support for multiple content sources (URL, File, Git)
- ✅ **Variable Validation**: Type checking and validation for prompt variables
- 📝 **Multiple Output Formats**: Support for Markdown and other output formats
- 🔄 **Processing Pipeline**: Pre and post-processing hooks for content
- 🎨 **Style Control**: Fine-grained control over tone, style, and formatting

## Installation

```bash
# Install using npm
npm install prompter-language

# Or using yarn
yarn add prompter-language
```

## Quick Start

1. Create a `.env` file with your API keys:
```env
OPENAI_API_KEY=your_openai_api_key_here
```

2. Create a prompt file (e.g., `article.prompt`):
```
prompt NewsArticle {
  source: url("https://example.com/news") {
    depth: 0
  }

  variables {
    title: string;
    summary: string;
    tone: "neutral" | "analytical" | "critical";
    style: "news" | "editorial" | "feature";
  }

  validation {
    title: required;
    summary: required;
    tone: required;
    style: required;
  }

  output {
    format: "markdown"
  }
}
```

3. Run the prompt:
```bash
yarn start path/to/your/prompt.file
```

## Prompt Language Syntax

### Source Types

- **URL Source**:
  ```
  source: url("https://example.com") {
    depth: 0,
    timeout: 5000
  }
  ```

- **File Source**:
  ```
  source: file("./template.txt") {
    format: "text",
    encoding: "utf-8"
  }
  ```

- **Git Source**:
  ```
  source: git("https://github.com/user/repo.git") {
    branch: "main",
    depth: 1
  }
  ```

### Variables

```
variables {
  name: string;
  age: number;
  tags: string[];
  metadata: {
    created: string;
    author: string;
  };
}
```

### Validation

```
validation {
  name: required, minLength(2), maxLength(50);
  age: required, min(0), max(150);
  tags: required, minItems(1);
}
```

### Output Configuration

```
output {
  format: "markdown";
  maxLength: 2000;
  temperature: 0.7;
}
```

## Development

### Prerequisites

- Node.js (v16 or higher)
- Yarn or npm
- OpenAI API key

### Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/prompter-language.git
cd prompter-language
```

2. Install dependencies:
```bash
yarn install
```

3. Build the project:
```bash
yarn build
```

4. Run tests:
```bash
yarn test
```

### Project Structure

```
src/
  ├── cli/           # Command-line interface
  ├── parser/        # Prompt language parser
  ├── services/      # AI service integrations
  ├── sources/       # Content source handlers
  ├── types/         # TypeScript type definitions
  └── examples/      # Example prompts
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- OpenAI for their GPT models and API
- PeggyJS for the parser generator
- All contributors who have helped shape this project 