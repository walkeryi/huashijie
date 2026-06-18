// src/lib/fact-dedup.ts
// 确定性事实去重 — 不依赖 AI 自觉

/**
 * Levenshtein 编辑距离
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  // 滚动数组，仅需两行
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  let curr = new Array<number>(n + 1)
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(
        curr[j - 1] + 1,       // 插入
        prev[j] + 1,           // 删除
        prev[j - 1] + cost,    // 替换
      )
    }
    const tmp = prev
    prev = curr
    curr = tmp
  }
  return prev[n]
}

/**
 * 两条事实是否重复（相似度 > 0.7）
 */
function isDuplicate(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return true
  const dist = levenshteinDistance(a, b)
  return 1 - dist / maxLen > 0.7
}

/**
 * 对事实列表去重，保持原始顺序（先出现的保留）
 */
export function deduplicateFacts(facts: string[]): string[] {
  const result: string[] = []
  for (const fact of facts) {
    const trimmed = fact.trim()
    if (!trimmed) continue
    if (result.some(existing => isDuplicate(existing, trimmed))) continue
    result.push(trimmed)
  }
  return result
}
