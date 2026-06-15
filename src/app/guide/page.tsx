import { readFileSync } from 'fs'
import { join } from 'path'
import Link from 'next/link'

function markdownToHtml(md: string): string {
  let html = md
  // 标题
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold mt-6 mb-2 text-[var(--text-primary)]">$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-8 mb-3 pb-2 border-b border-[var(--border)] text-[var(--text-primary)]">$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold mb-2 text-[var(--text-primary)]">$1</h1>')
  // 引用
  html = html.replace(/^> (.+)$/gm, '<blockquote class="border-l-2 border-[var(--accent)] pl-4 py-1 text-[var(--text-secondary)] italic my-3">$1</blockquote>')
  // 分隔线
  html = html.replace(/^---$/gm, '<hr class="border-[var(--border)] my-6" />')
  // 粗体
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="text-[var(--text-primary)]">$1</strong>')
  // 行内代码
  html = html.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-sm font-mono text-[var(--accent)]">$1</code>')
  // 无序列表
  html = html.replace(/^- (.+)$/gm, '<li class="ml-4 text-[var(--text-secondary)] leading-relaxed">$1</li>')
  // 表格
  html = html.replace(/^\|(.+)\|$/gm, (match) => {
    const cells = match.split('|').filter(c => c.trim())
    const isHeader = /^[\s-]+$/.test(cells[0] || '')
    if (isHeader) return ''
    const tag = match.includes('---') ? '' : 'td'
    if (!tag) return ''
    const content = cells.map(c => {
      const trimmed = c.trim()
      if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
        return `<th class="px-3 py-2 text-left text-sm font-bold text-[var(--text-primary)] bg-[var(--bg-primary)]">${trimmed.slice(2, -2)}</th>`
      }
      return `<td class="px-3 py-2 text-sm text-[var(--text-secondary)] border-t border-[var(--border)]">${trimmed}</td>`
    }).join('')
    return `<tr>${content}</tr>`
  })
  // 代码块
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] overflow-x-auto my-3 text-sm font-mono text-[var(--text-secondary)]">$2</pre>')
  // 段落
  html = html.replace(/^(?!<[a-z/])(.+)$/gm, (match) => {
    if (match.trim() === '') return ''
    return `<p class="text-[var(--text-secondary)] leading-relaxed my-2">${match}</p>`
  })
  return html
}

export default function GuidePage() {
  const filePath = join(process.cwd(), 'docs', '玩家创作指南.md')
  const md = readFileSync(filePath, 'utf-8')
  const html = markdownToHtml(md)

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* 顶部栏 */}
      <div className="sticky top-0 z-40 bg-[var(--bg-primary)]/95 backdrop-blur border-b border-[var(--border)]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/creator" className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors">
            ← 返回创作台
          </Link>
          <span className="text-sm text-[var(--text-secondary)]">📖 玩家创作指南</span>
          <div className="w-20" />
        </div>
      </div>

      {/* 内容 */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="prose-custom" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  )
}
