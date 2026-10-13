/**
 * dsh-court —— 浏览器半边（手写，无构建步骤）。
 *
 * 挂两个位置：
 *   1. `sidebar.panellist` —— 侧栏顶部的导航图标（和「插件 / 任务看板 / 技能中心」并排）
 *   2. `main` key `court`  —— 点图标后占据中央栏的整页名册
 *
 * 切换靠 `ctx.layout.selectPanel('court')` / `selectPanel('conversation')`
 * （官方 dsh-client-ui-layout 提供；task-board / skill-explorer 同法）。
 *
 * 加载器契约（照 @linxin666/dsh-update 的产物格式）：
 *   window.__ModuleLoader__.load({ id, factory: (require) => module.exports })
 * react / react-dom 由此处的 require 提供，不打包进来。
 */
window.__ModuleLoader__.load({
  id: 'dsh-court',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    var react = require('react')
    var h = react.createElement
    var useState = react.useState
    var useEffect = react.useEffect

    /** 由 apply() 注入的客户端上下文（导航要用 ctx.layout）。 */
    var CTX = null

    /** 中央面板 key。 */
    var PANEL_KEY = 'court'
    /** 会话面板 key（已知被占用，用来返回）。 */
    var CONVERSATION_KEY = 'conversation'

    // ── 设计令牌 ───────────────────────────────────────────
    var T = {
      bg: '#16161a', surface: '#1e1e24', surfaceHi: '#26262e', surfaceTop: '#1b1b21',
      border: '#32323c', borderHi: '#43434f',
      text: '#ececf1', dim: '#9a9aa6', faint: '#6b6b77',
      input: '#131317', gold: '#c9a227', goldInk: '#e0c063',
      ok: '#7fb37f', warn: '#d08b62',
      shadow: '0 24px 80px rgba(0,0,0,.7)',
    }

    // 衙门 → 印章配色
    var GROUPS = [
      { key: 'central', title: '三省 · 中枢', seal: '#c9a227', hint: '定策 · 统辖六部', match: ['左丞相', '右丞相', '丞相', '中书', '门下', '尚书'] },
      { key: 'ministry', title: '六部 · 执行', seal: '#4f9d9d', hint: '分曹理事', match: ['吏部', '户部', '礼部', '兵部', '刑部', '工部'] },
      { key: 'censor', title: '台谏 · 其他', seal: '#a8695f', hint: '拾遗补阙', match: [] },
    ]

    function groupIndex(office) {
      var o = String(office || '')
      for (var i = 0; i < GROUPS.length - 1; i++) {
        for (var j = 0; j < GROUPS[i].match.length; j++) {
          if (o.indexOf(GROUPS[i].match[j]) >= 0) return i
        }
      }
      return GROUPS.length - 1
    }

    function rgba(hex, a) {
      var n = parseInt(hex.slice(1), 16)
      return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'
    }

    function clone(x) { return JSON.parse(JSON.stringify(x)) }

    // ── 七维取径 + 独立风格轴 ──────────────────────────────
    var DIMS = ['谋略', '政治', '财计', '内政', '魅力', '攻守', '法度']
    var STYLE_AXIS = '机变'

    /** 每格史证（悬停可见）——「不贬低历史人物」全靠这个可追溯。 */
    function dimEvidence(o, d) {
      var e = (o && o.evidence) || {}
      return e[d] || ''
    }

    function styleEvidence(o) {
      var e = (o && o.styleEvidence) || {}
      return e[STYLE_AXIS] || ''
    }

    /** 该官最高的 n 维——决定他从哪切入。 */
    function topDims(o, n) {
      var p = (o && o.profile) || {}
      return DIMS.slice().sort(function (a, b) { return (p[b] || 0) - (p[a] || 0) }).slice(0, n || 2)
    }

    /** 七维条：最高的两维高亮，其余压暗；悬停看史证。 */
    function ProfileBars(props) {
      var o = props.official
      var tone = props.tone || T.gold
      var profile = o.profile || {}
      var tops = topDims(o, 2)
      return h('div', {
        style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 14px', fontSize: '11px' },
      }, DIMS.map(function (d) {
        var v = profile[d] || 0
        var isTop = tops.indexOf(d) >= 0
        var ev = dimEvidence(o, d)
        return h('div', {
          key: d,
          title: ev ? d + ' ' + v + ' — ' + ev : d + ' ' + v,
          style: { display: 'flex', alignItems: 'center', gap: '6px' },
        },
          h('span', {
            style: { width: '26px', flex: '0 0 auto', color: isTop ? tone : T.faint, fontWeight: isTop ? 600 : 400 },
          }, d),
          h('div', {
            style: { flex: 1, height: '4px', background: T.input, borderRadius: '2px', overflow: 'hidden' },
          }, h('div', { style: { width: (v * 10) + '%', height: '100%', background: isTop ? tone : rgba(tone, 0.32) } })),
          h('span', {
            style: { width: '15px', flex: '0 0 auto', textAlign: 'right', color: isTop ? T.text : T.dim },
          }, String(v)),
        )
      }))
    }

    /** 风格轴一行：机变。高不优、低不劣。 */
    function StyleAxis(props) {
      var o = props.official
      var sa = (o && o.styleAxes) || {}
      var v = sa[STYLE_AXIS]
      if (v == null) return null
      var hint = v >= 7 ? '敢变通' : v >= 4 ? '中' : '守成'
      return h('div', {
        title: styleEvidence(o) || (STYLE_AXIS + ' ' + v),
        style: { fontSize: '11px', color: T.faint, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' },
      },
        h('span', { style: { color: T.dim } }, STYLE_AXIS + '（风格）'),
        h('span', { style: { color: T.text } }, String(v)),
        h('span', null, '· ' + hint),
        h('span', { style: { color: T.faint } }, '高不优、低不劣'),
      )
    }

    // ── 中央面板选中态（给导航项做高亮）────────────────────
    var selected = CONVERSATION_KEY
    var subs = []
    function setSelected(key) {
      selected = key
      for (var i = 0; i < subs.length; i++) subs[i](key)
    }
    function useSelected() {
      var pair = useState(selected)
      useEffect(function () {
        var fn = function (k) { pair[1](k) }
        subs.push(fn)
        return function () { subs = subs.filter(function (x) { return x !== fn }) }
      }, [])
      return pair[0]
    }

    // ── 头像：默认姓名首字的印章式徽记 ─────────────────────
    function Avatar(props) {
      var o = props.official
      var size = props.size || 44
      var tone = GROUPS[groupIndex(o.office)].seal
      var raw = o.avatar || (o.name ? String(o.name).slice(0, 1) : '？')
      var isImg = /^(https?:|data:image)/.test(raw)
      var base = {
        width: size + 'px', height: size + 'px', flex: '0 0 auto', borderRadius: '11px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: rgba(tone, 0.14), border: '1px solid ' + rgba(tone, 0.55),
        color: tone, overflow: 'hidden', lineHeight: 1, fontWeight: 600,
        fontSize: Math.round(size * (String(raw).length > 1 && !isImg ? 0.32 : 0.46)) + 'px',
      }
      if (isImg) {
        return h('div', { style: base },
          h('img', { src: raw, alt: o.name || '', style: { width: '100%', height: '100%', objectFit: 'cover' } }))
      }
      return h('div', { style: base, title: o.name || '' }, raw)
    }

    /** 小印章图标（导航与页头共用）。 */
    function Seal(props) {
      var size = props.size || 24
      var tone = props.tone || T.gold
      return h('div', {
        style: {
          width: size + 'px', height: size + 'px', flex: '0 0 auto',
          borderRadius: Math.round(size * 0.28) + 'px',
          background: rgba(tone, 0.16), border: '1px solid ' + rgba(tone, 0.55),
          color: rgba(tone, 1), display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: Math.round(size * 0.5) + 'px', fontWeight: 600, lineHeight: 1,
        },
      }, '朝')
    }

    function chipStyle(tone, faint) {
      return {
        display: 'inline-block', padding: '2px 7px', margin: '0 4px 4px 0',
        borderRadius: '4px', fontSize: '11px', lineHeight: '16px', whiteSpace: 'nowrap',
        background: faint ? 'transparent' : rgba(tone || T.borderHi, 0.16),
        border: '1px solid ' + (faint ? T.border : rgba(tone || T.borderHi, 0.45)),
        color: faint ? T.dim : (tone || T.text),
      }
    }

    function chip(text, tone, faint) {
      return h('span', { key: text, style: chipStyle(tone, faint) }, text)
    }

    var BTN = {
      primary: { background: T.gold, border: '1px solid ' + T.gold, color: '#1a1a1c', fontWeight: 600 },
      gold: { background: rgba(T.gold, 0.16), border: '1px solid ' + rgba(T.gold, 0.6), color: T.goldInk, fontWeight: 600 },
      ghost: { background: 'transparent', border: '1px solid ' + T.border, color: T.text },
      soft: { background: T.surfaceHi, border: '1px solid ' + T.borderHi, color: T.text },
      danger: { background: 'transparent', border: '1px solid ' + rgba(T.warn, 0.6), color: T.warn },
    }

    function btn(kind, extra) {
      return Object.assign({
        padding: '6px 12px', fontSize: '12px', borderRadius: '7px', cursor: 'pointer',
        fontFamily: 'inherit', lineHeight: '16px', whiteSpace: 'nowrap',
      }, BTN[kind] || BTN.ghost, extra || {})
    }

    function pickPrompt(card, official) {
      if (official && official.prompt) return official.prompt
      if (typeof card === 'string') {
        var m = card.match(/##\s*启动提示词[^\n]*\n+([\s\S]*?)(?:\n##\s|\s*$)/)
        if (m && m[1]) return m[1].replace(/^>\s?/gm, '').trim()
      }
      return '请' + ((official && official.office) || '') + ((official && official.name) || '') + '议一下：'
    }

    function copyText(text, done) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { done(true) }, function () { done(false) })
          return
        }
      } catch (e) { /* 降级到 execCommand */ }
      try {
        var ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        var ok = document.execCommand('copy')
        document.body.removeChild(ta)
        done(ok)
      } catch (e) { done(false) }
    }

    // ── 表单控件 ───────────────────────────────────────────
    function inputStyle(mono) {
      return {
        width: '100%', boxSizing: 'border-box', padding: '6px 9px', borderRadius: '7px',
        background: T.input, color: T.text, border: '1px solid ' + T.border,
        fontSize: '12px', fontFamily: mono ? 'ui-monospace, Consolas, monospace' : 'inherit',
        outline: 'none',
      }
    }

    function labeled(label, hint, control) {
      return h('div', { style: { marginBottom: '10px' } },
        h('div', { style: { fontSize: '11px', color: T.dim, marginBottom: '4px' } },
          label, hint ? h('span', { style: { color: T.faint } }, '  ' + hint) : null),
        control,
      )
    }

    function textField(label, value, onChange, hint, mono) {
      return labeled(label, hint, h('input', {
        type: 'text', value: value == null ? '' : String(value),
        onChange: function (e) { onChange(e.target.value) }, style: inputStyle(mono),
      }))
    }

    function textArea(label, value, onChange, rows, hint) {
      return labeled(label, hint, h('textarea', {
        value: value == null ? '' : String(value), rows: rows || 4,
        onChange: function (e) { onChange(e.target.value) },
        style: Object.assign(inputStyle(true), { lineHeight: 1.6, resize: 'vertical' }),
      }))
    }

    /**
     * 自带官卡路径的开场语 —— 在任何会话（含新会话、别的 workspace）里都能直接用。
     * 「点将」与「单聊」复制的都是它。
     */
    function openerOf(o) {
      var tops = topDims(o, 2)
      return '按「' + (o.office || '') + '·' + (o.name || '') + '」的判断取径回答下面的问题。\n'
        + '先读 `' + (o.card || '') + '`（七维取径、切入方式、盲点、输出格式都在卡里），'
        + '用你最高的两维' + (tops.length ? '（' + tops.join(' / ') + '）' : '') + '切入，'
        + '末尾标注你对各部分把握的大小。\n'
        + '不必模仿古人语气，直接给判断和理由。\n\n'
        + '议题：'
    }

    // ── 浏览卡 ─────────────────────────────────────────────
    function ViewerCard(props) {
      var o = props.official
      var card = props.card
      var onCopy = props.onCopy
      var onSolo = props.onSolo
      var showState = useState(false)
      var showCard = showState[0]
      var setShowCard = showState[1]
      var tone = GROUPS[groupIndex(o.office)].seal
      var domains = o.domain || []
      var shown = domains.slice(0, 5)
      var more = domains.length - shown.length

      return h('div', {
        style: {
          background: T.surface, border: '1px solid ' + T.border, borderRadius: '12px',
          padding: '15px', display: 'flex', flexDirection: 'column', gap: '11px',
        },
      },
        h('div', { style: { display: 'flex', gap: '12px', alignItems: 'flex-start' } },
          h(Avatar, { official: o, size: 46 }),
          h('div', { style: { minWidth: 0, flex: 1 } },
            h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '7px', flexWrap: 'wrap' } },
              h('span', { style: { fontSize: '11px', color: tone, letterSpacing: '1px' } }, o.office || '未设官职'),
              h('span', { style: { fontSize: '16px', fontWeight: 600 } }, o.name || '未设姓名'),
            ),
            o.style ? h('div', { style: { fontSize: '11px', color: T.faint, marginTop: '3px' } }, o.style) : null,
            h('div', { style: { marginTop: '7px' } }, chip(o.model || '未指定模型', o.model ? tone : T.warn, !o.model)),
          ),
        ),
        h('div', null,
          h(ProfileBars, { official: o, tone: tone }),
          h('div', { style: { marginTop: '8px' } }, h(StyleAxis, { official: o })),
        ),
        (o.blind_spots && o.blind_spots.length)
          ? h('div', {
              style: {
                fontSize: '11px', lineHeight: 1.6, color: '#d9a77c',
                background: rgba(T.warn, 0.08), border: '1px solid ' + rgba(T.warn, 0.28),
                borderLeft: '3px solid ' + rgba(T.warn, 0.7),
                borderRadius: '6px', padding: '7px 10px',
              },
            }, h('span', { style: { fontWeight: 600 } }, '盲点 '), o.blind_spots.join('；'))
          : null,
        h('div', { style: { display: 'flex', gap: '6px', marginTop: 'auto', paddingTop: '2px' } },
          h('button', {
            type: 'button', style: btn('gold', { flex: 1 }),
            title: '复制开场语，粘进当前会话即可',
            onClick: function () { onCopy(openerOf(o)) },
          }, '点将'),
          h('button', {
            type: 'button', style: btn('soft'),
            title: '开一个新会话，并以他开局',
            onClick: function () { onSolo(o) },
          }, '单聊'),
          h('button', { type: 'button', style: btn('ghost'), onClick: function () { setShowCard(!showCard) } },
            showCard ? '收起' : '官卡'),
        ),
        showCard ? (typeof card === 'string'
          ? h('pre', {
              style: {
                margin: 0, padding: '10px', background: T.input, border: '1px solid ' + T.border,
                borderRadius: '8px', fontSize: '11px', lineHeight: 1.65, color: T.dim,
                whiteSpace: 'pre-wrap', maxHeight: '260px', overflow: 'auto',
              },
            }, card)
          : h('div', { style: { fontSize: '11px', color: T.warn } }, '官卡文件缺失')) : null,
      )
    }

    // ── 编辑卡 ─────────────────────────────────────────────
    function EditorCard(props) {
      var o = props.official
      var card = props.card
      var models = props.models
      var onPatch = props.onPatch
      var onCard = props.onCard
      var onDelete = props.onDelete
      var openState = useState(true)
      var open = openState[0]
      var setOpen = openState[1]

      var modelChips = (models || []).map(function (m, i) {
        return h('button', {
          key: i, type: 'button', title: m.note || '',
          onClick: function () { onPatch({ model: m.provider + '/' + m.model }) },
          style: {
            padding: '3px 8px', marginRight: '5px', marginBottom: '5px', cursor: 'pointer',
            borderRadius: '4px', fontSize: '11px', lineHeight: '16px', fontFamily: 'inherit',
            background: T.surfaceHi, border: '1px solid ' + T.borderHi, color: T.text,
          },
        }, m.model)
      })

      return h('div', {
        style: { background: T.surface, border: '1px solid ' + T.border, borderRadius: '12px', padding: '15px' },
      },
        h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center' } },
          h(Avatar, { official: o, size: 42 }),
          h('div', { style: { flex: 1, minWidth: 0 } },
            h('div', { style: { fontSize: '14px', fontWeight: 600 } },
              (o.office || '未设官职') + ' · ' + (o.name || '未设姓名')),
            h('div', { style: { fontSize: '11px', color: T.faint, marginTop: '2px', wordBreak: 'break-all' } },
              (o.model || '未指定模型') + '　' + (o.card || '')),
          ),
          h('div', { style: { display: 'flex', gap: '6px' } },
            h('button', { type: 'button', style: btn('ghost'), onClick: function () { setOpen(!open) } }, open ? '收起' : '展开'),
            h('button', { type: 'button', style: btn('danger'), onClick: onDelete }, '删官'),
          ),
        ),
        !open ? null : h('div', { style: { marginTop: '15px', borderTop: '1px solid ' + T.border, paddingTop: '15px' } },
          h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' } },
            textField('官职', o.office, function (v) { onPatch({ office: v }) }),
            textField('姓名', o.name, function (v) { onPatch({ name: v }) }),
          ),
          textField('时代身份（卡片副标题）', o.style, function (v) { onPatch({ style: v }) }, '如「字孔明，蜀汉丞相」'),
          textField('头像', o.avatar || '', function (v) { onPatch({ avatar: v }) }, '留空 = 姓名首字；可填 emoji 或图片 URL'),
          textField('模型 provider/model', o.model, function (v) { onPatch({ model: v }) }, '', true),
          h('div', { style: { margin: '-4px 0 10px' } }, modelChips),
          h('div', { style: { fontSize: '11px', color: T.dim, marginBottom: '4px' } },
            '七维取径（1–10，无 0）　最高的两维 = 他的切入角'),
          h('div', {
            style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '12px' },
          },
            DIMS.map(function (d) {
              var pv = (o.profile || {})[d]
              return h('label', { key: d, style: { fontSize: '11px' } },
                h('div', { style: { color: T.faint, marginBottom: '2px' } }, d),
                h('input', {
                  type: 'number', min: 1, max: 10, value: pv == null ? '' : pv,
                  onChange: function (e) {
                    var v = parseInt(e.target.value, 10)
                    var next = Object.assign({}, o.profile || {})
                    if (isNaN(v)) delete next[d]
                    else next[d] = Math.max(1, Math.min(10, v))
                    onPatch({ profile: next })
                  },
                  style: Object.assign(inputStyle(true), { padding: '4px 6px' }),
                }),
              )
            }),
            h('label', { key: '__style', style: { fontSize: '11px' } },
              h('div', { style: { color: T.gold || T.text, marginBottom: '2px' } }, STYLE_AXIS + '（风格）'),
              h('input', {
                type: 'number', min: 1, max: 10,
                value: (o.styleAxes || {})[STYLE_AXIS] == null ? '' : o.styleAxes[STYLE_AXIS],
                onChange: function (e) {
                  var v = parseInt(e.target.value, 10)
                  var next = Object.assign({}, o.styleAxes || {})
                  if (isNaN(v)) delete next[STYLE_AXIS]
                  else next[STYLE_AXIS] = Math.max(1, Math.min(10, v))
                  onPatch({ styleAxes: next })
                },
                style: Object.assign(inputStyle(true), { padding: '4px 6px' }),
              }),
            ),
          ),
          h('div', { style: { fontSize: '11px', color: T.dim, marginBottom: '4px' } },
            '史证（每格一句，面板悬停可见 —— 有史证才不算贬低）'),
          DIMS.map(function (d) {
            return h('div', { key: 'ev-' + d },
              textField(d, dimEvidence(o, d), function (v) {
                var next = Object.assign({}, o.evidence || {})
                next[d] = v
                onPatch({ evidence: next })
              }),
            )
          }),
          textField(STYLE_AXIS + ' 的史证', styleEvidence(o), function (v) {
            var next = Object.assign({}, o.styleEvidence || {})
            next[STYLE_AXIS] = v
            onPatch({ styleEvidence: next })
          }, '风格轴：高不优、低不劣'),
          textArea('盲点（每行一条）', (o.blind_spots || []).join('\n'), function (v) {
            onPatch({ blind_spots: v.split('\n').map(function (s) { return s.trim() }).filter(Boolean) })
          }, 3, '写清楚这个人的思维定势，多人合议才有意义'),
          textArea('点将语', o.prompt || '', function (v) { onPatch({ prompt: v }) }, 3, '「点将」复制的那句；留空则自动从官卡取「启动提示词」'),
          textArea('官卡原文（markdown）', card == null ? '' : card, onCard, 18, '人格 / 职责 / 盲点 / 输出格式都在这里'),
        ),
      )
    }

    // ── 侧栏导航项 ─────────────────────────────────────────
    function CourtNav(props) {
      var active = useSelected() === PANEL_KEY
      var hoverState = useState(false)
      var hover = hoverState[0]
      var setHover = hoverState[1]
      var wide = !props || props.wide !== false

      return h('div', {
        role: 'button',
        tabIndex: 0,
        title: '小朝廷 · 私人智囊团',
        'data-dsh-plugin': 'dsh-court',
        'data-dsh-part': 'nav',
        onClick: function (e) {
          // 自己接管点击：只选面板，不冒泡给外壳（避免与外壳的切换逻辑互相抵消）
          if (e && e.stopPropagation) e.stopPropagation()
          if (CTX && CTX.layout) CTX.layout.selectPanel(PANEL_KEY)
        },
        onKeyDown: function (e) {
          if (e && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            if (CTX && CTX.layout) CTX.layout.selectPanel(PANEL_KEY)
          }
        },
        onMouseEnter: function () { setHover(true) },
        onMouseLeave: function () { setHover(false) },
        style: {
          display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer',
          padding: wide ? '7px 10px' : '7px',
          justifyContent: wide ? 'flex-start' : 'center',
          borderRadius: '8px',
          background: active ? rgba(T.gold, 0.14) : (hover ? rgba('#ffffff', 0.05) : 'transparent'),
          border: '1px solid ' + (active ? rgba(T.gold, 0.4) : 'transparent'),
          color: active ? T.goldInk : T.text,
          fontSize: '13px', userSelect: 'none',
        },
      },
        // ⚠ 标签由外壳按注册时的 `label` 字段渲染 —— 这里**只给图标**。
        //   自己再画一个会变成「小朝廷 小朝廷」（已踩过）。
        h(Seal, { size: wide ? 22 : 24, tone: active ? T.gold : T.borderHi }),
      )
    }

    // ── 中央页面 ───────────────────────────────────────────
    function CourtPage() {
      var dataState = useState(null)
      var data = dataState[0]
      var setData = dataState[1]
      var errState = useState(null)
      var err = errState[0]
      var setErr = errState[1]
      var tabState = useState('browse')
      var tab = tabState[0]
      var setTab = tabState[1]
      var draftState = useState(null)
      var draft = draftState[0]
      var setDraft = draftState[1]
      var msgState = useState('')
      var msg = msgState[0]
      var setMsg = msgState[1]
      var busyState = useState(false)
      var busy = busyState[0]
      var setBusy = busyState[1]
      var filterState = useState('')
      var filter = filterState[0]
      var setFilter = filterState[1]
      var toastState = useState('')
      var toast = toastState[0]
      var setToast = toastState[1]

      // 挂载即取数据；卸载时把选中态交回会话面板
      useEffect(function () {
        setSelected(PANEL_KEY)
        return function () {
          if (selected === PANEL_KEY) setSelected(CONVERSATION_KEY)
        }
      }, [])

      useEffect(function () {
        if (data || err) return
        fetch('/api/court/roster')
          .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() })
          .then(function (j) { if (j && j.ok) setData(j); else setErr((j && j.error) || '名册读取失败') })
          .catch(function (e) { setErr(String(e && e.message ? e.message : e)) })
      }, [data, err])

      useEffect(function () {
        if (!toast) return
        var t = setTimeout(function () { setToast('') }, 1800)
        return function () { clearTimeout(t) }
      }, [toast])

      function reload() { setData(null); setErr(null) }
      function flash(text) { setToast(text) }
      function onCopy(text) {
        copyText(text, function (ok) { flash(ok ? '已复制，粘到输入框即可' : '复制失败，请手动选中') })
      }

      /**
       * 单聊：开一个新会话 + 复制自带官卡路径的开场语。
       * 新会话里 agent 不在本上下文，所以开场语必须自带卡路径（openerOf 就是干这个的）。
       */
      function soloChat(o) {
        copyText(openerOf(o), function (ok) {
          flash(ok ? '已复制开场语 —— 粘上发送即开始' : '复制失败：请改用「点将」手动复制')
        })
        try {
          if (CTX && CTX.uiWorkspace && typeof CTX.uiWorkspace.startSession === 'function') {
            CTX.uiWorkspace.startSession()
          }
        } catch (e) { /* 开不了会话也要把面板切过去 */ }
        try {
          if (CTX && CTX.layout) CTX.layout.selectPanel(CONVERSATION_KEY)
        } catch (e) { /* 切不动就算了，开场语已经复制好了 */ }
      }

      function startEdit() {
        if (!data) return
        setDraft({
          roster: {
            version: 1, court: data.court, updated: data.updated, principle: data.principle,
            cost_model: data.costModel, officials: clone(data.officials), vacant_offices: clone(data.vacant),
          },
          cards: clone(data.cards || {}),
        })
        setMsg('')
        setTab('edit')
      }

      function patchOfficial(idx, patch) {
        setDraft(function (d) {
          var next = clone(d)
          var o = Object.assign({}, next.roster.officials[idx], patch)
          next.roster.officials[idx] = o
          if ((patch.office !== undefined || patch.name !== undefined) && typeof next.cards[o.id] === 'string') {
            next.cards[o.id] = next.cards[o.id].replace(/^# 官职｜.*$/m, '# 官职｜' + (o.office || '') + ' · ' + (o.name || ''))
          }
          return next
        })
      }

      function setCard(idx, text) {
        setDraft(function (d) {
          var next = clone(d)
          next.cards[next.roster.officials[idx].id] = text
          return next
        })
      }

      function addOfficial() {
        setDraft(function (d) {
          var next = clone(d)
          var n = next.roster.officials.length + 1
          var id = 'official-' + Date.now()
          var office = '新官职'
          var name = '待定'
          var pad = (n < 10 ? '0' : '') + n
          next.roster.officials.push({
            id: id, office: office, name: name, style: '', avatar: '',
            domain: [], not_domain: [], model: '',
            card: 'officials/' + pad + '-' + office + '-' + name + '.md',
            blind_spots: [], output_format: [], prompt: '',
          })
          next.cards[id] = '# 官职｜' + office + ' · ' + name
            + '\n\n> 管辖：。推荐模型：\n\n## 此人如何思考\n\n- \n\n## 性格与口吻\n\n- \n'
            + '\n## 职责范围\n\n- **管**：\n- **不管**：\n\n## 盲点（陛下须知）\n\n- \n'
            + '\n## 议政输出格式\n\n一、\n二、\n\n## 启动提示词（可直接复制）\n\n> 你是……就以下事情向陛下进言：<议题>。\n'
          return next
        })
      }

      function delOfficial(idx) {
        setDraft(function (d) {
          var next = clone(d)
          var o = next.roster.officials[idx]
          next.roster.officials.splice(idx, 1)
          delete next.cards[o.id]
          return next
        })
      }

      function save() {
        setBusy(true)
        setMsg('保存中…')
        var payload = clone(draft)
        payload.roster.updated = new Date().toISOString().slice(0, 10)
        fetch('/api/court/save', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })
          .then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j } }) })
          .then(function (out) {
            setBusy(false)
            if (out.j && out.j.ok) {
              setMsg('')
              setTab('browse')
              setDraft(null)
              reload()
              flash('已保存 ' + (out.j.written || []).length + ' 个文件')
            } else {
              setMsg('保存失败：' + ((out.j && out.j.error) || ('HTTP ' + out.status)))
            }
          })
          .catch(function (e) {
            setBusy(false)
            setMsg('保存失败：' + String(e && e.message ? e.message : e))
          })
      }

      var editing = tab === 'edit'
      var officials = (draft ? draft.roster.officials : (data ? data.officials : [])) || []
      var cards = draft ? draft.cards : (data ? data.cards : {})
      var q = filter.trim().toLowerCase()
      var hit = officials.filter(function (o) {
        if (!q) return true
        return [o.office, o.name, o.style, (o.domain || []).join(' '), (o.blind_spots || []).join(' '), o.model]
          .join(' ').toLowerCase().indexOf(q) >= 0
      })

      var body
      if (err) {
        body = h('div', { style: { padding: '32px', color: T.warn, fontSize: '13px', lineHeight: 1.9, maxWidth: '640px' } },
          h('div', { style: { fontWeight: 600, marginBottom: '6px', fontSize: '15px' } }, '名册读不出来'),
          h('div', { style: { fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '12px' } }, err),
          h('div', { style: { color: T.faint, marginTop: '14px', fontSize: '12px' } },
            '宿主的 GET /api/court/roster 没应答。刚装完插件要重启 app 才会挂上宿主路由；',
            '也可能是朝廷目录里缺 roster.json。'),
        )
      } else if (!data) {
        body = h('div', { style: { padding: '60px', textAlign: 'center', color: T.dim, fontSize: '13px' } }, '正在请名册…')
      } else if (editing && draft) {
        body = h('div', null, draft.roster.officials.map(function (o, idx) {
          return h(EditorCard, {
            key: o.id, official: o, card: draft.cards[o.id], models: data.models,
            onPatch: function (p) { patchOfficial(idx, p) },
            onCard: function (t) { setCard(idx, t) },
            onDelete: function () { delOfficial(idx) },
          })
        }))
      } else {
        var buckets = [[], [], []]
        hit.forEach(function (o) { buckets[groupIndex(o.office)].push(o) })
        var sections = []
        GROUPS.forEach(function (g, gi) {
          if (!buckets[gi].length) return
          sections.push(h('div', { key: g.key, style: { marginBottom: '26px' } },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' } },
              h('div', { style: { width: '3px', height: '16px', background: g.seal, borderRadius: '2px' } }),
              h('span', { style: { fontSize: '13px', fontWeight: 600, letterSpacing: '1px' } }, g.title),
              h('span', { style: { fontSize: '11px', color: T.faint } }, g.hint),
              h('span', { style: { fontSize: '11px', color: T.faint, marginLeft: 'auto' } }, buckets[gi].length + ' 位'),
            ),
            h('div', {
              style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' },
            }, buckets[gi].map(function (o) {
              return h(ViewerCard, {
                key: o.id, official: o, card: cards ? cards[o.id] : null,
                onCopy: onCopy, onSolo: soloChat,
              })
            })),
          ))
        })
        if (!sections.length) {
          sections.push(h('div', { style: { padding: '60px', textAlign: 'center', color: T.faint, fontSize: '13px' } },
            officials.length ? '没有匹配的官员' : '名册是空的 —— 切到「编辑」加一位'))
        }
        if (!q && data.vacant && data.vacant.length) {
          sections.push(h('div', { key: 'vacant' } ,
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' } },
              h('div', { style: { width: '3px', height: '16px', background: T.borderHi, borderRadius: '2px' } }),
              h('span', { style: { fontSize: '13px', color: T.dim, fontWeight: 600, letterSpacing: '1px' } }, '待补官职'),
              h('span', { style: { fontSize: '11px', color: T.faint } }, '说一声就写卡'),
            ),
            h('div', {
              style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '9px' },
            }, data.vacant.map(function (v) {
              return h('div', {
                key: v.office,
                style: { background: T.surfaceTop, border: '1px dashed ' + T.border, borderRadius: '10px', padding: '10px 12px' },
              },
                h('div', { style: { fontSize: '12px', fontWeight: 600, marginBottom: '4px' } }, v.office),
                h('div', { style: { fontSize: '11px', color: T.dim, lineHeight: 1.6 } }, v.domain),
                h('div', { style: { fontSize: '11px', color: T.faint, marginTop: '4px' } }, '候选 ' + (v.candidates || []).join(' / ')),
              )
            })),
          ))
        }
        body = h('div', null, sections)
      }

      function segBtn(key, label) {
        var on = tab === key
        return h('button', {
          type: 'button',
          onClick: function () {
            if (key === 'edit') startEdit()
            else { setTab('browse'); setDraft(null); setMsg('') }
          },
          style: {
            padding: '5px 14px', fontSize: '12px', cursor: 'pointer', borderRadius: '6px', border: 'none',
            background: on ? T.surfaceHi : 'transparent', color: on ? T.text : T.dim,
            fontWeight: on ? 600 : 400, fontFamily: 'inherit',
          },
        }, label)
      }

      return h('div', {
        'data-dsh-plugin': 'dsh-court', 'data-dsh-part': 'page',
        style: {
          height: '100%', minHeight: '100%', display: 'flex', flexDirection: 'column',
          background: T.bg, color: T.text, position: 'relative',
        },
      },
        // 页头
        h('div', {
          style: {
            display: 'flex', alignItems: 'center', gap: '14px',
            padding: '20px 26px 16px',
            background: 'linear-gradient(180deg,' + rgba(T.gold, 0.07) + ', transparent)',
          },
        },
          h(Seal, { size: 44 }),
          h('div', { style: { minWidth: 0, flex: 1 } },
            h('div', { style: { fontSize: '19px', fontWeight: 600 } }, (data && data.court) || '小朝廷'),
            h('div', { style: { fontSize: '11px', color: T.faint, marginTop: '4px' } },
              '名册零成本 · 点将才调模型'
              + (data ? '　·　' + officials.length + ' 位在朝' : '')
              + (data && data.updated ? '　·　更新于 ' + data.updated : '')),
          ),
          h('button', {
            type: 'button', style: btn('ghost'),
            onClick: function () { if (CTX && CTX.layout) CTX.layout.selectPanel(CONVERSATION_KEY) },
          }, '回到对话'),
        ),
        // 工具栏
        err ? null : h('div', {
          style: {
            display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap',
            padding: '0 26px 14px',
          },
        },
          !editing ? h('input', {
            type: 'text', value: filter, placeholder: '筛选：官职 / 姓名 / 管辖 / 盲点 / 模型',
            onChange: function (e) { setFilter(e.target.value) },
            style: Object.assign(inputStyle(), { flex: '1 1 240px', maxWidth: '380px' }),
          }) : null,
          !editing ? h('span', { style: { fontSize: '11px', color: T.faint } },
            q ? '命中 ' + hit.length + ' / ' + officials.length : '') : null,
          editing ? h('button', { type: 'button', style: btn('soft'), onClick: addOfficial, disabled: busy }, '＋ 加官') : null,
          editing ? h('button', { type: 'button', style: btn('primary'), onClick: save, disabled: busy }, busy ? '保存中…' : '保存') : null,
          editing ? h('button', {
            type: 'button', style: btn('ghost'), disabled: busy,
            onClick: function () { setTab('browse'); setDraft(null); setMsg('') },
          }, '放弃') : null,
          msg ? h('span', { style: { fontSize: '11px', color: T.warn } }, msg) : null,
          h('div', {
            style: {
              marginLeft: 'auto', display: 'flex', gap: '2px', padding: '2px',
              background: T.surface, borderRadius: '8px', border: '1px solid ' + T.border,
            },
          }, segBtn('browse', '浏览'), segBtn('edit', '编辑')),
        ),
        h('div', { style: { padding: '4px 26px 36px', overflow: 'auto', flex: 1 } }, body),
        toast ? h('div', {
          style: {
            position: 'absolute', bottom: '26px', left: '50%', transform: 'translateX(-50%)',
            background: T.surfaceHi, border: '1px solid ' + T.borderHi, borderRadius: '9px',
            padding: '10px 18px', fontSize: '12px', boxShadow: T.shadow,
          },
        }, toast) : null,
      )
    }

    // ⚠ 用到的每个服务都必须列在这里，漏一个就抛 "cannot get property X without inject"
    var inject = ['slots', 'layout', 'uiWorkspace']

    function apply(ctx) {
      CTX = ctx

      // 侧栏顶部导航项
      ctx.slots.inject('sidebar.panellist', function () {
        try {
          return ctx.slots.register(
            { name: 'sidebar.panellist', id: PANEL_KEY, order: 15, label: '小朝廷' },
            CourtNav,
          )
        } catch (e) { return function () {} }
      })

      // 对应的中央面板
      ctx.slots.inject('main', function () {
        try {
          return ctx.slots.register({ name: 'main', key: PANEL_KEY }, CourtPage)
        } catch (e) { return function () {} }
      })
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
