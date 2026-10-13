# dsh-court · 小朝廷

> 给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的**私人智囊团**插件：
> 把官职绑定到历史人物，按各自的智力与性格议自己那一摊。
>
> **名册挂墙上是零成本；点将才花钱。**

不是又一个多 agent 流水线。它是一个**名册**：

- 人格是**文件**（磁盘上的 markdown），不是常驻 agent —— 躺着不烧 token
- 一个人一位，按职责边界说话，**带着这个人的思维定势和盲点**
- 想听谁的就点谁；不点，一分钱不花

---

## 它长什么样

侧栏**顶部**的「小朝廷」导航项（和「插件 / 任务看板 / 技能中心」并排），点开占据中央栏整页：

- **浏览**：按衙门分组（三省 · 中枢 / 六部 · 执行 / 台谏 · 其他）的卡片网格
  - **印章式头像**：默认取姓名首字，按衙门配色；也可填 emoji 或图片 URL
  - **七维条**：每人七项横条，**最高的两维高亮**——那就是他的切入角；**鼠标悬停看该维的史证**
  - **风格轴**：机变（**高不优、低不劣**，只表示偏离成规的倾向）
  - 每张卡还有：官职 · 姓名 · 时代身份 · 模型 · **盲点**
  - 「点将」= 复制**自带官卡路径**的开场语，粘到任何会话（含新会话）都能用
  - 「单聊」= 开一个新会话 + 复制开场语（DSH 的会话不带人格，所以还得粘一下）
  - 「官卡」= 就地展开 markdown 原文
- **编辑**：改模型（下拉候选 + 手填）、**改七维数值与史证**、改人格官卡、改头像、加官、删官，一键保存回盘
- **筛选**：按官职 / 姓名 / 盲点 / 模型搜索
- **预设**：每位官员会**自动注册成一个 Agent Preset**，出现在「设置 → 自定义」组里，点卡片即选用；改完名册保存即自动重注册（无需重启）
- **回到对话**：右上角一键切回会话

![浏览视图](docs/screenshots/01-browse.png)
![编辑视图](docs/screenshots/02-edit.png)

> 截图摄于入口移到侧栏顶部**之前**（当时还是浮层）。卡片与编辑表单与现状一致，差别只在容器：现在是中央栏整页，不再是浮层。


---

## 安装

```bash
# 从 GitHub 装（推荐）
dsh plugin add github:Ravenclow-Chris/dsh-court

# 本地开发（link 安装；插件目录放在 <court>/plugin 下会被自动识别）
dsh plugin add link:/abs/path/to/dsh-court
```

装完**重启一次 app**。首次启动会随包附带的 `starter/`（四位示例官员：左丞相诸葛亮、右丞相房玄龄、谏议大夫魏征、户部萧何）播种到 `$DSH_HOME/court`。

---

## 成本模型（这是设计的第一原则）

| 动作 | 调用次数 |
|---|---|
| 名册躺着（30 个官也一样） | **0** |
| 加官 / 改名 / 改人格 / 换模型 | **0** |
| 「请诸葛丞相议一下」→ 本会话口述扮演 | **0** |
| 「让 kimi 扮萧何算账」→ 派给别的模型 | **1** |
| 多人廷议 | N（可并行） |

没有常驻 agent、没有状态机、没有必跑的流程。**不点将 = 不花钱。**

---

## 朝廷数据长什么样

```
$DSH_HOME/court/
├── roster.json          名册：官职 / 姓名 / 模型 / 七维取径 + 史证 / 盲点
├── models.json          面板里下拉的候选模型（可随意增删）
├── officials/
│   ├── 01-左丞相-诸葛亮.md
│   ├── 02-右丞相-房玄龄.md
│   └── ...
└── workflows/           可选：把名册接进 workflow 工具的两个模板
    ├── council.js       廷议：多人各出一份意见，互不可见
    └── project.js       项目组：拟案→审议→派发六部→独立验收→回奏
```

---

## 七维取径：这套分数是什么意思

**七维能力**（1–10，无 0）＋ **一条独立风格轴**：

| 维度 | 取意于 | 现代对应 |
|---|---|---|
| **谋略** | 三省 — 长远布局、多步预判 | 战略规划、路线选择 |
| **政治** | 吏部 — 人事、关系调节 | 干系人管理与组织政治 |
| **财计** | 户部 — 钱粮、资源调度 | 预算、成本效益 |
| **内政** | 工部 — 制度、政令、文书、落地 | 运营与交付 |
| **魅力** | 礼部 — 表达、说服、对外 | 影响力与说服 |
| **攻守** | 兵部 — 攻伐、对抗 | 竞争、谈判、危机处置 |
| **法度** | 刑部 — 律令、合规、纠错 | 风控、红队挑错、复盘定责 |
| *机变* | *风格轴，不是能力维* | *风险偏好。**高不优、低不劣*** |

**分数怎么真正影响输出（不是摆设）**：

1. **不设禁区** —— 任何问题都可以问任何人，没有「不是我的职责」这回事
2. **切入角 = 自己最高的两维**：同一个问题，诸葛亮先从方向切，房玄龄先从落地切，魏征先找风险，萧何先算账 —— **四个人都给完整判断，只是入口不同**
3. **置信度 = 相关维度分值**：低于 4 分要**主动声明**「此非我所长，所见未必周全」，**但仍然给出判断**（这才是「不是傻子」）
4. **分歧可解释**：结论不同是因为峰值不同，不是模型随机 —— 这才是多人合议值钱的地方

### ⚠ 评分口径（改分前先读）

> 分值表示 **① 遇到问题时他从这一面切入的比重**，以及 **② 史料中该方面表现的记载详略**。
> **不构成对历史人物能力高下的评价。** 低分只表示「这不是他的本职侧重」，不表示他不行。

**每一格都必须附一句史证。** 有史证的 3 分叫「史载其未预此事」；**无史证的 3 分才是贬低** —— 这条是分水岭。

例：

```
攻守 2 — 史载未尝将兵；楚汉相争时守关中、给馈饷
机变 2 — 行事极稳，自污求全、不打满
```

前者是**分工**，后者是**性格**，都不是贬低。

> 本表是编者理解，**非定评**。欢迎以史实修正。

---

一张**官卡**长这样（`officials/*.md`）：

```markdown
# 官职｜左丞相 · 诸葛亮（字孔明，蜀汉）

## 七维取径
| 谋略 | 政治 | 财计 | 内政 | 魅力 | 攻守 | 法度 | 机变（风格） |
|---|---|---|---|---|---|---|---|
| **10** | 9 | 8 | 9 | 8 | 7 | 8 | 5 |

**史证**
- **谋略 10** — 隆中对定三分天下之策；《出师表》陈北伐路线
- **攻守 7** — 陈寿：「治戎为长，奇谋为短」
- …（每格一句，缺了就补，别空着）

## 切入方式
先从「谋略 10」与「政治 9」两面切。**不设禁区**：问他财政也答，
只是会说「臣於算计不如萧何」，**但仍然给出判断**。

## 他会怎么想 ／ 盲点（陛下须知）
- **过于求稳**（机变 5）：倾向低估激进方案的上限收益

## 输出格式
一、局势判断　二、上/中/下三策　三、我的判断　四、需陛下定夺之处　五、**把握**
```

> 官卡里的「性格与口吻」已被**有意去掉**：要的是**判断取径**，不是模仿古人语气。
> 提示词里也明确写了「**不必模仿古人语气**，直接给判断和理由」。


### 为什么「盲点」是核心字段

不写盲点，几个模型被要求「给点建议」时会产出同一套正确的废话 —— **付了 N 份钱，收到 1 份意见**。
把每个人的思维定势写清楚，多人合议才有意义。

---

## 与「三省六部」类插件的区别

| | 三省六部类插件 | dsh-court |
|---|---|---|
| 本质 | 软件开发流水线（起草→封驳→六部执行） | 人格名册 + 按需点将 |
| 成本 | 走流程必然起 N 个子代理 | 不点将 = 0 |
| 用途 | 交付代码，要审批留痕 | 议事、出主意、多视角 |

两者互补。要「走流程交付」就用前者；要「听不同的人怎么说」就用这个。

---

## 朝廷目录怎么找

按顺序取**第一个含 `roster.json` 的**：

1. 环境变量 `DSH_COURT_DIR`
2. 插件配置 `courtDir`（`cordis.patch.yml` 的 `config` 段）
3. `$DSH_HOME/court` ← 常规安装
4. 插件包的上一级目录 ← `link:` 安装时插件位于 `<court>/plugin`

都没有时，把 `starter/` 播种到 `$DSH_HOME/court`。

---

## 安全

插件在宿主上开两个 HTTP 路由。写接口有三条硬约束：

1. **仅回环** —— `POST /api/court/save` 只接受本机来源。宿主上可能跑着远程访问插件，**绝不能让 LAN / 手机来源改名册文件**
2. **路径限定** —— 所有写入必须落在朝廷目录内（防 `../` 越界），且**先全量校验再落笔**：一条越界就整体拒绝，不写半个字
3. **先备份 + 原子写** —— 写前复制 `.bak`；写 `.tmp` 后 `rename` 覆盖，不留残渣、不会写出半截文件

读接口只读文件，不调用任何模型。

---

## 排障

插件启动时会往 **`$DSH_HOME/dsh-court-diag.log`** 追加几行诊断。面板报「名册读不出来」时，先看这个文件：

```text
--- module loaded from <插件路径>      模块加载成功
apply entered; keys=fiber             cordis 调用了 apply
  config(arg)=null                    插件配置（apply 的第二个参数）
  ctx.config=(不可读)                 正常：ctx.config 在守卫下读不了
  courtDir=...  seeded=false          选中的朝廷目录
  routes registered: /api/court/...   路由注册成功
apply completed (via ctx.effect)
```

对照判断：

| 日志停在哪 | 说明 |
|---|---|
| 连 `module loaded` 都没有 | 插件没被加载 → 查 profile 的 `dsh.profile.bundles` 是否含 `dsh-court` |
| 有 `module loaded`、无 `apply entered` | cordis 没调用 `apply` → 激活环节问题 |
| 有 `ERROR in apply: ...` | 直接看栈 |
| 有 `routes registered` 但接口仍 401 | 路由被别的中间件挡住 |
| `courtDir` 指向的目录里没有 `roster.json` | 目录选错了 → 用 `DSH_COURT_DIR` 或插件 `config.courtDir` 指定 |

---

## 开发

浏览器半边是**手写的纯 JS，没有构建步骤**。

Harness 的客户端插件格式不是 ESM，而是自定义模块加载器：

```js
window.__ModuleLoader__.load({
  id: 'dsh-court',
  factory: (require) => {
    const react = require('react')      // react / react-dom 由加载器提供
    // ...你的代码
    exports.apply = apply
    exports.inject = ['slots']
    return module.exports
  },
})
```

因此 `lib/client.js` 里用 `React.createElement` 代替 JSX、内联样式代替 CSS modules。

### 挂在哪两个 slot

```js
// 侧栏顶部导航项（和「插件 / 任务看板 / 技能中心」同一排）
ctx.slots.inject('sidebar.panellist', () =>
  ctx.slots.register(
    { name: 'sidebar.panellist', id: 'court', order: 15, label: '小朝廷' },
    CourtNav,
  ))

// 点图标后占据中央栏的整页
ctx.slots.inject('main', () =>
  ctx.slots.register({ name: 'main', key: 'court' }, CourtPage))
```

切换靠官方 `dsh-client-ui-layout` 的 **`ctx.layout.selectPanel(id)`**：

```js
ctx.layout.selectPanel('court')          // 打开小朝廷
ctx.layout.selectPanel('conversation')   // 回到会话
```

所以 `package.json` 的 `dsh.client.inject` 必须带上 `@deepseek-ai/dsh-client-ui-layout`，模块的 `inject` 数组要有 `'layout'`。

导航项的点击由本插件自己处理并 `stopPropagation()`，免得和外壳的切换逻辑互相抵消。

### ⚠ cordis 的 `ctx` 是守卫 Proxy —— 最容易踩的坑

本插件在这上面栽过一次，现象很迷惑：**客户端半边照常渲染，但宿主路由一条都没注册，接口全 401**。

原因：**读任何没写进 `inject` 的服务都会抛异常，而异常会中断整个 `apply`**。

```js
export const inject = ['webServer']

export function apply(ctx, config) {
  ctx.webServer.register(...)   // ✅ 已 inject
  ctx.effect(...)               // ✅ 核心方法

  ctx.config                    // ❌ 抛：读不了。配置是 apply 的**第二个参数**
  ctx.slots                     // ❌ 抛：没 inject slots
  typeof ctx.anythingElse       // ❌ 一样抛，`typeof` 也救不了
}
```

要读就先包起来：

```js
const safe = (fn, fb) => { try { return fn() } catch { return fb } }
const cfg = config || safe(() => ctx.config, undefined)
```

推论：宿主半边的 `apply` **整体包一层 try/catch**，否则任何一处守卫抛错都会静默地让所有路由消失。

改完 `lib/client.js` 需要**重启 app**（或另跑 `pnpm run dev:web` 让 HMR 接手）。宿主半边（`lib/index.js`）是普通 ESM。

---

## English

A **private council** plugin for DeepSeek Harness. Offices (官职) are bound to historical figures who deliberate within their own remit — with that person's thinking style, voice, and **blind spots**.

- Personas are **files on disk**, not resident agents: an idle roster costs nothing. You only pay when you consult someone.
- A top-level **小朝廷** entry in the sidebar nav opens a full-page browse/edit panel with **seal-style avatars** (first character of the name, coloured by department; emoji or image URL supported), per-official model binding, and one-click "点将" to copy that official's prompt.
- Write endpoint is **loopback-only**, path-fenced inside the court directory, backs up before writing, and writes atomically.

MIT licensed.

---

## License

MIT
