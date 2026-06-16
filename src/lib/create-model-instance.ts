// src/lib/create-model-instance.ts — 共享 Provider 工厂函数
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

type LanguageModelV1 = ReturnType<ReturnType<typeof createAnthropic>>

export function createModelInstance(opts: {
  provider?: string
  apiKey: string
  model?: string
  customBaseURL?: string
}): LanguageModelV1 {
  const { provider, apiKey, model, customBaseURL } = opts

  if (provider === 'anthropic') {
    return createAnthropic({ apiKey })(model || 'claude-sonnet-4-6')
  }
  if (provider === 'deepseek') {
    return createOpenAICompatible({ name: 'deepseek', apiKey, baseURL: 'https://api.deepseek.com/v1' })(model || 'deepseek-v4-pro')
  }
  if (provider === 'openai') {
    return createOpenAI({ apiKey })(model || 'gpt-4o')
  }
  // custom — 必须提供 baseURL
  if (!customBaseURL) {
    throw new Error('自定义 Provider 需要填写 Base URL')
  }
  return createOpenAICompatible({ name: 'custom', apiKey, baseURL: customBaseURL })(model || 'gpt-4o')
}

/** 按 provider 解析 API Key，避免跨 provider 兜底 */
export function resolveApiKey(provider?: string, apiKeyOverride?: string): string {
  if (apiKeyOverride) return apiKeyOverride
  if (provider === 'anthropic') {
    return process.env.ANTHROPIC_API_KEY || ''
  }
  // openai / deepseek / custom 共用
  return process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || ''
}
