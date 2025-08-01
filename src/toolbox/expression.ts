export const expressionToolbox = {
  'kind': 'categoryToolbox',
  'contents': [
    {
      'kind': 'category',
      'name': '基础运算',
      'colour': 230,
      'contents': [
        {
          'kind': 'block',
          'type': 'math_number'
        },
        {
          'kind': 'block',
          'type': 'math_arithmetic',
          'inputs': {
            'A': {
              'block': {
                'type': 'math_number',
                'fields': {
                  'NUM': 1
                }
              }
            },
            'B': {
              'block': {
                'type': 'math_number',
                'fields': {
                  'NUM': 2
                }
              }
            }
          }
        },
        {
          'kind': 'block',
          'type': 'math_constant'
        }
      ]
    },
    {
      'kind': 'category',
      'name': '变量',
      'colour': 330,
      'contents': [
        {
          'kind': 'block',
          'type': 'math_variable',
          'fields': {
            'VAR': 'x'
          }
        },
        {
          'kind': 'block',
          'type': 'math_variable',
          'fields': {
            'VAR': 'y'
          }
        },
        {
          'kind': 'block',
          'type': 'math_variable',
          'fields': {
            'VAR': 'z'
          }
        },
        {
          'kind': 'block',
          'type': 'math_variable',
          'fields': {
            'VAR': 'name'
          }
        },
        {
          'kind': 'block',
          'type': 'math_variable',
          'fields': {
            'VAR': 'leak'
          }
        }
      ]
    },
    {
      'kind': 'category',
      'name': '函数',
      'colour': 260,
      'contents': [
        {
          'kind': 'block',
          'type': 'math_function',
          'inputs': {
            'ARG': {
              'block': {
                'type': 'math_number',
                'fields': {
                  'NUM': 0
                }
              }
            }
          }
        },
        {
          'kind': 'block',
          'type': 'math_function_dual',
          'inputs': {
            'ARG1': {
              'block': {
                'type': 'math_variable',
                'fields': {
                  'VAR': 'x'
                }
              }
            },
            'ARG2': {
              'block': {
                'type': 'math_variable',
                'fields': {
                  'VAR': 'y'
                }
              }
            }
          }
        }
      ]
    },
    {
      'kind': 'category',
      'name': '逻辑运算',
      'colour': 210,
      'contents': [
        {
          'kind': 'block',
          'type': 'logic_compare',
          'inputs': {
            'A': {
              'block': {
                'type': 'math_number',
                'fields': {
                  'NUM': 1
                }
              }
            },
            'B': {
              'block': {
                'type': 'math_number',
                'fields': {
                  'NUM': 2
                }
              }
            }
          }
        },
        {
          'kind': 'block',
          'type': 'logic_operation',
          'inputs': {
            'A': {
              'block': {
                'type': 'logic_boolean'
              }
            },
            'B': {
              'block': {
                'type': 'logic_boolean'
              }
            }
          }
        },
        {
          'kind': 'block',
          'type': 'logic_negate',
          'inputs': {
            'BOOL': {
              'block': {
                'type': 'logic_boolean'
              }
            }
          }
        },
        {
          'kind': 'block',
          'type': 'logic_boolean'
        },
        {
          'kind': 'block',
          'type': 'logic_ternary',
          'inputs': {
            'IF': {
              'block': {
                'type': 'logic_boolean'
              }
            },
            'THEN': {
              'block': {
                'type': 'math_number',
                'fields': {
                  'NUM': 1
                }
              }
            },
            'ELSE': {
              'block': {
                'type': 'math_number',
                'fields': {
                  'NUM': 0
                }
              }
            }
          }
        }
      ]
    },
    {
      'kind': 'category',
      'name': '字符串',
      'colour': 160,
      'contents': [
        {
          'kind': 'block',
          'type': 'text_string',
          'fields': {
            'TEXT': 'hello'
          }
        },
        {
          'kind': 'block',
          'type': 'text_join',
          'inputs': {
            'A': {
              'block': {
                'type': 'text_string',
                'fields': {
                  'TEXT': 'hello'
                }
              }
            },
            'B': {
              'block': {
                'type': 'text_string',
                'fields': {
                  'TEXT': 'world'
                }
              }
            }
          }
        }
      ]
    }
  ]
}
