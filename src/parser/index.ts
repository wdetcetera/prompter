import * as fs from 'fs-extra';
import * as path from 'path';
import * as peggy from 'peggy';
import { Node, Program, Expression } from '../types/ast';

export class Parser {
  private parser: peggy.Parser;

  constructor() {
    // Try multiple possible locations for the grammar file
    const possiblePaths = [
      path.join(__dirname, 'grammar.pegjs'), // When running from source
      path.join(__dirname, '../../src/parser/grammar.pegjs'), // When installed as package
      path.join(process.cwd(), 'src/parser/grammar.pegjs') // Fallback to current directory
    ];

    let grammarContent: string | null = null;
    let loadedPath: string | null = null;

    for (const grammarPath of possiblePaths) {
      try {
        if (fs.existsSync(grammarPath)) {
          grammarContent = fs.readFileSync(grammarPath, 'utf-8');
          loadedPath = grammarPath;
          break;
        }
      } catch (error) {
        // Continue trying other paths
      }
    }

    if (!grammarContent || !loadedPath) {
      throw new Error('Could not find grammar.pegjs file. Make sure the package is installed correctly.');
    }

    try {
      this.parser = peggy.generate(grammarContent, {
        output: 'parser',
        format: 'bare',
        optimize: 'speed',
        trace: false,
        allowedStartRules: ['Program'],
        features: {
          expected: true,
          error: true,
        },
      });
    } catch (error) {
      throw new Error(`Failed to generate parser from grammar at ${loadedPath}: ${error}`);
    }
  }

  parse(input: string): Program {
    try {
      return this.parser.parse(input, { startRule: 'Program' }) as Program;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Parse error: ${error.message}`);
      }
      throw error;
    }
  }

  parseFile(filePath: string): Program {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return this.parse(content);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to parse file ${filePath}: ${error.message}`);
      }
      throw error;
    }
  }

  validate(node: Node): boolean {
    switch (node.type) {
      case 'Program':
        return node.body.every(def => this.validate(def));

      case 'PromptDefinition':
        return (
          typeof node.name === 'string' &&
          this.validate(node.source) &&
          (!node.variables || this.validate(node.variables)) &&
          (!node.validation || this.validate(node.validation)) &&
          (!node.processing || this.validate(node.processing)) &&
          (!node.output || this.validate(node.output))
        );

      case 'SourceDefinition':
        return (
          ['url', 'file', 'git'].includes(node.sourceType) &&
          typeof node.sourcePath === 'string' &&
          node.config.every(opt => this.validate(opt))
        );

      case 'VariablesDefinition':
        return node.variables.every(v => this.validate(v));

      case 'VariableDeclaration':
        return (
          typeof node.name === 'string' &&
          this.validate(node.variableType)
        );

      case 'TypeReference':
        return (
          typeof node.typeName === 'string' &&
          typeof node.isArray === 'boolean' &&
          (!node.properties || Object.values(node.properties).every(p => this.validate(p))) &&
          (!node.unionTypes || node.unionTypes.every(t => this.validate(t)))
        );

      case 'ValidationDefinition':
        return node.rules.every(rule => this.validate(rule));

      case 'ValidationRule':
        return (
          typeof node.target === 'string' &&
          node.rules.every(rule => this.validate(rule))
        );

      case 'ValidationExpression':
        return (
          typeof node.name === 'string' &&
          node.arguments.every(arg => this.validateExpression(arg)) &&
          typeof node.isRequired === 'boolean' &&
          typeof node.isOptional === 'boolean'
        );

      case 'ProcessingDefinition':
        return (
          (!node.before || node.before.every(step => this.validate(step))) &&
          (!node.after || node.after.every(step => this.validate(step)))
        );

      case 'ProcessingStep':
        return (
          typeof node.name === 'string' &&
          node.arguments.every(arg => this.validateExpression(arg))
        );

      case 'OutputDefinition':
        return (
          typeof node.format === 'string' &&
          node.options.every(opt => this.validate(opt))
        );

      case 'ConfigOption':
        return (
          typeof node.key === 'string' &&
          this.validateExpression(node.value)
        );

      default:
        return false;
    }
  }

  private validateExpression(expr: Expression): boolean {
    if (!expr || typeof expr !== 'object') return false;

    switch (expr.type) {
      case 'StringLiteral':
        return typeof expr.value === 'string';

      case 'NumberLiteral':
        return typeof expr.value === 'number' && !isNaN(expr.value);

      case 'BooleanLiteral':
        return typeof expr.value === 'boolean';

      case 'ArrayLiteral':
        return Array.isArray(expr.elements) &&
          expr.elements.every(el => this.validateExpression(el));

      case 'ObjectLiteral':
        return typeof expr.properties === 'object' &&
          Object.values(expr.properties).every(prop => this.validateExpression(prop));

      case 'Identifier':
        return typeof expr.name === 'string';

      case 'FunctionCall':
        return typeof expr.name === 'string' &&
          Array.isArray(expr.arguments) &&
          expr.arguments.every(arg => this.validateExpression(arg));

      default:
        return false;
    }
  }
} 