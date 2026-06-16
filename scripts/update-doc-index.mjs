/**
 * 扫描 docs/business/ 和 docs/as-built/ 下的 .md 文件，
 * 解析 YAML Frontmatter（name + description），
 * 自动更新 CLAUDE.md 中的文档索引列表。
 *
 * 用法：node scripts/update-doc-index.mjs
 */

import { readFileSync, readdirSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const SECTIONS = [
  {
    dir: 'docs/business',
    startSentinel: '<!-- BUSINESS_DOCS_LIST:START -->',
    endSentinel: '<!-- BUSINESS_DOCS_LIST:END -->',
    heading: '## 业务文档',
  },
  {
    dir: 'docs/as-built',
    startSentinel: '<!-- TECH_REFS_LIST:START -->',
    endSentinel: '<!-- TECH_REFS_LIST:END -->',
    heading: '## 技术参考',
  },
]

/**
 * 简易 YAML Frontmatter 解析，只提取 name 和 description 两个标量字段。
 * 返回 { name, description }，缺失时抛错。
 */
function parseFrontmatter(filePath) {
  const raw = readFileSync(filePath, 'utf-8')
  const match = raw.match(/^---\n([\s\S]*?)\n---/)
  if (!match) {
    throw new Error(`${filePath}: 缺少 YAML Frontmatter`)
  }
  const fm = match[1]
  const name = fm.match(/^name:\s*(.+)$/m)?.[1]?.trim()
  const desc = fm.match(/^description:\s*(.+)$/m)?.[1]?.trim()
  if (!name) throw new Error(`${filePath}: name 字段缺失`)
  if (!desc) throw new Error(`${filePath}: description 字段缺失`)
  // 去掉首尾引号
  return {
    name,
    description: desc.replace(/^["']|["']$/g, ''),
  }
}

/**
 * 扫描目录下所有 .md 文件，按文件名排序，提取 frontmatter，
 * 生成 `- name: description → path` 行列表。
 */
function buildList(dir) {
  const absDir = resolve(ROOT, dir)
  const files = readdirSync(absDir).filter(f => f.endsWith('.md') && f !== 'CLAUDE.md').sort()
  return files.map(f => {
    const fullPath = resolve(absDir, f)
    const relativePath = `${dir}/${f}`
    const { name, description } = parseFrontmatter(fullPath)
    return `- ${name}: ${description} → ${relativePath}`
  })
}

/**
 * 替换 CLAUDE.md 中 sentinel 之间的内容。
 */
function replaceSection(claudePath, startSentinel, endSentinel, heading, lines) {
  let content = readFileSync(claudePath, 'utf-8')
  const startIdx = content.indexOf(startSentinel)
  const endIdx = content.indexOf(endSentinel)

  if (startIdx === -1 || endIdx === -1) {
    throw new Error(`找不到 sentinel: ${startSentinel} / ${endSentinel}`)
  }

  const before = content.slice(0, startIdx + startSentinel.length)
  const after = content.slice(endIdx)
  const newBody = ['', heading, '', ...lines, ''].join('\n')
  const updated = before + newBody + after

  if (updated === content) {
    return false
  }

  writeFileSync(claudePath, updated, 'utf-8')
  return true
}

// ─── 主流程 ────────────────────────────────────────────────
const claudePath = resolve(ROOT, 'CLAUDE.md')
let anyChanged = false

for (const { dir, startSentinel, endSentinel, heading } of SECTIONS) {
  const lines = buildList(dir)
  const changed = replaceSection(claudePath, startSentinel, endSentinel, heading, lines)
  anyChanged = anyChanged || changed
  const prefix = changed ? '✓' : '○'
  console.log(`${prefix} ${dir}/ (${lines.length} 篇)`)
}

console.log(anyChanged ? '\n已更新 CLAUDE.md' : '\n无需更新')
