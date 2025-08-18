// Blockly Mock Implementation
// 提供基本的mock以支持测试环境
import { vi } from 'vitest';

// 核心模块
export const common = {
  Locale: {
    setLocale: vi.fn()
  }
};

export const inject = vi.fn(() => ({
  workspace: {
    addChangeListener: vi.fn(),
    getSelected: vi.fn(),
    getAllBlocks: vi.fn(() => []),
    clear: vi.fn()
  },
  dispose: vi.fn()
}));

export const serialization = {
  workspaceToCode: vi.fn(() => '// Mock Blockly code'),
  workspaceToJson: vi.fn(() => ({ blocks: [] })),
  jsonToWorkspace: vi.fn()
};

export default {
  common,
  inject,
  serialization
};