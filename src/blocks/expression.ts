import * as Blockly from 'blockly/core'

export const expressionBlocks = Blockly.common.createBlockDefinitionsFromJsonArray([
  // 数学运算块
  {
    "type": "math_arithmetic",
    "message0": "%1 %2 %3",
    "args0": [
      {
        "type": "input_value",
        "name": "A",
        "check": "Number"
      },
      {
        "type": "field_dropdown",
        "name": "OP",
        "options": [
          ["+", "ADD"],
          ["-", "MINUS"],
          ["×", "MULTIPLY"],
          ["÷", "DIVIDE"],
          ["^", "POWER"]
        ]
      },
      {
        "type": "input_value",
        "name": "B",
        "check": "Number"
      }
    ],
    "inputsInline": true,
    "output": "Number",
    "colour": 230
  },
  // 数字输入块
  {
    "type": "math_number",
    "message0": "%1",
    "args0": [
      {
        "type": "field_number",
        "name": "NUM",
        "value": 0
      }
    ],
    "output": "Number",
    "colour": 230
  },
  // 变量块
  {
    "type": "math_variable",
    "message0": "%1",
    "args0": [
      {
        "type": "field_input",
        "name": "VAR",
        "text": "x"
      }
    ],
    "output": "Number",
    "colour": 330
  },
  // 函数调用块
  {
    "type": "math_function",
    "message0": "%1 ( %2 )",
    "args0": [
      {
        "type": "field_dropdown",
        "name": "FUNC",
        "options": [
          ["sin", "sin"],
          ["cos", "cos"],
          ["tan", "tan"],
          ["log", "log"],
          ["sqrt", "sqrt"],
          ["abs", "abs"],
          ["ceil", "ceil"],
          ["floor", "floor"],
          ["round", "round"],
          ["exp", "exp"]
        ]
      },
      {
        "type": "input_value",
        "name": "ARG",
        "check": "Number"
      }
    ],
    "inputsInline": true,
    "output": "Number",
    "colour": 260
  },
  // 双参数函数块
  {
    "type": "math_function_dual",
    "message0": "%1 ( %2 , %3 )",
    "args0": [
      {
        "type": "field_dropdown",
        "name": "FUNC",
        "options": [
          ["equalText", "equalText"],
          ["compareExpr", "compareExpr"],
          ["min", "min"],
          ["max", "max"],
          ["pow", "pow"],
          ["atan2", "atan2"],
          ["gcd", "gcd"],
          ["lcm", "lcm"]
        ]
      },
      {
        "type": "input_value",
        "name": "ARG1",
        "check": ["Number", "String", "Boolean"]
      },
      {
        "type": "input_value",
        "name": "ARG2",
        "check": ["Number", "String", "Boolean"]
      }
    ],
    "inputsInline": true,
    "output": "Boolean",
    "colour": 260
  },
  // 括号块 - 通用表达式 (原 math_parentheses，现在支持所有类型)
  {
    "type": "math_parentheses",
    "message0": "( %1 )",
    "args0": [
      {
        "type": "input_value",
        "name": "EXPR"
      }
    ],
    "output": null,
    "colour": 230
  },
  // 括号块 - 逻辑表达式专用
  {
    "type": "logic_parentheses",
    "message0": "( %1 )",
    "args0": [
      {
        "type": "input_value",
        "name": "EXPR",
        "check": "Boolean"
      }
    ],
    "output": "Boolean",
    "colour": 210
  },
  // 常量块
  {
    "type": "math_constant",
    "message0": "%1",
    "args0": [
      {
        "type": "field_dropdown",
        "name": "CONSTANT",
        "options": [
          ["π", "PI"],
          ["e", "E"],
          ["φ", "PHI"],
          ["∞", "INFINITY"]
        ]
      }
    ],
    "output": "Number",
    "colour": 230
  },
  // 比较运算块
  {
    "type": "logic_compare",
    "message0": "%1 %2 %3",
    "args0": [
      {
        "type": "input_value",
        "name": "A"
      },
      {
        "type": "field_dropdown",
        "name": "OP",
        "options": [
          ["=", "EQ"],
          ["≠", "NEQ"],
          ["<", "LT"],
          ["≤", "LTE"],
          [">", "GT"],
          ["≥", "GTE"]
        ]
      },
      {
        "type": "input_value",
        "name": "B"
      }
    ],
    "inputsInline": true,
    "output": "Boolean",
    "colour": 210
  },
  // 逻辑运算块
  {
    "type": "logic_operation",
    "message0": "%1 %2 %3",
    "args0": [
      {
        "type": "input_value",
        "name": "A",
        "check": "Boolean"
      },
      {
        "type": "field_dropdown",
        "name": "OP",
        "options": [
          ["and", "AND"],
          ["or", "OR"]
        ]
      },
      {
        "type": "input_value",
        "name": "B",
        "check": "Boolean"
      }
    ],
    "inputsInline": false,
    "output": "Boolean",
    "colour": 210
  },
  // 逻辑非块
  {
    "type": "logic_negate",
    "message0": "not %1",
    "args0": [
      {
        "type": "input_value",
        "name": "BOOL",
        "check": "Boolean"
      }
    ],
    "output": "Boolean",
    "colour": 210
  },
  // 布尔值块
  {
    "type": "logic_boolean",
    "message0": "%1",
    "args0": [
      {
        "type": "field_dropdown",
        "name": "BOOL",
        "options": [
          ["true", "TRUE"],
          ["false", "FALSE"]
        ]
      }
    ],
    "output": "Boolean",
    "colour": 210
  },
  // 三元运算块
  {
    "type": "logic_ternary",
    "message0": "if %1 then %2 else %3",
    "args0": [
      {
        "type": "input_value",
        "name": "IF",
        "check": "Boolean"
      },
      {
        "type": "input_value",
        "name": "THEN"
      },
      {
        "type": "input_value",
        "name": "ELSE"
      }
    ],
    "output": null,
    "colour": 210
  },
  // 字符串字面量块
  {
    "type": "text_string",
    "message0": "\"%1\"",
    "args0": [
      {
        "type": "field_input",
        "name": "TEXT",
        "text": ""
      }
    ],
    "output": "String",
    "colour": 160
  },
  // 字符串连接块
  {
    "type": "text_join",
    "message0": "concat( %1 , %2 )",
    "args0": [
      {
        "type": "input_value",
        "name": "A",
        "check": ["String", "Number"]
      },
      {
        "type": "input_value",
        "name": "B",
        "check": ["String", "Number"]
      }
    ],
    "inputsInline": true,
    "output": "String",
    "colour": 160
  }
])
