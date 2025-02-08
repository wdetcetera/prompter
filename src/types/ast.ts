export type Node =
  | Program
  | PromptDefinition
  | SourceDefinition
  | VariablesDefinition
  | VariableDeclaration
  | TypeReference
  | ValidationDefinition
  | ValidationRule
  | ValidationExpression
  | ProcessingDefinition
  | ProcessingStep
  | OutputDefinition
  | ConfigOption
  | Expression;

export interface Position {
  line: number;
  column: number;
  offset: number;
}

export interface Location {
  start: Position;
  end: Position;
}

export interface BaseNode {
  type: string;
  location: Location;
}

export interface Program extends BaseNode {
  type: 'Program';
  body: PromptDefinition[];
}

export interface PromptDefinition extends BaseNode {
  type: 'PromptDefinition';
  name: string;
  source: SourceDefinition;
  variables?: VariablesDefinition;
  validation?: ValidationDefinition;
  processing?: ProcessingDefinition;
  output?: OutputDefinition;
}

export interface SourceDefinition extends BaseNode {
  type: 'SourceDefinition';
  sourceType: 'url' | 'file' | 'git';
  sourcePath: string;
  config: ConfigOption[];
}

export interface VariablesDefinition extends BaseNode {
  type: 'VariablesDefinition';
  variables: VariableDeclaration[];
}

export interface VariableDeclaration extends BaseNode {
  type: 'VariableDeclaration';
  name: string;
  variableType: TypeReference;
}

export interface TypeReference extends BaseNode {
  type: 'TypeReference';
  typeName: string;
  isArray: boolean;
  properties?: Record<string, TypeReference>;
  unionTypes?: TypeReference[];
  value?: string;
}

export interface ValidationDefinition extends BaseNode {
  type: 'ValidationDefinition';
  rules: ValidationRule[];
}

export interface ValidationRule extends BaseNode {
  type: 'ValidationRule';
  target: string;
  rules: ValidationExpression[];
}

export interface ValidationExpression extends BaseNode {
  type: 'ValidationExpression';
  name: string;
  arguments: Expression[];
  isRequired: boolean;
  isOptional: boolean;
}

export interface ProcessingDefinition extends BaseNode {
  type: 'ProcessingDefinition';
  before?: ProcessingStep[];
  after?: ProcessingStep[];
}

export interface ProcessingStep extends BaseNode {
  type: 'ProcessingStep';
  name: string;
  arguments: Expression[];
}

export interface OutputDefinition extends BaseNode {
  type: 'OutputDefinition';
  format: Expression;
  options: ConfigOption[];
}

export interface ConfigOption extends BaseNode {
  type: 'ConfigOption';
  key: string;
  value: Expression;
}

export type Expression =
  | StringLiteral
  | NumberLiteral
  | BooleanLiteral
  | ArrayLiteral
  | ObjectLiteral
  | Identifier
  | FunctionCall;

export interface StringLiteral extends BaseNode {
  type: 'StringLiteral';
  value: string;
}

export interface NumberLiteral extends BaseNode {
  type: 'NumberLiteral';
  value: number;
}

export interface BooleanLiteral extends BaseNode {
  type: 'BooleanLiteral';
  value: boolean;
}

export interface ArrayLiteral extends BaseNode {
  type: 'ArrayLiteral';
  elements: Expression[];
}

export interface ObjectLiteral extends BaseNode {
  type: 'ObjectLiteral';
  properties: Record<string, Expression>;
}

export interface Identifier extends BaseNode {
  type: 'Identifier';
  name: string;
}

export interface FunctionCall extends BaseNode {
  type: 'FunctionCall';
  name: string;
  arguments: Expression[];
}

export interface Token {
  type: string;
  value: string;
  location: Location;
} 