{
  function makeLocation(location) {
    return {
      start: location.start,
      end: location.end
    };
  }
}

// Whitespace and Comments
_ "whitespace"
  = (WhiteSpace / Comment)*

WhiteSpace
  = [ \t\n\r]+

Comment
  = SingleLineComment
  / MultiLineComment

SingleLineComment
  = "//" (!LineTerminator .)* LineTerminator?

MultiLineComment
  = "/*" (!"*/" .)* "*/"

LineTerminator
  = [\n\r]

Program
  = _ defs:PromptDefinition* _ {
    return {
      type: 'Program',
      body: defs,
      location: makeLocation(location())
    };
  }

PromptDefinition
  = _ "prompt" __ name:Identifier _ "{" _
    source:SourceDefinition _
    variables:VariablesDefinition? _
    validation:ValidationDefinition? _
    output:OutputDefinition? _
    "}" _ {
    return {
      type: 'PromptDefinition',
      name: name.name,
      source,
      variables,
      validation,
      output,
      location: makeLocation(location())
    };
  }

__ "required whitespace"
  = WhiteSpace

SourceDefinition
  = "source" _ ":" _ sourceType:SourceType _ "(" _ path:StringLiteral _ ")" _ "{" _
    config:ConfigOption* _
    "}" {
    return {
      type: 'SourceDefinition',
      sourceType,
      sourcePath: path.value,
      config,
      location: makeLocation(location())
    };
  }

VariablesDefinition
  = "variables" _ "{" _
    vars:(VariableDeclaration (_ ";" _)*)*
    "}" {
    return {
      type: 'VariablesDefinition',
      variables: vars.map(v => v[0]),
      location: makeLocation(location())
    };
  }

VariableDeclaration
  = name:Identifier _ ":" _ type:TypeReference {
    return {
      type: 'VariableDeclaration',
      name: name.name,
      variableType: type,
      location: makeLocation(location())
    };
  }

TypeReference
  = UnionType
  / SimpleType
  / StringLiteralType

UnionType
  = head:StringLiteralType tail:(_ "|" _ StringLiteralType)+ {
    return {
      type: 'TypeReference',
      typeName: 'union',
      isArray: false,
      unionTypes: [head].concat(tail.map(t => t[3])),
      location: makeLocation(location())
    };
  }

StringLiteralType
  = value:StringLiteral {
    return {
      type: 'TypeReference',
      typeName: 'string',
      value: value.value,
      isArray: false,
      location: makeLocation(location())
    };
  }

SimpleType
  = name:("string" / "number" / "boolean") {
    return {
      type: 'TypeReference',
      typeName: text(),
      isArray: false,
      location: makeLocation(location())
    };
  }

ValidationDefinition
  = "validation" _ "{" _
    rules:(ValidationRule (_ ";" _)*)*
    "}" {
    return {
      type: 'ValidationDefinition',
      rules: rules.map(r => r[0]),
      location: makeLocation(location())
    };
  }

ValidationRule
  = target:Identifier _ ":" _ expr:ValidationExpression {
    return {
      type: 'ValidationRule',
      target: target.name,
      rules: [expr],
      location: makeLocation(location())
    };
  }

ValidationExpression
  = expr:RequiredExpr {
    return {
      type: 'ValidationExpression',
      name: expr.value,
      arguments: [],
      isRequired: true,
      isOptional: false,
      location: makeLocation(location())
    };
  }

RequiredExpr
  = "required" {
    return {
      type: 'Identifier',
      value: 'required',
      location: makeLocation(location())
    };
  }

OutputDefinition
  = "output" _ "{" _
    format:FormatOption _
    "}" {
    return {
      type: 'OutputDefinition',
      format: format.value,
      options: [],
      location: makeLocation(location())
    };
  }

FormatOption
  = "format" _ ":" _ value:StringLiteral {
    return {
      type: 'ConfigOption',
      key: 'format',
      value,
      location: makeLocation(location())
    };
  }

SourceType
  = "url" / "file" / "git"

ConfigOption
  = key:Identifier _ ":" _ value:Expression {
    return {
      type: 'ConfigOption',
      key: key.name,
      value,
      location: makeLocation(location())
    };
  }

Expression
  = StringLiteral
  / NumberLiteral
  / BooleanLiteral
  / Identifier

StringLiteral
  = '"' value:([^"\\] / "\\" .)* '"' {
    return {
      type: 'StringLiteral',
      value: value.map(v => Array.isArray(v) ? v[0] : v).join(''),
      location: makeLocation(location())
    };
  }

NumberLiteral
  = value:([0-9]+ ("." [0-9]+)?) {
    return {
      type: 'NumberLiteral',
      value: parseFloat(value.flat().join('')),
      location: makeLocation(location())
    };
  }

BooleanLiteral
  = value:("true" / "false") {
    return {
      type: 'BooleanLiteral',
      value: value === 'true',
      location: makeLocation(location())
    };
  }

Identifier
  = !("true" / "false" / "null" / "undefined") name:IdentifierName {
    return {
      type: 'Identifier',
      name: text(),
      location: makeLocation(location())
    };
  }

IdentifierName
  = [a-zA-Z_][a-zA-Z0-9_-]* 