// ═══════════════════════════════════════════════════════════════
// 小朝廷 · 议事（只出主意，不落地任何东西）
// ═══════════════════════════════════════════════════════════════
// 怎么用：把本文件全文粘进 `workflow` 工具的 script 参数，
//         args 传 { topic: "议题", seats: ["zhugeliang", ...] }
// 成本  ：被点到的官**各 1 次调用**，并行；不点将 = 0
// 可视化：workflow 运行面板里，每位官员是一个带 label 的节点
// 关键  ：各官**互不可见**（防附和与错误传染），分歧交给你裁决
//
// 人格来源：court/officials/*.md —— 子代理自己去读卡，
//          所以改卡即改人格，这里零重复、单一真源。
//
// 设计要点（2026-10-14 修正）：
//   · **不设禁区**——删掉了旧的「只出你职责范围内的意见；越界就说此事该问某某」。
//     那句话把人做成了专职科员，而现实里每个人都是通才，只是侧重不同。
//   · 每人按自己的**七维取径**切入：最高的两维决定他从哪下手，
//     低分维度仍要回答，只是要注明把握不大。
//   · **不必模仿古人语气**——要的是判断，不是表演。

const topic = args.topic;
const seats = args.seats ?? ['zhugeliang', 'fangxuanling', 'weizheng'];

const OFFICIALS = {
  zhugeliang:   { label: '左丞相·诸葛亮', card: 'court/officials/01-左丞相-诸葛亮.md', provider: 'deepseek-account', model: 'deepseek-v4-pro' },
  fangxuanling: { label: '右丞相·房玄龄', card: 'court/officials/02-右丞相-房玄龄.md', provider: 'deepseek-account', model: 'deepseek-v4-pro' },
  weizheng:     { label: '谏议大夫·魏征', card: 'court/officials/03-谏议大夫-魏征.md', provider: 'glm',              model: 'glm-5.3' },
  xiaohe:       { label: '户部·萧何',     card: 'court/officials/04-户部-萧何.md',     provider: 'glm',              model: 'glm-5.3' },
};

if (!topic) throw new Error('args.topic 必填：要议什么');

phase('议事 · ' + topic);

const opinions = await parallel(
  seats.map((key) => () => {
    const o = OFFICIALS[key];
    if (!o) throw new Error('未知官职：' + key);
    return agent(
      `先读工作区里的 \`${o.card}\`，按那张卡的「七维取径」办事：\n` +
      `- 用你**最高的两维**切入问题（卡里写了是哪两维、也写了史证）\n` +
      `- 其他维度**也要回答**，没有「不是我的职责」这回事；低分维度注明把握不大\n` +
      `- **不必模仿古人语气**，直接给判断和理由\n\n` +
      `【议题】${topic}\n\n` +
      `要求：\n` +
      `1. **不设禁区**：任何问题都要给出你自己的判断。\n` +
      `2. 按卡上的「输出格式」组织，**末尾必须标注你对各部分把握的大小**。\n` +
      `3. 其他官员的意见你看不到，**不必附和、不要客套**——你的价值就是与他人的差异。\n` +
      `4. 这是**议事**，只出主意，**不要动任何文件、不要执行任何命令**。`,
      { provider: o.provider, model: o.model, label: o.label, phase: '独立进言' },
    );
  }),
);

log(`议事完成：${seats.length} 位进言`);

return {
  topic,
  mode: '议事（纯建议，未落地任何改动）',
  cost: `${seats.length} 次模型调用（并行）`,
  opinions: seats.map((key, i) => ({
    official: OFFICIALS[key].label,
    route: `${OFFICIALS[key].provider}/${OFFICIALS[key].model}`,
    ok: opinions[i] !== null,
    text: opinions[i],
  })),
};
