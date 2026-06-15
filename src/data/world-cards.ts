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
      {
        id: 'player',
        isMainCharacter: true,
        fields: {
          id: 'player',
          name: '',
          isMainCharacter: true,
          gender: '未知',
          origin: '铁鹰城年轻机械师学徒，在飞艇坠毁中失去了记忆',
          birthday: '',
          dialogueTone: '年轻、好奇、坚韧；面对危险时偶尔自嘲；对机械术语自然流露',
          dialogueExamples: '"这家伙还能修——给我五分钟。"（*蹲下检查齿轮组*）',
          personalityTags: ['坚韧', '好奇', '务实'],
          appearance: '深棕色短发，浅褐肤色，手上常年有机油印',
          currentAttire: '残破的深蓝色机械师工装，左肩有铁鹰城学徒徽章',
          initialAffinity: 0,
        },
      },
      {
        id: 'old_mechanic',
        isMainCharacter: false,
        fields: {
          id: 'old_mechanic',
          name: '老机械师陈',
          isMainCharacter: false,
          gender: '男',
          origin: '铁鹰城退休首席机械师',
          birthday: '',
          dialogueTone: '古怪、爱唠叨、偶尔蹦出真知灼见',
          dialogueExamples: '',
          personalityTags: ['古怪', '睿智'],
          appearance: '满头白发，铜框护目镜，手上全是机油',
          currentAttire: '旧皮围裙+满是口袋的工作背心',
          initialAffinity: 20,
        },
      },
      {
        id: 'guard_captain',
        isMainCharacter: false,
        fields: {
          id: 'guard_captain',
          name: '卫队长赵',
          isMainCharacter: false,
          gender: '男',
          origin: '铁鹰城卫队长，平民靠军功晋升',
          birthday: '',
          dialogueTone: '严肃、简练、偶尔流露无奈',
          dialogueExamples: '',
          personalityTags: ['正直', '压抑'],
          appearance: '中年，体格魁梧，眼角有刀疤',
          currentAttire: '铁灰色卫队制服+披风',
          initialAffinity: 0,
        },
      },
      {
        id: 'sky_noble',
        isMainCharacter: false,
        fields: {
          id: 'sky_noble',
          name: '天空贵族洛',
          isMainCharacter: false,
          gender: '女',
          origin: '天空贵族世家小姐',
          birthday: '',
          dialogueTone: '活泼、好奇、有时任性',
          dialogueExamples: '',
          personalityTags: ['活泼', '叛逆'],
          appearance: '长发及腰，虽着脏裙装仍可见贵族气质',
          currentAttire: '蓝色丝绒长裙，裙角沾了机油污渍',
          initialAffinity: 10,
        },
      },
    ],
    flags: ['found_crystal_clue', 'allied_with_mechanics', 'confronted_nobles', 'discovered_truth'],
    startingItems: ['机械扳手', '残破的飞艇日志'],
    storyBeats: [
      { id: 'intro', name: '坠毁醒来', description: '在飞艇残骸中苏醒，弄清发生了什么，决定下一步行动。', effects: {}, unlocks: ['find_clue'] },
      { id: 'find_clue', name: '发现线索', description: '找到关于核心水晶下落的第一个线索。', effects: { newFlags: ['found_crystal_clue'] }, unlocks: ['confront_noble', 'investigate_mines'] },
      { id: 'confront_noble', name: '与贵族对质', description: '接触天空贵族洛或卫队长赵，了解真相的另一面。', preconditions: { attributeChecks: { courage: '>= 5' } }, effects: { newFlags: ['confronted_nobles'] }, unlocks: ['discover_truth'] },
      { id: 'investigate_mines', name: '调查矿坑', description: '深入地下矿坑寻找核心水晶的踪迹。', preconditions: { itemChecks: ['机械扳手'], attributeChecks: { mechanical: '>= 4' } }, effects: { newFlags: ['found_mine_clue'] }, unlocks: ['discover_truth'] },
      { id: 'discover_truth', name: '揭示真相', description: '拼凑所有线索，发现核心水晶失窃背后的真正阴谋。', preconditions: { npcAffinityChecks: { old_mechanic: '>= 40' } }, effects: { newFlags: ['discovered_truth'] }, unlocks: [] },
    ],
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
      {
        id: 'player',
        isMainCharacter: true,
        fields: {
          id: 'player',
          name: '',
          isMainCharacter: true,
          gender: '男',
          origin: '京城落魄书生，偶然得到记载灵兽行踪的古卷',
          birthday: '',
          dialogueTone: '文雅、书卷气、对灵兽传说充满向往',
          dialogueExamples: '',
          personalityTags: ['好学', '敏感'],
          appearance: '青衫布衣，身形清瘦',
          currentAttire: '半旧的青色长衫，油纸伞',
          initialAffinity: 0,
        },
      },
      {
        id: 'tea_master',
        isMainCharacter: false,
        fields: {
          id: 'tea_master',
          name: '茶馆说书人柳',
          isMainCharacter: false,
          gender: '男',
          origin: '京城德胜楼茶馆说书先生，早年曾是游方术士',
          birthday: '',
          dialogueTone: '圆滑、话中有话、喜欢用说书的方式讲真话',
          dialogueExamples: '"话说天下大势，分久必合，合久必分——"（*醒木一拍，意味深长地看了你一眼*）',
          personalityTags: ['圆滑', '睿智', '神秘'],
          appearance: '六旬老者，白须飘飘，双眼有神',
          currentAttire: '灰色长袍，手持醒木',
          initialAffinity: 30,
        },
      },
      {
        id: 'spirit_guardian',
        isMainCharacter: false,
        fields: {
          id: 'spirit_guardian',
          name: '灵兽守护者青',
          isMainCharacter: false,
          gender: '女',
          origin: '隐居青州山林的最后一脉灵兽守护者',
          birthday: '',
          dialogueTone: '冷淡、疏离、谈及灵兽时流露难以察觉的温柔',
          dialogueExamples: '"此地不是凡人该来的。"（*闭着眼，手上拈着一片枯叶*）',
          personalityTags: ['冷淡', '忠诚', '敏锐'],
          appearance: '青丝如瀑，容颜清冷，眉心有一道淡青色灵纹',
          currentAttire: '青色素衣，赤足，腕系银铃',
          initialAffinity: 5,
        },
      },
      {
        id: 'court_official',
        isMainCharacter: false,
        fields: {
          id: 'court_official',
          name: '朝廷密使白',
          isMainCharacter: false,
          gender: '男',
          origin: '奉旨追查龙脉异象的朝廷密使，出身寒门靠科举入仕',
          birthday: '',
          dialogueTone: '冷漠简练、偶尔流露讽刺、被触动时会略显激动',
          dialogueExamples: '',
          personalityTags: ['冷漠', '正直', '压抑'],
          appearance: '三十岁上下，面容俊朗但神色冷峻，双目锐利',
          currentAttire: '玄青色便服，腰间挂着密使令牌（藏于衣内）',
          initialAffinity: -10,
        },
      },
    ],
    flags: ['found_ancient_scroll', 'awakened_spirit_sense', 'exposed_corruption', 'reunited_last_beast'],
    startingItems: ['泛黄的古卷', '铜钱 x5'],
    storyBeats: [
      { id: 'intro', name: '京城书生', description: '在茶馆获取信息，决定出城寻找灵兽的方向。', effects: {}, unlocks: ['find_scroll'] },
      { id: 'find_scroll', name: '寻找古卷', description: '找到完整的灵兽古卷，解锁更多线索。', effects: { newFlags: ['found_ancient_scroll'] }, unlocks: ['awaken_sense', 'ally_tea_master'] },
      { id: 'awaken_sense', name: '觉醒灵识', description: '在灵兽守护者青的指导下觉醒灵力感知。', preconditions: { npcAffinityChecks: { spirit_guardian: '>= 20' } }, effects: { newFlags: ['awakened_spirit_sense'] }, unlocks: ['expose_truth'] },
      { id: 'ally_tea_master', name: '结盟说书人', description: '说服茶馆说书人柳提供朝廷密报。', preconditions: { attributeChecks: { charm: '>= 5' } }, effects: { newFlags: ['allied_with_tea_master'] }, unlocks: ['expose_truth'] },
      { id: 'expose_truth', name: '揭露真相', description: '揭露朝廷腐败与龙脉异象的关联，寻找最后一只灵兽。', preconditions: { npcAffinityChecks: { court_official: '>= 30' } }, effects: { newFlags: ['exposed_corruption'] }, unlocks: [] },
    ],
  },
]
