/**
 * dsh-court —— 宿主半边。
 *
 *  - GET  /api/court/roster   读名册 + 官卡 + 候选模型（只读，不花钱）
 *  - POST /api/court/save     写回 roster.json 与各官卡（整体保存）
 *
 * 朝廷目录按以下顺序取**第一个含 roster.json 的**：
 *   1. 环境变量 DSH_COURT_DIR
 *   2. 插件配置 courtDir（cordis.patch.yml 的 config）
 *   3. $DSH_HOME/court            ← 常规安装的默认位置
 *   4. 插件包的上一级目录          ← link 安装时插件就放在 <court>/plugin 下
 * 一个都不存在时，把随包附带的 starter/ 播种到 $DSH_HOME/court。
 *
 * 安全约束（这三条是硬要求，别删）：
 *  1. **仅回环**：写接口只接受本机请求。宿主上可能跑着远程访问插件，
 *     绝不能让 LAN / 手机来源改用户的名册文件。
 *  2. **路径限定**：所有写入路径必须落在朝廷目录内（防 ../ 越界），
 *     且先全量校验再落笔——一条越界就整体拒绝，不写半个字。
 *  3. **先备份 + 原子写**：写前复制 .bak；写 .tmp 后 rename 覆盖，
 *     不留残渣、不会写出半截文件。
 */
import { existsSync } from 'node:fs'
import {
  readFile, writeFile, copyFile, mkdir, rename, unlink, cp,
} from 'node:fs/promises'
import { join, resolve, relative, isAbsolute, dirname } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

/** Cordis 插件名。 */
export const name = 'dsh-court'

/** 需要的服务：只用到 web 服务器。 */
export const inject = ['webServer']

/** 插件包根目录。 */
const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** DSH 家目录。 */
const DSH_HOME = process.env.DSH_HOME || join(homedir(), '.dsh')

/** 随包附带的示例朝廷。 */
const STARTER_DIR = join(PKG_ROOT, 'starter')

/** 常规安装的默认朝廷目录（也是播种位置）。 */
const DEFAULT_COURT_DIR = join(DSH_HOME, 'court')

/** 路由路径。 */
const ROSTER_PATH = '/api/court/roster'
const SAVE_PATH = '/api/court/save'

/** 请求体上限，防误发大包。 */
const MAX_BODY_BYTES = 512 * 1024

/**
 * 候选朝廷目录（按优先级）。
 * @param config - 插件配置对象。
 * @returns 绝对路径数组。
 */
export function candidateCourtDirs(config) {
  const out = []
  if (process.env.DSH_COURT_DIR) out.push(resolve(process.env.DSH_COURT_DIR))
  if (config && typeof config.courtDir === 'string' && config.courtDir) {
    out.push(resolve(config.courtDir))
  }
  out.push(DEFAULT_COURT_DIR)
  out.push(resolve(PKG_ROOT, '..'))
  return out
}

/**
 * 选定朝廷目录：第一个已含 roster.json 的候选；都没有则返回默认播种位置。
 * @param config - 插件配置对象。
 * @returns { dir, candidates, seeded } 。
 */
export function resolveCourtDir(config) {
  const candidates = candidateCourtDirs(config)
  for (const dir of candidates) {
    try {
      if (existsSync(join(dir, 'roster.json'))) return { dir, candidates, seeded: false }
    } catch { /* 忽略不可读候选，继续下一个 */ }
  }
  return { dir: DEFAULT_COURT_DIR, candidates, seeded: true }
}

/**
 * 首次运行时从 starter/ 播种一份示例朝廷。
 * @param dir - 目标目录。
 * @returns 就绪的目录。
 */
async function ensureCourt(dir) {
  if (existsSync(join(dir, 'roster.json'))) return dir
  if (!existsSync(join(STARTER_DIR, 'roster.json'))) {
    throw new Error('朝廷目录不存在，且包里没有 starter/ 可播种：' + dir)
  }
  await mkdir(dir, { recursive: true })
  await cp(STARTER_DIR, dir, { recursive: true, force: false, errorOnExist: false })
  return dir
}

/**
 * 是否来自本机回环。
 * @param req - HTTP 请求。
 * @returns 回环为 true。
 */
function isLoopback(req) {
  const addr = (req.socket && req.socket.remoteAddress) || ''
  return (
    addr === '127.0.0.1' ||
    addr === '::1' ||
    addr === '::ffff:127.0.0.1' ||
    addr.startsWith('127.')
  )
}

/**
 * 解析并校验一个相对路径必须落在 courtDir 内。
 * @param courtDir - 朝廷目录绝对路径。
 * @param rel - 调用方给的相对路径。
 * @returns 绝对路径；越界或非法时抛错。
 */
export function safeJoin(courtDir, rel) {
  if (typeof rel !== 'string' || rel.length === 0) throw new Error('路径为空')
  if (isAbsolute(rel)) throw new Error('不接受绝对路径：' + rel)
  const abs = resolve(courtDir, rel)
  const r = relative(courtDir, abs)
  if (r === '' || r.startsWith('..') || isAbsolute(r)) throw new Error('路径越界：' + rel)
  return abs
}

/**
 * 原子写：先落 .tmp，再 rename 覆盖。失败时清掉 .tmp。
 * @param abs - 目标绝对路径。
 * @param content - 文本内容。
 */
async function writeAtomic(abs, content) {
  const tmp = abs + '.tmp'
  try {
    await writeFile(tmp, content, 'utf8')
    await rename(tmp, abs)
  } catch (error) {
    await unlink(tmp).catch(() => {})
    throw error
  }
}

/**
 * 读名册 + 各官卡 + 候选模型。
 * @param courtDir - 朝廷目录绝对路径。
 * @returns 供浏览器半边渲染的载荷。
 */
async function readCourt(courtDir) {
  const roster = JSON.parse(await readFile(join(courtDir, 'roster.json'), 'utf8'))
  const cards = {}
  for (const official of roster.officials ?? []) {
    if (!official.card) continue
    try {
      cards[official.id] = await readFile(join(courtDir, official.card), 'utf8')
    } catch {
      cards[official.id] = null // 卡缺失不是致命错误
    }
  }
  let models = []
  try {
    const m = JSON.parse(await readFile(join(courtDir, 'models.json'), 'utf8'))
    models = m.routes ?? []
  } catch {
    models = []
  }
  return {
    court: roster.court ?? '小朝廷',
    updated: roster.updated ?? null,
    principle: roster.principle ?? null,
    costModel: roster.cost_model ?? null,
    officials: roster.officials ?? [],
    vacant: roster.vacant_offices ?? [],
    cards,
    models,
    courtDir,
  }
}

/**
 * 读请求体（带上限）。
 * @param req - HTTP 请求。
 * @returns 解析后的 JSON 对象。
 */
function readJsonBody(req) {
  return new Promise((resolvePromise, rejectPromise) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > MAX_BODY_BYTES) {
        rejectPromise(new Error('请求体过大'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8')
        resolvePromise(text ? JSON.parse(text) : {})
      } catch (error) {
        rejectPromise(new Error('JSON 解析失败：' + error.message))
      }
    })
    req.on('error', rejectPromise)
  })
}

/**
 * 整体保存：roster.json + 各官卡。写前备份，写时原子替换。
 * @param courtDir - 朝廷目录绝对路径。
 * @param body - { roster, cards } 。
 * @returns 写入结果摘要。
 */
export async function saveCourt(courtDir, body) {
  const roster = body?.roster
  if (!roster || typeof roster !== 'object' || !Array.isArray(roster.officials)) {
    throw new Error('roster.officials 必须是数组')
  }
  const cards = body?.cards && typeof body.cards === 'object' ? body.cards : {}
  const written = []

  // 先把所有目标路径校验一遍：任一路径越界就整体拒绝，不写半个字
  const cardTargets = []
  for (const official of roster.officials) {
    if (!official?.card) continue
    cardTargets.push({ id: official.id, abs: safeJoin(courtDir, official.card), rel: official.card })
  }

  const rosterPath = join(courtDir, 'roster.json')
  await copyFile(rosterPath, rosterPath + '.bak').catch(() => {})
  await writeAtomic(rosterPath, JSON.stringify(roster, null, 2) + '\n')
  written.push('roster.json')

  for (const target of cardTargets) {
    const content = cards[target.id]
    if (typeof content !== 'string') continue
    await mkdir(resolve(target.abs, '..'), { recursive: true })
    await copyFile(target.abs, target.abs + '.bak').catch(() => {})
    await writeAtomic(target.abs, content)
    written.push(target.rel)
  }
  return { written }
}

/**
 * 挂载名册读取与整体保存路由。
 * @param ctx - 携带 webServer 的宿主插件上下文。
 */
export function apply(ctx) {
  const picked = resolveCourtDir(ctx && ctx.config)
  const courtDir = picked.dir

  const sendJson = (res, status, body) => {
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    })
    res.end(JSON.stringify(body))
  }

  ctx.effect(() => {
    const disposers = [
      ctx.webServer.register({
        kind: 'exact',
        path: ROSTER_PATH,
        handler: async (req, res) => {
          if (req.method !== 'GET') {
            res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' })
            res.end('method not allowed')
            return
          }
          try {
            await ensureCourt(courtDir)
            sendJson(res, 200, { ok: true, ...(await readCourt(courtDir)) })
          } catch (error) {
            sendJson(res, 500, {
              ok: false,
              error: String(error && error.message ? error.message : error),
              courtDir,
              candidates: picked.candidates,
            })
          }
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: SAVE_PATH,
        handler: async (req, res) => {
          if (req.method !== 'POST') {
            res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' })
            res.end('method not allowed')
            return
          }
          if (!isLoopback(req)) {
            sendJson(res, 403, { ok: false, error: 'forbidden: 非本机来源' })
            return
          }
          try {
            const body = await readJsonBody(req)
            const result = await saveCourt(courtDir, body)
            sendJson(res, 200, { ok: true, ...result })
          } catch (error) {
            sendJson(res, 400, {
              ok: false,
              error: String(error && error.message ? error.message : error),
            })
          }
        },
      }),
    ]
    return () => {
      for (const dispose of disposers) dispose()
    }
  }, 'dsh-court: routes')
}
