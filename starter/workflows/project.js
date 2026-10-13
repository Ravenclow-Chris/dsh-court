// ═══════════════════════════════════════════════════════════════
// 小朝廷 · 办事（项目组交付，真的要动文件、出东西）
// ═══════════════════════════════════════════════════════════════
// 怎么用：把本文件全文粘进 `workflow` 工具的 script 参数，
//         args 传 { task, deliverable, ministries?, needReview? }
// 成本  ：拟案 1 + 审议 1 + 各部各 1 + 验收 1 ≈ 4–7 次调用
// 可视化：workflow 运行面板里是一条分阶段流水线
// 关键  ：**执行与验收必须分离** —— 干活的部不能自己说合格
//
// 阶段：拟案（左丞相）→ 审议（谏议，可否决）→ 派发执行（六部并行）→ 独立验收（刑部）→ 汇总

const task = args.task;
const deliverable = args.deliverable ?? '（未指定，按任务自行判断合理产出）';
const ministries = args.ministries ?? ['bingbu'];
const needReview = args.needReview ?? true;

if (!task) throw new Error('args.task 必填：要办什么事');

const OFFICIALS = {
  zuocheng: { label: '左丞相·诸葛亮', card: 'court/officials/01-左丞相-诸葛亮.md', provider: 'deepseek-account', model: 'deepseek-v4-pro' },
  youcheng: { label: '右丞相·房玄龄', card: 'court/officials/02-右丞相-房玄龄.md', provider: 'deepseek-account', model: 'deepseek-v4-pro' },
  jianyi:   { label: '谏议大夫·魏征', card: 'court/officials/03-谏议大夫-魏征.md', provider: 'glm',              model: 'glm-5.3' },
  hubu:     { label: '户部·萧何',     card: 'court/officials/04-户部-萧何.md',     provider: 'glm',              model: 'glm-5.3' },
};

const ROSTER = 'court/roster.json';

// ── 一、拟案 ───────────────────────────────────────────────
phase('一 · 拟案');

const plan = await agent(
  `先读 \`${OFFICIALS.zuocheng.card}\` 与 \`${ROSTER}\`，按左丞相的人格与职责拟案。\n\n` +
  `【任务】${task}\n【要交付】${deliverable}\n\n` +
  `输出：① 这事能不能办、卡在哪；② 分几步、每步的产出；③ 该派给哪几个部（用 roster.json 里的官职）；④ 每步的完成判据。\n` +
  `只拟案，**不要动手执行**。`,
  { provider: OFFICIALS.zuocheng.provider, model: OFFICIALS.zuocheng.model, label: OFFICIALS.zuocheng.label, phase: '拟案' },
);

// ── 二、审议（可否决）──────────────────────────────────────
let approved = true;
let reviewText = '（跳过审议）';

if (needReview) {
  phase('二 · 审议');
  reviewText = await agent(
    `先读 \`${OFFICIALS.jianyi.card}\`，按谏议大夫的职责挑这份方案的漏洞。\n\n【方案】\n${plan}\n\n` +
    `第一句就给结论：\`准\` 或 \`封驳\`。若封驳，逐条说明问题、后果、以及不管会怎样。`,
    { provider: OFFICIALS.jianyi.provider, model: OFFICIALS.jianyi.model, label: OFFICIALS.jianyi.label, phase: '审议' },
  );
  approved = !/^\s*封驳/.test(String(reviewText).trim());
}

if (!approved) {
  return {
    task, stage: '被门下封驳', plan, review: reviewText,
    note: '方案被打回，未进入执行阶段 —— 这意味着**没有产生任何文件改动**。请修正方案后重跑。',
  };
}

// ── 三、派发执行（各部并行，各用各的模型）──────────────────
phase('三 · 派发执行');

const work = await parallel(
  ministries.map((key) => () => {
    const o = OFFICIALS[key];
    if (!o) throw new Error('未知官职：' + key + '（先在 roster.json 里立这个官）');
    return agent(
      `先读 \`${o.card}\`，按你的官职职责执行分配给你的那部分。\n\n【任务】${task}\n【总体方案】\n${plan}\n【要交付】${deliverable}\n\n` +
      `要求：\n` +
      `1. **只做你职责范围内的事**，越界的部分在回报里说明"此事非本部所辖，建议移交某某"。\n` +
      `2. 真的要动手：写文件、跑命令、产出实物。**不要只写计划**。\n` +
      `3. 回报格式：做了什么 → 产出物路径 → 怎么验证 → 遗留问题。`,
      { provider: o.provider, model: o.model, label: o.label, phase: '执行' },
    );
  }),
);

// ── 四、独立验收（干活的人不能自己说合格）──────────────────
phase('四 · 独立验收');

const verification = await agent(
  `你是**独立验收方**（刑部的角色：独立测试、缺陷复现、安全与权限审计、回归验证）。\n\n` +
  `【任务】${task}\n【方案】\n${plan}\n【各部回报】\n${work.map((w, i) => `--- ${ministries[i]} ---\n${w}`).join('\n')}\n\n` +
  `要求：**不要相信回报里的自述**，去实际检查产出物（读文件、跑命令、复现）。\n` +
  `逐项判定：声称完成项 → 实际验证结果 → 通过 / 未通过 / 无法验证（并说明为什么）。\n` +
  `最后给结论：\`准予结案\` 或 \`打回\`，并列出必须修的项。`,
  { provider: 'deepseek-account', model: 'deepseek-v4-pro', label: '刑部·独立验收', phase: '验收' },
);

// ── 五、汇总 ───────────────────────────────────────────────
phase('五 · 汇总回奏');

return {
  task,
  deliverable,
  stage: '已交付（待陛下结案）',
  cost: `${2 + ministries.length + 1} 次模型调用`,
  plan,
  review: reviewText,
  work: ministries.map((k, i) => ({ ministry: k, report: work[i] })),
  verification,
  // 结案权在陛下：主会话把这份回奏呈上，由你决定准予结案 / 打回重做
};
