import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
  emit: vi.fn(),
}));

vi.mock('@/lib/tauri', () => ({
  tauriApi: {
    generateSyncPlan: vi.fn(),
    applySyncOpencodeToClaude: vi.fn(),
    applySyncClaudeToOpencode: vi.fn(),
    nuclearRestart: vi.fn(),
  },
}));
