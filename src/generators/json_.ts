// 定义类型，严格约束 block 结构
interface BaseBlock {
  type: string
  // id?: string
  x?: number
  y?: number
  fields?: Record<string, string>
  inputs?: Record<string, { block: Block }>
  extraState?: Record<string, any>
  // statements 字段已移除，和 Blockly 序列化结构保持一致
}

interface MemberBlock extends BaseBlock {
  type: 'member'
  fields: { MEMBER_NAME: string }
  inputs: { MEMBER_VALUE: { block: Block } }
  next?: { block: MemberBlock }
}

type Block =
  | BaseBlock
  | MemberBlock

export const json2blocklyGenerator = {
  forJson: {} as Record<string, Function>,

  fromJson(val: any): Block {
    if (val === null) return json2blocklyGenerator.forJson['null']()
    if (typeof val === 'string') return json2blocklyGenerator.forJson['text'](val)
    if (typeof val === 'number') return json2blocklyGenerator.forJson['math_number'](val)
    if (typeof val === 'boolean') return json2blocklyGenerator.forJson['logic_boolean'](val)
    if (Array.isArray(val)) return json2blocklyGenerator.forJson['lists_create_with'](val)
    if (typeof val === 'object') return json2blocklyGenerator.forJson['object'](val)
    throw new Error('Unsupported type')
  },

  fromJsonString(jsonStr: string, x = 0, y = 0) {
    const json = JSON.parse(jsonStr)
    const block = json2blocklyGenerator.fromJson(json)

    // 只为根块添加坐标和ID
    if (block) {
      // block.id = 'root_' + Math.random().toString(36).substr(2, 9)
      block.x = x
      block.y = y
    }

    return {
      blocks: {
        languageVersion: 0,
        blocks: [block],
      },
    }
  },

  // 逆 scrub_，把对象的成员串成链式 member block
  scrub_(obj: Record<string, any>): MemberBlock | null {
    let prevBlock: MemberBlock | null = null
    let firstBlock: MemberBlock | null = null
    for (const [k, v] of Object.entries(obj)) {
      const memberBlock: MemberBlock = {
        type: 'member',
        fields: { MEMBER_NAME: k },
        inputs: { MEMBER_VALUE: { block: json2blocklyGenerator.fromJson(v) } },
      }
      if (!firstBlock) firstBlock = memberBlock
      if (prevBlock) prevBlock.next = { block: memberBlock }
      prevBlock = memberBlock
    }
    return firstBlock
  },
}

// 对应 jsonGenerator.forBlock['logic_null']
json2blocklyGenerator.forJson['null'] = function (): BaseBlock {
  return {
    type: 'logic_null',
  }
}

// 对应 jsonGenerator.forBlock['text']
json2blocklyGenerator.forJson['text'] = function (value: string): BaseBlock {
  return {
    type: 'text',
    fields: { TEXT: value },
  }
}

// 对应 jsonGenerator.forBlock['math_number']
json2blocklyGenerator.forJson['math_number'] = function (value: number): BaseBlock {
  return {
    type: 'math_number',
    fields: { NUM: String(value) },
  }
}

// 对应 jsonGenerator.forBlock['logic_boolean']
json2blocklyGenerator.forJson['logic_boolean'] = function (value: boolean): BaseBlock {
  return {
    type: 'logic_boolean',
    fields: { BOOL: value ? 'TRUE' : 'FALSE' },
  }
}

// 对应 jsonGenerator.forBlock['lists_create_with']
json2blocklyGenerator.forJson['lists_create_with'] = function (arr: any[]): BaseBlock {
  return {
    type: 'lists_create_with',
    extraState: { itemCount: arr.length },
    inputs: Object.fromEntries(
      arr.map((item, i) => [
        `ADD${i}`,
        { block: json2blocklyGenerator.fromJson(item) },
      ])
    ),
  }
}

// 对应 jsonGenerator.forBlock['object'] 和 scrub_
// 这里 statements 改为 inputs，和 Blockly 序列化结构保持一致
json2blocklyGenerator.forJson['object'] = function (obj: Record<string, any>): BaseBlock {
  const firstMember = json2blocklyGenerator.scrub_(obj)
  return {
    type: 'object',
    inputs: firstMember ? { MEMBERS: { block: firstMember } } : {},
  }
}
