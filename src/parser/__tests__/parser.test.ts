import { Parser } from '../index';
import { Program, PromptDefinition, Expression, StringLiteral, NumberLiteral, BooleanLiteral } from '../../types/ast';
import * as fs from 'fs-extra';
import * as path from 'path';

describe('Parser', () => {
  let parser: Parser;

  beforeEach(() => {
    parser = new Parser();
  });

  const getExpressionValue = (expr: Expression): any => {
    switch (expr.type) {
      case 'StringLiteral':
        return (expr as StringLiteral).value;
      case 'NumberLiteral':
        return (expr as NumberLiteral).value;
      case 'BooleanLiteral':
        return (expr as BooleanLiteral).value;
      default:
        return undefined;
    }
  };

  describe('Basic Parsing', () => {
    it('should parse an empty program', () => {
      const input = '';
      const result = parser.parse(input) as Program;
      
      expect(result.type).toBe('Program');
      expect(result.body).toHaveLength(0);
    });

    it('should parse a simple prompt definition', () => {
      const input = `
        prompt SimplePrompt {
          source: file("./template.txt") {
            format: "text";
          }
        }
      `;
      
      const result = parser.parse(input) as Program;
      expect(result.type).toBe('Program');
      expect(result.body).toHaveLength(1);
      
      const prompt = result.body[0] as PromptDefinition;
      expect(prompt.type).toBe('PromptDefinition');
      expect(prompt.name).toBe('SimplePrompt');
      expect(prompt.source.sourceType).toBe('file');
      expect(prompt.source.sourcePath).toBe('./template.txt');
      expect(prompt.source.config).toHaveLength(1);
      expect(prompt.source.config[0].key).toBe('format');
      expect(prompt.source.config[0].value.type).toBe('StringLiteral');
      expect(getExpressionValue(prompt.source.config[0].value)).toBe('text');
    });
  });

  describe('Variables Section', () => {
    it('should parse variable declarations with different types', () => {
      const input = `
        prompt VariablesTest {
          source: file("./test.txt") {}
          variables {
            name: string;
            age: number;
            isActive: boolean;
            tags: string[];
            metadata: {
              created: string;
              count: number;
            };
          }
        }
      `;

      const result = parser.parse(input) as Program;
      const prompt = result.body[0] as PromptDefinition;
      const vars = prompt.variables!.variables;

      expect(vars).toHaveLength(5);
      expect(vars[0].name).toBe('name');
      expect(vars[0].variableType.typeName).toBe('string');
      expect(vars[1].variableType.typeName).toBe('number');
      expect(vars[2].variableType.typeName).toBe('boolean');
      expect(vars[3].variableType.typeName).toBe('string');
      expect(vars[3].variableType.isArray).toBe(true);
      expect(vars[4].variableType.typeName).toBe('object');
      expect(Object.keys(vars[4].variableType.properties!)).toHaveLength(2);
    });

    it('should parse union types', () => {
      const input = `
        prompt UnionTest {
          source: file("./test.txt") {}
          variables {
            style: "formal" | "casual" | "technical";
            status: number | boolean;
          }
        }
      `;

      const result = parser.parse(input) as Program;
      const prompt = result.body[0] as PromptDefinition;
      const vars = prompt.variables!.variables;

      expect(vars).toHaveLength(2);
      expect(vars[0].variableType.typeName).toBe('union');
      expect(vars[0].variableType.unionTypes).toHaveLength(3);
      expect(vars[0].variableType.unionTypes![0].value).toBe('formal');
      expect(vars[1].variableType.unionTypes).toHaveLength(2);
      expect(vars[1].variableType.unionTypes![0].typeName).toBe('number');
    });
  });

  describe('Validation Section', () => {
    it('should parse validation rules', () => {
      const input = `
        prompt ValidationTest {
          source: file("./test.txt") {}
          validation {
            name: required, minLength(2), maxLength(50);
            age: optional, min(0), max(150);
            tags: required, minItems(1), maxItems(10);
          }
        }
      `;

      const result = parser.parse(input) as Program;
      const prompt = result.body[0] as PromptDefinition;
      const rules = prompt.validation!.rules;

      expect(rules).toHaveLength(3);
      expect(rules[0].rules).toHaveLength(3);
      expect(rules[0].rules[0].isRequired).toBe(true);
      expect(rules[1].rules[0].isOptional).toBe(true);
      expect(rules[2].rules[1].name).toBe('minItems');
      expect(rules[2].rules[1].arguments).toHaveLength(1);
    });
  });

  describe('Processing Section', () => {
    it('should parse processing steps', () => {
      const input = `
        prompt ProcessingTest {
          source: file("./test.txt") {}
          processing {
            before {
              trim(name);
              lowercase(tags);
            }
            after {
              replaceAll("{{name}}", name);
              join(tags, ", ");
            }
          }
        }
      `;

      const result = parser.parse(input) as Program;
      const prompt = result.body[0] as PromptDefinition;
      const processing = prompt.processing!;

      expect(processing.before).toHaveLength(2);
      expect(processing.after).toHaveLength(2);
      expect(processing.before![0].name).toBe('trim');
      expect(processing.after![1].name).toBe('join');
      expect(processing.after![1].arguments).toHaveLength(2);
    });
  });

  describe('Output Section', () => {
    it('should parse output configuration', () => {
      const input = `
        prompt OutputTest {
          source: file("./test.txt") {}
          output {
            format: "json";
            maxLength: 2000;
            temperature: 0.7;
            model: "claude-3-sonnet";
          }
        }
      `;

      const result = parser.parse(input) as Program;
      const prompt = result.body[0] as PromptDefinition;
      const output = prompt.output!;

      expect(getExpressionValue(output.format)).toBe('json');
      expect(output.options).toHaveLength(3);
      const tempOption = output.options.find(opt => opt.key === 'temperature');
      expect(tempOption).toBeDefined();
      expect(getExpressionValue(tempOption!.value)).toBe(0.7);
    });
  });

  describe('Source Types', () => {
    it('should parse URL source configuration', () => {
      const input = `
        prompt UrlTest {
          source: url("https://example.com/template") {
            depth: 0;
            timeout: 5000;
            respectRobotsTxt: true;
          }
        }
      `;

      const result = parser.parse(input) as Program;
      const prompt = result.body[0] as PromptDefinition;
      const source = prompt.source;

      expect(source.sourceType).toBe('url');
      expect(source.sourcePath).toBe('https://example.com/template');
      expect(source.config).toHaveLength(3);
      const robotsOption = source.config.find(c => c.key === 'respectRobotsTxt');
      expect(robotsOption).toBeDefined();
      expect(getExpressionValue(robotsOption!.value)).toBe(true);
    });

    it('should parse Git source configuration', () => {
      const input = `
        prompt GitTest {
          source: git("https://github.com/example/repo.git") {
            branch: "main";
            depth: 1;
            include: ["docs/**/*.md"];
            exclude: ["**/internal/**"];
          }
        }
      `;

      const result = parser.parse(input) as Program;
      const prompt = result.body[0] as PromptDefinition;
      const source = prompt.source;

      expect(source.sourceType).toBe('git');
      expect(source.config).toHaveLength(4);
      const includeOption = source.config.find(c => c.key === 'include');
      expect(includeOption).toBeDefined();
      expect(includeOption!.value.type).toBe('ArrayLiteral');
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid syntax', () => {
      const input = `
        prompt InvalidPrompt {
          source: invalid("test") {}
        }
      `;

      expect(() => parser.parse(input)).toThrow();
    });

    it('should throw error for missing required sections', () => {
      const input = `
        prompt MissingSource {
          variables {
            name: string;
          }
        }
      `;

      expect(() => parser.parse(input)).toThrow();
    });
  });

  describe('File Parsing', () => {
    it('should parse a complete prompt file', async () => {
      const examplePath = path.join(__dirname, '../../../src/examples/basic.prompt');
      const result = parser.parseFile(examplePath);

      expect(result.type).toBe('Program');
      expect(result.body).toHaveLength(3);
      expect(result.body[0].name).toBe('ExamplePrompt');
      expect(result.body[1].name).toBe('WebBasedPrompt');
      expect(result.body[2].name).toBe('GitBasedPrompt');
    });
  });
}); 