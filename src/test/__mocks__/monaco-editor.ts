// Monaco Editor Mock Implementation
// 提供基本的mock以支持测试环境
import { vi } from 'vitest';

export const editor = {
  create: vi.fn(() => ({
    getValue: vi.fn(() => ''),
    setValue: vi.fn(),
    dispose: vi.fn()
  }))
};

export const languages = {
  register: vi.fn(),
  json: {
    jsonDefaults: {
      setDiagnosticsOptions: vi.fn()
    }
  }
};

export default {
  editor,
  languages
};