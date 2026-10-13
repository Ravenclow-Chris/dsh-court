/**
 * dsh-court · presets —— 把每位官员注册成一个 **Agent Preset**。
 *
 * 为什么单独一个插件行？
 *   它 `inject: ['agentPresets']`。若某个部署没有这个服务，cordis 会一直等它，
 *   那一行激活不了 —— **但面板那一行（dsh-court）不受影响**。
 *   这是官方 README 推崇的「每个能力各占一行」的写法。
 *
 * 效果：开新会话时，预设选择器里出现「左丞相 · 诸葛亮」等；
 *       选它，那个会话**本身就是这个人**，不用粘任何开场语。
 *
 * 同步：`fs.watch` 盯着 roster.json —— 在面板里改完保存，预设自动重注册。
 *       （注册表要求 ID 唯一，所以每次同步都是「先全撤、再全注册」。）
 */
import { watch, appendFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { resolveCourtDir } from './index.js'

/** Cordis 插件名。 */
export const name = 'dsh-court-presets'

/** 只依赖预设注册表；拿不到就这一行安静地不生效。 */
export const inject = ['agentPresets']

/** 预设 ID 前缀，避免与内置/第三方预设撞名。 */
const ID_PREFIX = 'court-'

/** 排序基准：排在标准 preset 之后。 */
const ORDER_BASE = 30

/**
 * ⚠ 必须有兜底：宿主进程里 **`DSH_HOME` 并没有设**。
 * 只写 `process.env.DSH_HOME` 会把日志扔进进程的工作目录
 * （实测落到了 `~/.dsh/profiles/desktop/`，害我一度以为这行没加载）。
 * 与 index.js 保持一致。
 */
const DSH_HOME = process.env.DSH_HOME || join(homedir(), '.dsh')

function diag(line) {
  try {
    appendFileSync(join(DSH_HOME, 'dsh-court-diag.log'),
      new Date().toISOString() + '  ' + line + '\n', 'utf8')
  } catch { /* 日志失败不影响功能 */ }
}

/**
 * 从官卡 markdown 里取一节。
 * @param card - 官卡原文。
 * @param title - 小节标题（如「输出格式」）。
 * @returns 该节正文；取不到返回空串。
 */
function sectionOf(card, title) {
  if (typeof card !== 'string') return ''
  const m = card.match(new RegExp('##\\s*' + title + '[^\\n]*\\n+([\\s\\S]*?)(?:\\n##\\s|$)'))
  return m && m[1] ? m[1].trim() : ''
}

/**
 * 取最高的两维。
 * @param profile - 七维分值表。
 * @param dims - 维度名列表。
 * @returns 最高的两个维度名。
 */
function topDims(profile, dims) {
  return dims.slice().sort((a, b) => (profile[b] || 0) - (profile[a] || 0)).slice(0, 2)
}

/**
 * 生成该官员的人设 prefix（交给 @deepseek-ai/dsh-persona）。
 * @param official - 名册里的官员记录。
 * @param dimensions - 维度名列表。
 * @param card - 官卡原文。
 * @returns 人设文本。
 */
function personaPrefix(official, dimensions, card) {
  const profile = official.profile || {}
  const style = official.styleAxes || {}
  const dimLine = dimensions.map((d) => d + ' ' + (profile[d] ?? '—')).join(' ／ ')
  const tops = topDims(profile, dimensions)
  const blind = (official.blind_spots || []).map((s) => '- ' + s).join('\n')
  const format = sectionOf(card, '输出格式')

  const parts = [
    '你是「小朝廷」的 ' + (official.office || '') + ' · ' + (official.name || '')
      + (official.style ? '（' + official.style + '）' : '') + '。',
    '',
    '## 你的判断取径',
    '七维能力：' + dimLine,
    '风格轴「机变」' + (style['机变'] ?? '—') + '（高不优、低不劣，只表示偏离成规的倾向）',
    '',
    '**切入方式**：任何问题先看你最高的两维 **' + tops.join(' / ') + '** 下手。',
    '**不设禁区**：其余方面同样要给判断，没有「不是我的职责」这回事；',
    '低分的维度照答，但要注明把握不大。',
  ]
  if (blind) parts.push('', '## 你的盲点（自己知道，必要时主动说明）', blind)
  if (format) parts.push('', '## 输出格式', format)
  parts.push(
    '',
    '## 参考',
    '完整官卡（需要时再读，不必每次都读）：`' + (official.card || '') + '`',
    '**不必模仿古人语气**，直接给判断和理由。',
  )
  return parts.join('\n')
}

/**
 * 组装一个 PresetDefinition。
 * @param official - 官员记录。
 * @param index - 名册序号（决定 order）。
 * @param dimensions - 维度名列表。
 * @param card - 官卡原文。
 * @returns 预设定义。
 */
function definitionOf(official, index, dimensions, card) {
  const profile = official.profile || {}
  const tops = topDims(profile, dimensions)
  const blind = (official.blind_spots || [])[0] || ''
  return {
    id: ID_PREFIX + official.id,
    name: (official.office || '') + ' · ' + (official.name || ''),
    description: '七维取径：' + tops.map((d) => d + ' ' + (profile[d] ?? '—')).join('、')
      + (blind ? '　｜　盲点：' + blind : ''),
    order: ORDER_BASE + index,
    plugins: [
      {
        id: 'persona',
        name: '@deepseek-ai/dsh-persona',
        config: { prefix: personaPrefix(official, dimensions, card) },
      },
    ],
  }
}

/**
 * 注册全部官员预设，并监听 roster.json 变化自动重注册。
 * @param ctx - 携带 agentPresets 的宿主插件上下文。
 * @param config - 插件配置（apply 第二个参数）。
 */
export function apply(ctx, config) {
  let disposers = []

  let courtDir
  try {
    courtDir = resolveCourtDir(config || undefined).dir
  } catch (error) {
    diag('presets: 解析朝廷目录失败 ' + error.message)
    return
  }
  diag('presets: courtDir=' + courtDir)

  /**
   * 先全撤、再全注册。注册表拒绝重复 ID，所以必须先撤。
   * @returns 注册成功的预设数。
   */
  async function sync() {
    for (const dispose of disposers) {
      try { await dispose() } catch { /* 撤不掉不该阻塞重注册 */ }
    }
    disposers = []

    const roster = JSON.parse(await readFile(join(courtDir, 'roster.json'), 'utf8'))
    const dimensions = Array.isArray(roster.dimensions) && roster.dimensions.length
      ? roster.dimensions
      : ['谋略', '政治', '财计', '内政', '魅力', '攻守', '法度']
    const officials = roster.officials ?? []

    let ok = 0
    for (let i = 0; i < officials.length; i++) {
      const official = officials[i]
      let card = null
      try {
        card = official.card ? await readFile(join(courtDir, official.card), 'utf8') : null
      } catch { card = null }

      const definition = definitionOf(official, i, dimensions, card)
      try {
        disposers.push(await ctx.agentPresets.register(definition))
        ok++
        diag('presets: registered ' + definition.id + '（' + definition.name + '）')
      } catch (error) {
        diag('presets: FAILED ' + definition.id + ' — '
          + (error && error.message ? error.message : String(error)))
      }
    }
    return ok
  }

  /**
   * 把注册表当前的内容打出来 —— 判断「注册成功」与「可用」是两件事。
   * 注册表在挂载时做激活审计（导入失败 / 缺失服务 / 泄漏都会拒绝挂载），
   * 失败的声明仍会留在列表里，所以要连状态一起看。
   */
  async function dumpRegistry(why) {
    try {
      const list = await ctx.agentPresets.list()
      const mine = list.filter((p) => String(p && p.id).startsWith(ID_PREFIX))
      diag('presets: [' + why + '] 注册表共 ' + list.length + ' 个，其中本插件 ' + mine.length + ' 个')
      for (const p of list) {
        const keys = p && typeof p === 'object' ? Object.keys(p).join('/') : typeof p
        diag('presets:   · ' + (p && p.id) + '  name=' + (p && p.name)
          + '  order=' + (p && p.order) + '  字段[' + keys + ']')
      }
      if (list[0]) {
        diag('presets: 首个条目原样 → ' + JSON.stringify(list[0]).slice(0, 900))
      }
    } catch (error) {
      diag('presets: [' + why + '] list() 失败 — '
        + (error && error.message ? error.message : String(error)))
    }
  }

  ctx.effect(() => {
    sync()
      .then(async (n) => {
        diag('presets: 同步完成，共 ' + n + ' 个')
        await dumpRegistry('启动后')
      })
      .catch((e) => diag('presets: 同步失败 ' + (e && e.message ? e.message : String(e))))

    // roster.json 一变就重注册 —— 面板里改完保存即生效，不用重启
    let timer = null
    let watcher = null
    try {
      watcher = watch(courtDir, (event, filename) => {
        if (filename && filename !== 'roster.json') return
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
          sync().then(
            (n) => diag('presets: 名册变化，重注册 ' + n + ' 个'),
            (e) => diag('presets: 重注册失败 ' + (e && e.message ? e.message : String(e))),
          )
        }, 400)
      })
    } catch (error) {
      diag('presets: watch 失败 ' + error.message)
    }

    return async () => {
      if (timer) clearTimeout(timer)
      if (watcher) { try { watcher.close() } catch { /* 已关 */ } }
      for (const dispose of disposers) {
        try { await dispose() } catch { /* 忽略 */ }
      }
      disposers = []
    }
  }, 'dsh-court: agent presets')
}
