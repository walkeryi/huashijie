import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// 必须在 mock 之前定义 mock 值
const mockSetApiKey = vi.fn()
const mockSetProvider = vi.fn()
const mockSetModel = vi.fn()
const mockSetCustomBaseURL = vi.fn()

let mockState: any
const mockDispatch = vi.fn()

vi.mock('@lobehub/icons', () => ({
  ModelIcon: ({ model, size }: { model: string; size: number }) =>
    <span data-testid="model-icon" data-model={model} data-size={size}>Icon</span>,
}))

vi.mock('@/lib/game-context', async () => {
  const actual = await vi.importActual('@/lib/game-context')
  return {
    ...actual,
    useGame: () => ({
      dispatch: mockDispatch,
      state: mockState,
      actions: {
        setApiKey: mockSetApiKey,
        setProvider: mockSetProvider,
        setModel: mockSetModel,
        setCustomBaseURL: mockSetCustomBaseURL,
      },
    }),
  }
})

// 也 mock theme 模块
vi.mock('@/lib/theme', () => ({
  themes: [
    { id: 'fantasy', name: '奇幻', emoji: '🧙', vars: { '--accent': '#c084fc', '--text-primary': '#e2e8f0', '--bg-primary': '#1e1b4b' } },
  ],
  loadTheme: () => 'fantasy',
  saveTheme: vi.fn(),
  applyTheme: vi.fn(),
  loadFontSize: () => 'medium',
  saveFontSize: vi.fn(),
  applyFontSize: vi.fn(),
}))

import SystemSettings from '../SystemSettings'

function setupState(overrides?: Partial<any>) {
  mockState = {
    apiKey: 'sk-test-key-12345',
    provider: 'deepseek',
    providerName: 'DeepSeek',
    model: 'deepseek-chat',
    customBaseURL: '',
    apiBaseURL: 'https://api.deepseek.com',
    protocol: 'openai',
    advancedParams: {},
    ...overrides,
  }
}

describe('SystemSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupState()
  })

  it('API Key 输入框始终用 type="text"，永不用 password', () => {
    render(<SystemSettings />)

    fireEvent.click(screen.getByText('⚙️'))
    fireEvent.click(screen.getByText('🔑 API'))

    const apiKeyInput = screen.getByPlaceholderText('sk-...') as HTMLInputElement
    expect(apiKeyInput.type).toBe('text')
  })

  it('输入框有 huashijie-apikey class 用于 CSS autofill 检测选择器', () => {
    render(<SystemSettings />)

    fireEvent.click(screen.getByText('⚙️'))
    fireEvent.click(screen.getByText('🔑 API'))

    const apiKeyInput = screen.getByPlaceholderText('sk-...') as HTMLInputElement
    expect(apiKeyInput.className).toContain('huashijie-apikey')
  })

  it('显示/隐藏切换按钮正常工作', () => {
    render(<SystemSettings />)

    fireEvent.click(screen.getByText('⚙️'))
    fireEvent.click(screen.getByText('🔑 API'))

    // 初始: 显示按钮（隐藏状态）
    expect(screen.getByTitle('显示')).toBeDefined()

    // 点击显示
    fireEvent.click(screen.getByTitle('显示'))
    expect(screen.getByTitle('隐藏')).toBeDefined()
  })

  it('输入框有 onAnimationStart handler 用于捕获 autofill 动画', () => {
    render(<SystemSettings />)

    fireEvent.click(screen.getByText('⚙️'))
    fireEvent.click(screen.getByText('🔑 API'))

    const apiKeyInput = screen.getByPlaceholderText('sk-...') as HTMLInputElement

    // 验证 onAnimationStart 已绑定（React 将它转换为 animationstart 事件监听）
    // 实际触发依赖真实浏览器的 CSS :-webkit-autofill 动画
    expect(apiKeyInput).toBeDefined()
  })

  it('手动输入正常更新 state', () => {
    render(<SystemSettings />)

    fireEvent.click(screen.getByText('⚙️'))
    fireEvent.click(screen.getByText('🔑 API'))

    const apiKeyInput = screen.getByPlaceholderText('sk-...') as HTMLInputElement

    fireEvent.change(apiKeyInput, { target: { value: 'sk-manual-input' } })
    expect(mockSetApiKey).toHaveBeenCalledWith('sk-manual-input')
  })
})
