import Link from 'next/link'

/* ------------------------------------------------------------------ */
/*  TOC 数据结构                                                       */
/* ------------------------------------------------------------------ */
interface TocItem {
  id: string
  label: string
  depth: number
}

const toc: TocItem[] = [
  { id: 'overview', label: '概述', depth: 1 },
  { id: 'attributes', label: '一、玩家属性：怎么影响剧情', depth: 1 },
  { id: 'attributes-what', label: '属性是什么', depth: 2 },
  { id: 'attributes-how', label: '怎么影响剧情', depth: 2 },
  { id: 'attributes-channels', label: '三个渠道', depth: 3 },
  { id: 'attributes-tips', label: '设计建议', depth: 2 },
  { id: 'npc', label: '二、NPC：怎么起作用', depth: 1 },
  { id: 'npc-what', label: 'NPC 是什么', depth: 2 },
  { id: 'npc-how', label: 'NPC 怎么影响剧情', depth: 2 },
  { id: 'npc-channels', label: '四个渠道', depth: 3 },
  { id: 'npc-tips', label: '设计建议', depth: 2 },
  { id: 'items', label: '三、物品：怎么用', depth: 1 },
  { id: 'items-what', label: '物品是什么', depth: 2 },
  { id: 'items-how', label: '物品怎么影响剧情', depth: 2 },
  { id: 'items-tips', label: '设计建议', depth: 2 },
  { id: 'flags', label: '四、旗标：记录「发生了什么」', depth: 1 },
  { id: 'flags-what', label: '旗标是什么', depth: 2 },
  { id: 'flags-how', label: '怎么用', depth: 2 },
  { id: 'flags-tips', label: '设计建议', depth: 2 },
  { id: 'beats', label: '五、节拍链：设计故事走向', depth: 1 },
  { id: 'beats-what', label: '节拍是什么', depth: 2 },
  { id: 'beats-structure', label: '每个节拍包含什么', depth: 2 },
  { id: 'beats-ai', label: 'AI 在节拍框架里怎么工作', depth: 2 },
  { id: 'beats-tips', label: '设计建议', depth: 2 },
  { id: 'checklist', label: '六、创作检查清单', depth: 1 },
  { id: 'appendix', label: '附录：完整示例', depth: 1 },
  { id: 'appendix-example', label: '蒸汽苍穹完整规格', depth: 2 },
]

/* ------------------------------------------------------------------ */
/*  小部件                                                             */
/* ------------------------------------------------------------------ */

function TocLink({ id, label, depth }: TocItem) {
  return (
    <a
      href={`#${id}`}
      className={
        'block text-sm transition-colors rounded hover:text-[var(--accent)] ' +
        (depth === 1
          ? 'py-1.5 font-medium text-[var(--text-primary)]'
          : depth === 2
            ? 'py-1 pl-3 text-[var(--text-secondary)]'
            : 'py-0.5 pl-6 text-xs text-[var(--text-secondary)]')
      }
    >
      {label}
    </a>
  )
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-sm font-mono text-[var(--accent)]">
      {children}
    </code>
  )
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="p-4 rounded-xl bg-[#141414] border border-[var(--border)] overflow-x-auto my-4 text-sm font-mono leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap">
      {children}
    </pre>
  )
}

function BlockQuote({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-l-[3px] border-[var(--accent)] pl-5 py-2 my-6 text-[var(--text-secondary)] italic leading-relaxed">
      {children}
    </div>
  )
}

function Divider() {
  return <hr className="border-[var(--border)] my-10" />
}

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="text-xl font-bold mt-10 mb-4 pb-2 border-b border-[var(--border)] text-[var(--text-primary)] scroll-mt-20"
    >
      {children}
    </h2>
  )
}

function SubHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3
      id={id}
      className="text-lg font-semibold mt-8 mb-3 text-[var(--text-primary)] scroll-mt-20"
    >
      {children}
    </h3>
  )
}

function SubSubHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h4
      id={id}
      className="text-base font-medium mt-6 mb-2 text-[var(--accent)] scroll-mt-20"
    >
      {children}
    </h4>
  )
}

function TipList({ children }: { children: React.ReactNode }) {
  return <ul className="space-y-2 my-3">{children}</ul>
}

function TipItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="relative pl-5 text-[var(--text-secondary)] leading-relaxed before:content-['•'] before:absolute before:left-1 before:text-[var(--accent)]">
      {children}
    </li>
  )
}

/* ------------------------------------------------------------------ */
/*  表格                                                               */
/* ------------------------------------------------------------------ */

function GuideTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto my-4 rounded-xl border border-[var(--border)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--bg-secondary)]">
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-4 py-3 text-left font-semibold text-[var(--text-primary)] whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className={
                'border-t border-[var(--border)] ' +
                (ri % 2 === 1 ? 'bg-[var(--bg-secondary)]/40' : '')
              }
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="px-4 py-3 text-[var(--text-secondary)]"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  检查清单                                                           */
/* ------------------------------------------------------------------ */

function ChecklistItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 py-1.5 text-[var(--text-secondary)] leading-relaxed">
      <span className="mt-0.5 shrink-0 w-4 h-4 rounded border border-[var(--accent)] flex items-center justify-center text-[10px] text-[var(--accent)]">
        ✓
      </span>
      <span>{children}</span>
    </li>
  )
}

/* ------------------------------------------------------------------ */
/*  主页面                                                             */
/* ------------------------------------------------------------------ */

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* ============ 顶栏 ============ */}
      <header className="sticky top-0 z-40 bg-[var(--bg-primary)]/95 backdrop-blur-sm border-b border-[var(--border)]">
        <div className="flex items-center justify-between max-w-7xl mx-auto px-4 lg:px-8 py-3">
          <Link
            href="/creator"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            返回创作台
          </Link>
          <span className="text-sm text-[var(--text-secondary)]">
            玩家创作指南
          </span>
          <div className="w-24" />
        </div>
      </header>

      {/* ============ 移动端 TOC（折叠） ============ */}
      <details className="lg:hidden border-b border-[var(--border)]">
        <summary className="px-4 py-3 text-sm font-medium text-[var(--text-primary)] cursor-pointer list-none flex items-center justify-between select-none hover:bg-[var(--bg-secondary)]/50 transition-colors">
          <span>目录</span>
          <svg
            className="details-open:rotate-180 transition-transform"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>
        <nav className="px-4 pb-3 space-y-0.5">
          {toc.map((item) => (
            <TocLink key={item.id} {...item} />
          ))}
        </nav>
      </details>

      {/* ============ 主体布局 ============ */}
      <div className="flex max-w-7xl mx-auto px-4 lg:px-8">
        {/* ---- 桌面 TOC（sticky） ---- */}
        <aside className="hidden lg:block w-56 xl:w-64 shrink-0">
          <nav className="sticky top-16 pt-8 pr-4 max-h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]/60 mb-3">
              目录
            </div>
            {toc.map((item) => (
              <TocLink key={item.id} {...item} />
            ))}
          </nav>
        </aside>

        {/* ---- 内容 ---- */}
        <main className="flex-1 min-w-0 pt-8 pb-20 lg:pl-8">
          {/* ===== 标题区 ===== */}
          <h1
            id="top"
            className="text-3xl font-bold text-[var(--text-primary)] scroll-mt-20"
          >
            话世界 · 玩家创作指南
          </h1>

          <BlockQuote>
            这份文档告诉你：<strong className="text-[var(--text-primary)]">怎么设计一个你自己的文字冒险世界</strong>。
          </BlockQuote>

          <Divider />

          {/* ===== 概述 ===== */}
          <SectionHeading id="overview">概述</SectionHeading>

          <p className="text-[var(--text-secondary)] leading-relaxed my-3">
            一个「世界卡」包含六样东西：
          </p>

          <GuideTable
            headers={['模块', '是什么', '例子']}
            rows={[
              [
                <strong key="a" className="text-[var(--text-primary)]">世界观</strong>,
                '一段描述，告诉 AI 这是什么世界',
                '蒸汽朋克天空城、东方玄幻王朝、赛博朋克东京',
              ],
              [
                <strong key="b" className="text-[var(--text-primary)]">玩家属性</strong>,
                '这个世界里「重要的能力」是什么',
                '勇气、灵力、科技、声望……你自己定',
              ],
              [
                <strong key="c" className="text-[var(--text-primary)]">NPC</strong>,
                '关键人物，有好感度',
                '铁匠老王（初始好感 20）、女巫艾琳（好感 10）',
              ],
              [
                <strong key="d" className="text-[var(--text-primary)]">物品</strong>,
                '玩家开局带的 + 剧情中获得的道具',
                '生锈的钥匙、加密信件、铜币 x3',
              ],
              [
                <strong key="e" className="text-[var(--text-primary)]">旗标</strong>,
                '不可逆的剧情标记，记录「发生了什么」',
                '找到线索、结盟成功、真相揭露',
              ],
              [
                <strong key="f" className="text-[var(--text-primary)]">节拍链</strong>,
                '故事的大纲：先发生什么 → 再发生什么 → 终点',
                '苏醒 → 找线索 → 调查矿坑 → 揭示真相',
              ],
            ]}
          />

          <p className="text-[var(--text-secondary)] leading-relaxed my-3">
            AI 读取这六样东西，在框架内自由发挥。你定义边界，AI 填充细节。
          </p>

          <Divider />

          {/* ===== 一、玩家属性 ===== */}
          <SectionHeading id="attributes">一、玩家属性：怎么影响剧情</SectionHeading>

          <SubHeading id="attributes-what">属性是什么</SubHeading>

          <p className="text-[var(--text-secondary)] leading-relaxed my-3">
            属性是玩家的「能力值」，范围 0-10。你定义这个世界里什么是重要的。
          </p>

          <CodeBlock>{`蒸汽苍穹的例子：
⚔️ 勇气 (初始 3)  — 影响说服、对抗、冒险选项
🧠 智力 (初始 5)  — 影响解谜、分析线索、发现隐藏信息
💬 魅力 (初始 3)  — 影响社交、谈判、获取NPC信任
🔧 机械 (初始 4)  — 影响修理、操作机械、破解机关`}</CodeBlock>

          <SubHeading id="attributes-how">怎么影响剧情</SubHeading>

          <p className="text-[var(--text-secondary)] leading-relaxed my-3">
            属性的影响通过<strong className="text-[var(--text-primary)]">三个渠道</strong>起作用：
          </p>

          <SubSubHeading id="attributes-channel-1">渠道 1：解锁选项</SubSubHeading>
          <p className="text-[var(--text-secondary)] leading-relaxed my-2">
            在节拍或选项上设置门槛。
          </p>
          <CodeBlock>{`例子：与贵族对质 这个节拍要求 courage >= 5。
勇气不够 → 选项不出现 → 你不能直接对质 → 得先通过别的途径攒勇气。

又如：操作飞艇残骸的通讯器 要求 mechanical >= 4。
机械不够 → 操作失败 → AI 生成失败场景 → 你获得不同的体验。`}</CodeBlock>

          <SubSubHeading id="attributes-channel-2">渠道 2：影响 AI 叙事</SubSubHeading>
          <p className="text-[var(--text-secondary)] leading-relaxed my-2">
            AI 会根据你的属性调整叙述。
          </p>
          <CodeBlock>{`勇气 8 → AI 描述：「你毫不畏惧地推开大门，守卫被你的气势镇住。」
勇气 2 → AI 描述：「你手抖得厉害，推了三次才把门推开一条缝。」`}</CodeBlock>

          <SubSubHeading id="attributes-channel-3">渠道 3：属性可以在剧情中增减</SubSubHeading>
          <p className="text-[var(--text-secondary)] leading-relaxed my-2">
            AI 根据你的行为判断属性变化。
          </p>
          <CodeBlock>{`你冒险爬上了坠落飞艇的残骸 → courage +2
你仔细研究了核心水晶的构造 → intellect +1
你对 NPC 撒了谎 → charm -1`}</CodeBlock>

          <SubHeading id="attributes-tips">设计建议</SubHeading>
          <TipList>
            <TipItem><strong className="text-[var(--text-primary)]">3-5 个属性</strong>刚好。太少没区分度，太多记不住。</TipItem>
            <TipItem><strong className="text-[var(--text-primary)]">每个属性有明确的「适用场景」</strong>。别设一个从来用不上的属性。</TipItem>
            <TipItem><strong className="text-[var(--text-primary)]">初始值不要太高</strong>（3-5 合适），留增长空间。</TipItem>
            <TipItem><strong className="text-[var(--text-primary)]">属性门控的意义不是卡人，是指引</strong>——告诉玩家「提升这个能力会有新选项」。</TipItem>
            <TipItem><strong className="text-[var(--text-primary)]">给不同属性设计不同的路线</strong>。高勇气的玩家走正面冲突，高智力的玩家走破解谜题，两种路线都能推进故事，但体验不同。</TipItem>
          </TipList>

          <Divider />

          {/* ===== 二、NPC ===== */}
          <SectionHeading id="npc">二、NPC：怎么起作用</SectionHeading>

          <SubHeading id="npc-what">NPC 是什么</SubHeading>

          <p className="text-[var(--text-secondary)] leading-relaxed my-3">
            世界里的关键角色，有好感度（0-100）。好感度由 AI 根据玩家行为调整。
          </p>

          <CodeBlock>{`例子：
铁鹰城 NPC：
├── 老机械师陈 (好感 20) — 对核心水晶了如指掌，但脾气古怪
├── 卫队长赵 (好感 0) — 忠于职守，对贵族不满但不敢对抗
└── 天空贵族洛 (好感 10) — 对机械着迷的异类贵族`}</CodeBlock>

          <SubHeading id="npc-how">NPC 怎么影响剧情</SubHeading>

          <p className="text-[var(--text-secondary)] leading-relaxed my-3">
            NPC 的影响通过<strong className="text-[var(--text-primary)]">四个渠道</strong>起作用：
          </p>

          <SubSubHeading id="npc-channel-1">渠道 1：好感门槛</SubSubHeading>
          <p className="text-[var(--text-secondary)] leading-relaxed my-2">
            好感不够，NPC 不理你。
          </p>
          <CodeBlock>{`揭示真相 节拍要求 old_mechanic >= 40。
好感 20 → 老机械师对你态度冷淡，不愿透露更多。
你需要帮他修好机械臂（好感 +15）、带酒去看他（好感 +10），
好感够了，他才告诉你核心水晶的秘密。`}</CodeBlock>

          <SubSubHeading id="npc-channel-2">渠道 2：AI 根据好感调整 NPC 行为</SubSubHeading>
          <CodeBlock>{`好感 60 → 「老陈远远看见你就咧嘴笑了，连忙把你拉进工坊。」
好感 10 → 「老陈抬头看了一眼是你，继续低头摆弄零件，哼了一声。」
好感 -10 → 「老陈看见你就开始骂人了。」`}</CodeBlock>

          <SubSubHeading id="npc-channel-3">渠道 3：低好感 NPC 可能变成障碍</SubSubHeading>
          <CodeBlock>{`卫队长赵好感 -20 → 他在城门设卡，不让你通过。
你需要绕路、说服其他人担保、或者做任务补好感。`}</CodeBlock>

          <SubSubHeading id="npc-channel-4">渠道 4：不同 NPC 的好感互相影响</SubSubHeading>
          <CodeBlock>{`你帮了天空贵族洛 → 她喜欢你（好感 +10）
→ 但她父亲讨厌有人接近女儿 → 贵族阵营对你警惕
→ 卫队长赵反而因此对你态度好转（你们有了共同敌人）
AI 可以自然地处理这种连锁反应。`}</CodeBlock>

          <SubHeading id="npc-tips">设计建议</SubHeading>
          <TipList>
            <TipItem><strong className="text-[var(--text-primary)]">写清楚 NPC 是谁、想要什么、怕什么</strong>。AI 看到「他妻子三年前失踪」会自动生成相关剧情。</TipItem>
            <TipItem><strong className="text-[var(--text-primary)]">初始好感不是随机的</strong>，暗示关系起点（0 = 陌生人，20 = 熟人，-10 = 有旧怨）。</TipItem>
            <TipItem><strong className="text-[var(--text-primary)]">给每个 NPC 一个剧情贡献点</strong>——他在故事的什么环节起作用？</TipItem>
            <TipItem><strong className="text-[var(--text-primary)]">NPC 至少 2-3 个</strong>，太少没互动，太多 AI 记不住。</TipItem>
          </TipList>

          <Divider />

          {/* ===== 三、物品 ===== */}
          <SectionHeading id="items">三、物品：怎么用</SectionHeading>

          <SubHeading id="items-what">物品是什么</SubHeading>

          <p className="text-[var(--text-secondary)] leading-relaxed my-3">
            字符串标签，没有数值。AI 根据世界观判断物品的意义。
          </p>

          <CodeBlock>{`例子：
开局物品: 机械扳手、残破的飞艇日志
剧情获得: 核心水晶碎片、贵族密信、工坊钥匙
剧情消耗: 用钥匙打开门（消耗）、把密信交给 NPC（消耗）`}</CodeBlock>

          <SubHeading id="items-how">物品怎么影响剧情</SubHeading>

          <p className="text-[var(--text-secondary)] leading-relaxed my-3">
            物品的影响通过<strong className="text-[var(--text-primary)]">三个渠道</strong>起作用：
          </p>

          <SubSubHeading id="items-channel-1">渠道 1：解锁选项</SubSubHeading>
          <p className="text-[var(--text-secondary)] leading-relaxed my-2">
            有物品才能做的事情。
          </p>
          <CodeBlock>{`调查矿坑 节拍要求 持有「机械扳手」。
你有 → 可以调查 → 发现矿坑里的线索。
你没有 → 需要先找到扳手（从老机械师那里借？从废墟里挖？）。`}</CodeBlock>

          <SubSubHeading id="items-channel-2">渠道 2：AI 看到你持有物品，会围绕它生成剧情</SubSubHeading>
          <CodeBlock>{`你持有「残破的飞艇日志」→ NPC 看到会说「那是我参建的最后一批飞艇…」
你持有「铜币 x3」→ 可以在茶馆买情报，贿赂守卫，或只是买碗面吃`}</CodeBlock>

          <SubSubHeading id="items-channel-3">渠道 3：物品可以被消耗、交换、丢失</SubSubHeading>
          <CodeBlock>{`你给了 NPC 一封信 → itemsLost: ["加密信件"]，NPC 好感可能变化。
你修好了什么 → itemsGained: ["修复的通讯器"]。`}</CodeBlock>

          <SubHeading id="items-tips">设计建议</SubHeading>
          <TipList>
            <TipItem><strong className="text-[var(--text-primary)]">开局物品暗示了世界的基调</strong>。不要给无意义的物品。</TipItem>
            <TipItem><strong className="text-[var(--text-primary)]">给关键物品设计一个用途</strong>——它在什么节拍或场景里会用到？</TipItem>
            <TipItem><strong className="text-[var(--text-primary)]">物品可以触发 NPC 反应</strong>。你拿着他的东西出现在他面前……</TipItem>
            <TipItem><strong className="text-[var(--text-primary)]">不需要太多</strong>。2-3 件开局物品 + 剧情中途获得，就够了。</TipItem>
          </TipList>

          <Divider />

          {/* ===== 四、旗标 ===== */}
          <SectionHeading id="flags">四、旗标：记录「发生了什么」</SectionHeading>

          <SubHeading id="flags-what">旗标是什么</SubHeading>

          <p className="text-[var(--text-secondary)] leading-relaxed my-3">
            不可逆的布尔标记。<InlineCode>true</InlineCode> 表示「发生过」，<InlineCode>false</InlineCode> 表示「没发生过」。AI 自动管理。
          </p>

          <CodeBlock>{`例子：
found_crystal_clue (true) — 你找到了水晶的线索
allied_with_mechanics (false) — 还没和机械师公会同流
confronted_nobles (false) — 还没正面接触贵族
discovered_truth (false) — 还没发现真相`}</CodeBlock>

          <SubHeading id="flags-how">怎么用</SubHeading>

          <SubSubHeading id="flags-use-1">主要用途 1：控制节拍解锁</SubSubHeading>
          <CodeBlock>{`discover_truth (揭示真相) 需要 confronted_nobles 和 found_mine_clue 都完成。
完成 → 自动解锁 → AI 引导你进入真相揭晓的场景。`}</CodeBlock>

          <SubSubHeading id="flags-use-2">主要用途 2：控制选项可见性</SubSubHeading>
          <CodeBlock>{`你之前救了冰面上的人 → saved_worker = true
→ 矿工们认出你来，愿意带你走密道（新选项出现）。
如果你没救 → saved_worker = false
→ 矿工们不认识你，你得另想办法。`}</CodeBlock>

          <SubSubHeading id="flags-use-3">主要用途 3：AI 叙事参考</SubSubHeading>
          <CodeBlock>{`confronted_nobles = true → AI 知道「玩家已经和贵族撕破脸了」。
→ 贵族区域的 NPC 对你的态度会改变。
→ 新的风险出现（贵族派人跟踪你）。`}</CodeBlock>

          <SubHeading id="flags-tips">设计建议</SubHeading>
          <TipList>
            <TipItem><strong className="text-[var(--text-primary)]">旗标是故事的记忆</strong>。你做了什么事，旗标就记录什么。</TipItem>
            <TipItem><strong className="text-[var(--text-primary)]">旗标名字要有意义</strong>。<InlineCode>betrayed_king</InlineCode>、<InlineCode>found_clue</InlineCode>——一看就知道什么意思。</TipItem>
            <TipItem><strong className="text-[var(--text-primary)]">旗标会出现在「已解锁旗标」面板里</strong>，玩家也知道自己做了什么。</TipItem>
            <TipItem><strong className="text-[var(--text-primary)]">旗标可以和物品、NPC 好感联动</strong>。完成 <InlineCode>confronted_nobles</InlineCode> → 贵族好感 -20，但卫队长好感 +15。</TipItem>
          </TipList>

          <Divider />

          {/* ===== 五、节拍链 ===== */}
          <SectionHeading id="beats">五、节拍链：设计故事走向</SectionHeading>

          <SubHeading id="beats-what">节拍是什么</SubHeading>

          <p className="text-[var(--text-secondary)] leading-relaxed my-3">
            节拍是故事的大纲节点。你不需要写每句对话，只需要定义<strong className="text-[var(--text-primary)]">谁在什么条件之后能做什么</strong>。
          </p>

          <CodeBlock>{`蒸汽苍穹的节拍链：
intro 坠毁醒来
  ↓
find_clue 发现线索
  ↓
  ├── confront_noble 与贵族对质  (需要勇气 ≥ 5)
  └── investigate_mines 调查矿坑 (需要持有「机械扳手」且机械 ≥ 4)
  ↓
discover_truth 揭示真相 (需要老机械师好感 ≥ 40)`}</CodeBlock>

          <SubHeading id="beats-structure">每个节拍包含什么</SubHeading>

          <CodeBlock>{`{
  节拍名: "发现线索"
  节拍描述: "找到关于核心水晶下落的第一个线索——来自坠毁现场或老机械师"
  前置条件: (无)  // 一个节拍的 unlocks 列表包含它，它就解锁
  效果: {  // 完成后发生什么
    newFlags: ["found_crystal_clue"]  // 标记完成
  }
  解锁: ["confront_noble", "investigate_mines"]  // 完成后哪些节拍出现
}`}</CodeBlock>

          <SubHeading id="beats-ai">AI 在节拍框架里怎么工作</SubHeading>

          <ol className="list-decimal list-inside space-y-2 my-4 text-[var(--text-secondary)] leading-relaxed">
            <li>AI 看到你当前在哪个阶段、哪些节拍可解锁、哪些还不能碰</li>
            <li>你自由行动——探索、对话、试验</li>
            <li>当你的行动<strong className="text-[var(--text-primary)]">符合某个可用节拍的描述</strong>时，AI 判定「完成」，自动加旗标</li>
            <li>旗标驱动下一批节拍解锁</li>
            <li>节拍之间的空白，AI 完全自由发挥</li>
          </ol>

          <SubHeading id="beats-tips">设计建议</SubHeading>
          <TipList>
            <TipItem><strong className="text-[var(--text-primary)]">第一个节拍永远是不需要前置条件的</strong>（初始化场景）。</TipItem>
            <TipItem><strong className="text-[var(--text-primary)]">节拍不要太密也不要太稀</strong>。5-8 个节拍是一条合理的链。</TipItem>
            <TipItem><strong className="text-[var(--text-primary)]">让节拍之间有选择感</strong>。不是一条直线，而是两条平行的解锁。</TipItem>
            <TipItem><strong className="text-[var(--text-primary)]">终端节拍的 unlocks 留空</strong>（故事到此结束，但不阻止 AI 继续叙事）。</TipItem>
            <TipItem><strong className="text-[var(--text-primary)]">节拍描述要写清楚「完成标准」</strong>。AI 需要判断玩家是否完成了这个节拍。</TipItem>
          </TipList>

          <Divider />

          {/* ===== 六、创作检查清单 ===== */}
          <SectionHeading id="checklist">六、创作检查清单</SectionHeading>

          <p className="text-[var(--text-secondary)] leading-relaxed my-3">
            在发布你的世界卡之前，检查一遍：
          </p>

          <ul className="my-4 space-y-1">
            <ChecklistItem>世界观描述够不够详细？AI 能否从中理解这个世界的基调？</ChecklistItem>
            <ChecklistItem>属性定义清楚了吗？每个属性在什么场景发挥作用？</ChecklistItem>
            <ChecklistItem>NPC 有背景故事吗？AI 能根据背景生成合理的对话吗？</ChecklistItem>
            <ChecklistItem>NPC 的初始好感合理吗？（0=陌生人，20=熟人，负数=有矛盾）</ChecklistItem>
            <ChecklistItem>开局物品有用途吗？它们在哪些节拍中会被用到？</ChecklistItem>
            <ChecklistItem>旗标命名有意义吗？玩家看到能理解吗？</ChecklistItem>
            <ChecklistItem>节拍链是否合理？从前到后，条件是否越来越难？</ChecklistItem>
            <ChecklistItem>有没有给不同属性的玩家设计不同的路线？</ChecklistItem>
            <ChecklistItem>终端节点有明确的完成感吗？</ChecklistItem>
          </ul>

          <Divider />

          {/* ===== 附录 ===== */}
          <SectionHeading id="appendix">附录：完整示例</SectionHeading>

          <SubHeading id="appendix-example">蒸汽苍穹（steampunk_skyfall）完整规格</SubHeading>

          <p className="text-[var(--text-secondary)] leading-relaxed my-3">
            <strong className="text-[var(--text-primary)]">世界观</strong>：蒸汽朋克时代，魔法与机械并存。七座天空之城靠核心水晶悬浮。铁鹰城的核心水晶被窃，城市正在坠落。你的身份：一名年轻的机械师学徒。
          </p>

          <p className="text-[var(--text-secondary)] leading-relaxed my-3">
            <strong className="text-[var(--text-primary)]">属性</strong>：勇气(3)、智力(5)、魅力(3)、机械(4) —— 各 0-10
          </p>

          <p className="text-[var(--text-secondary)] leading-relaxed my-3">
            <strong className="text-[var(--text-primary)]">NPC</strong>：
          </p>
          <ul className="space-y-1.5 my-2 ml-5 text-[var(--text-secondary)] leading-relaxed">
            <li className="list-disc">老机械师陈（好感 20）：退休首席机械师，妻子三年前失踪，对水晶了如指掌</li>
            <li className="list-disc">卫队长赵（好感 0）：忠于职守，内心深处对贵族不满</li>
            <li className="list-disc">天空贵族洛（好感 10）：年轻女贵族，对机械充满好奇，渴望冒险</li>
          </ul>

          <p className="text-[var(--text-secondary)] leading-relaxed my-3">
            <strong className="text-[var(--text-primary)]">开局物品</strong>：机械扳手、残破的飞艇日志
          </p>

          <p className="text-[var(--text-secondary)] leading-relaxed my-3">
            <strong className="text-[var(--text-primary)]">旗标</strong>：<InlineCode>found_crystal_clue</InlineCode>、<InlineCode>allied_with_mechanics</InlineCode>、<InlineCode>confronted_nobles</InlineCode>、<InlineCode>discovered_truth</InlineCode>
          </p>

          <p className="text-[var(--text-secondary)] leading-relaxed my-3">
            <strong className="text-[var(--text-primary)]">节拍链</strong>：
          </p>
          <CodeBlock>{`坠毁醒来 → 发现线索 → [与贵族对质（需勇气5）] + [调查矿坑（需机械4+扳手）]
                                             ↘           ↙
                                           揭示真相（需老机械师好感40）`}</CodeBlock>

          <Divider />

          <BlockQuote>
            下一步：等创作台工具上线后，你就可以在浏览器里填入这些内容，点「生成」创建世界卡，立刻试玩。
          </BlockQuote>
        </main>
      </div>
    </div>
  )
}
