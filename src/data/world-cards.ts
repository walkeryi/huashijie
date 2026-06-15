import { WorldCard } from '@/lib/types'

export const presetWorldCards: WorldCard[] = [
  {
    id: 'steampunk_skyfall',
    name: '蒸汽苍穹',
    subtitle: '天空之城正在坠落，你是唯一能拯救它的人',
    description: `## 世界观
蒸汽朋克时代，魔法与机械并存。七座天空之城靠核心水晶悬浮于云海之上。
但第三天空城「铁鹰城」的核心水晶被人窃走，城市正在缓慢下坠。
地面上，被流放的地底工匠和荒野流民虎视眈眈。

## 规则
- 这是一个魔法与蒸汽科技共存的世界
- 天空城分为三个阵营：天空贵族、地底工匠、荒野流民
- 核心冲突：谁偷走了铁鹰城的核心水晶？为什么？
- 基调：灰暗但保留希望，冒险中带有幽默

## 开场
玩家是铁鹰城的一名年轻机械师学徒，在一艘坠毁的飞艇残骸中醒来，失去了最近几天的记忆。`,
    coverEmoji: '⚙️',
    initialScene: '你在一艘坠毁的飞艇残骸中醒来。头痛欲裂，身上有几处擦伤。窗外是云层和正在下坠的城市碎片。你隐约记得自己曾在追查核心水晶的线索，但具体是什么……完全想不起来了。残骸外传来脚步声，有人正在靠近。',
    attributes: [
      { key: 'courage', name: '勇气', icon: '⚔️', initial: 3, max: 10 },
      { key: 'intellect', name: '智力', icon: '🧠', initial: 5, max: 10 },
      { key: 'charm', name: '魅力', icon: '💬', initial: 3, max: 10 },
      { key: 'mechanical', name: '机械', icon: '🔧', initial: 4, max: 10 },
    ],
    npcs: [
      { id: 'old_mechanic', name: '老机械师陈', description: '铁鹰城退休首席机械师，对核心水晶了如指掌。脾气古怪但心肠不坏。', initialAffinity: 20 },
      { id: 'guard_captain', name: '卫队长赵', description: '铁鹰城卫队长，忠于职守。对贵族不满但不敢公开对抗。', initialAffinity: 0 },
      { id: 'sky_noble', name: '天空贵族洛', description: '年轻的贵族小姐，对机械和冒险充满好奇。是贵族中的异类。', initialAffinity: 10 },
    ],
    flags: ['found_crystal_clue', 'allied_with_mechanics', 'confronted_nobles', 'discovered_truth'],
    startingItems: ['机械扳手', '残破的飞艇日志'],
  },
  {
    id: 'jade_dynasty',
    name: '玉京风华',
    subtitle: '在神灵隐退的王朝末年，寻找最后一只灵兽',
    description: `## 世界观
架空的东方古风世界。王朝「玉京」已延续三百年，但灵力日渐稀薄。
传说中的灵兽逐一消失，庙宇荒废，神像蒙尘。
民间流传：当最后一只灵兽也离去，王朝的龙脉将彻底断裂，灾祸降临。

## 规则
- 这是一个低魔东方奇幻世界
- 灵力尚存但日渐式微，法术需要极大代价
- 各方势力：朝廷、修行者、民间异士、灵兽守护者
- 核心冲突：是否能让灵兽回归？龙脉断裂真是坏事吗？
- 基调：典雅含蓄，山水画般的意境

## 开场
玩家是京城一位落魄书生，偶然在旧书摊发现了一本记载灵兽行踪的古卷。`,
    coverEmoji: '🏮',
    initialScene: '春雨绵绵，你撑着油纸伞走在京城青石板路上。怀里的古卷还带着旧书摊的霉味，但上面画的灵兽图样……你昨晚对照星图比了一夜，竟然是真的方位。巷口茶馆里有人说书，讲的正是「龙脉将断，天下大乱」。你握紧了袖子里的几枚铜钱，是该先进茶馆打听消息，还是立刻按图索骥出城寻找灵兽？',
    attributes: [
      { key: 'courage', name: '胆识', icon: '⚔️', initial: 2, max: 10 },
      { key: 'wisdom', name: '慧根', icon: '📿', initial: 5, max: 10 },
      { key: 'charm', name: '风雅', icon: '🎋', initial: 4, max: 10 },
      { key: 'spirit', name: '灵力', icon: '✨', initial: 3, max: 10 },
    ],
    npcs: [
      { id: 'tea_master', name: '茶馆说书人柳', description: '京城茶馆的说书先生，消息灵通。似乎知道很多不该知道的事。', initialAffinity: 30 },
      { id: 'spirit_guardian', name: '灵兽守护者青', description: '隐居山林的灵兽守护者，沉默寡言。对灵力的感知异常敏锐。', initialAffinity: 5 },
      { id: 'court_official', name: '朝廷密使白', description: '奉旨追查龙脉异象的密使。表面冷漠，内心对朝廷的腐败深恶痛绝。', initialAffinity: -10 },
    ],
    flags: ['found_ancient_scroll', 'awakened_spirit_sense', 'exposed_corruption', 'reunited_last_beast'],
    startingItems: ['泛黄的古卷', '铜钱 x5'],
  },
]
