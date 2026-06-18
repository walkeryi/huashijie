// src/app/api/adventure/route.ts — 统一三阶段管线路由（根据 body.stage 分发）
import { NextRequest } from 'next/server'
import { handlePlan } from '@/lib/adventure-plan'
import { handleNarrate } from '@/lib/adventure-narrate'
import { handleChoices } from '@/lib/adventure-choices'
import { handleExtractFacts } from '@/lib/adventure-extract-facts'

export async function POST(request: NextRequest) {
  // 克隆 request 以便多次读取 body（每个 handler 独立 parse）
  const cloned = request.clone()
  let stage: string
  try {
    const body = await request.json()
    stage = body.stage || ''
  } catch {
    return new Response(JSON.stringify({ error: '无效的请求体' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  switch (stage) {
    case 'plan':
      return handlePlan(cloned)
    case 'narrate':
      return handleNarrate(cloned)
    case 'choices':
      return handleChoices(cloned)
    case 'extract-facts':
      return handleExtractFacts(cloned)
    default:
      return new Response(JSON.stringify({ error: '未知 stage: ' + stage }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
  }
}
