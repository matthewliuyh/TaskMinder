import initSqlJs from 'sql.js'

let db = null
let dbPath = ''
let dbReady = false
let dbInitPromise = null

const TASK_TYPES = ['key', 'daily', 'security', 'tech', 'career']
const DEFAULT_TYPE_LABELS = {
  key: '重点任务', daily: '日常维护', security: '安全工作', tech: '科创工作', career: '个人晋升'
}
const TASK_TYPE_LABELS = { ...DEFAULT_TYPE_LABELS }
const TASK_STATUSES = ['pending', 'done', 'postponed', 'overdue']
const STATUS_LABELS = {
  pending: '待办', done: '已完成', postponed: '延期', overdue: '逾期'
}

// 文件读写通过 Electron IPC，用 base64 编码传输
async function readFileBuffer(filePath) {
  if (window.electronAPI) {
    try {
      const base64 = await window.electronAPI.readFile(filePath)
      if (!base64) return null
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      return bytes
    } catch (e) {
      console.warn('Read file failed:', e)
      return null
    }
  }
  return null
}

async function writeFileBuffer(filePath, data) {
  if (window.electronAPI) {
    try {
      // data 是 Uint8Array 或 ArrayBuffer，转为 base64
      const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      const base64 = btoa(binary)
      return await window.electronAPI.writeFile(filePath, base64)
    } catch (e) {
      console.error('Write file failed:', e)
      return false
    }
  }
  return false
}

export async function initDB(path) {
  if (dbInitPromise) return dbInitPromise

  dbInitPromise = (async () => {
    dbPath = path || ''

    // 配置 sql.js WASM 路径
    let SQL
    try {
      // 在 Electron file:// 协议下，用绝对路径加载 WASM
      const wasmUrl = new URL('./sql-wasm.wasm', window.location.href).href
      console.log('尝试加载 WASM:', wasmUrl)
      SQL = await initSqlJs({
        locateFile: () => wasmUrl
      })
    } catch (e) {
      console.error('sql.js WASM 加载失败:', e)
      alert('数据库引擎加载失败，请重启应用\n' + e.message)
      return null
    }

    // 尝试从文件加载已有数据库
    let buffer = null
    if (dbPath) {
      buffer = await readFileBuffer(dbPath)
    }

    db = buffer ? new SQL.Database(buffer) : new SQL.Database()

    // 建表
    db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT DEFAULT '',
        type TEXT NOT NULL DEFAULT 'daily',
        status TEXT NOT NULL DEFAULT 'pending',
        deadline TEXT NOT NULL,
        remind_before INTEGER DEFAULT 60,
        repeat_rule TEXT,
        repeat_end TEXT,
        parent_id INTEGER,
        postponed_at TEXT,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime'))
      )
    `)
    // 兼容旧表：如果缺少 content 列则新增
    try {
      db.run('ALTER TABLE tasks ADD COLUMN content TEXT DEFAULT \'\'')
    } catch (e) { /* 列已存在，忽略 */ }
    db.run(`
      CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        triggered TEXT,
        snoozed INTEGER DEFAULT 0,
        snooze_until TEXT,
        dismissed INTEGER DEFAULT 0,
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      )
    `)
    db.run(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `)

    await saveDB()
    dbReady = true

    // 加载自定义任务类型
    loadTaskTypeSettings()

    console.log('数据库初始化成功', dbPath || '(内存模式)')
    return db
  })()

  return dbInitPromise
}

// 确保 db 就绪
function ensureDB() {
  if (!db) {
    throw new Error('数据库未初始化')
  }
}

export async function saveDB() {
  if (!db) return
  if (!dbPath) return
  try {
    const data = db.export()
    await writeFileBuffer(dbPath, data)
  } catch (e) {
    console.error('Save DB error:', e)
  }
}

// ---- 任务 CRUD ----
export async function createTask(task) {
  ensureDB()
  db.run(
    `INSERT INTO tasks (title, content, type, status, deadline, remind_before, repeat_rule, repeat_end, parent_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      task.title,
      task.content || '',
      task.type || 'daily',
      task.status || 'pending',
      task.deadline,
      task.remind_before || 60,
      task.repeat_rule ? JSON.stringify(task.repeat_rule) : null,
      task.repeat_end || null,
      task.parent_id || null
    ]
  )
  await saveDB()
  const res = db.exec('SELECT last_insert_rowid() as id')
  const id = res[0]?.values[0]?.[0]
  console.log('任务已创建:', id, task.title)
  return id
}

export async function updateTask(id, updates) {
  ensureDB()
  const fields = []
  const values = []
  for (const [k, v] of Object.entries(updates)) {
    if (k === 'repeat_rule' && v) {
      fields.push(`${k} = ?`)
      values.push(JSON.stringify(v))
    } else {
      fields.push(`${k} = ?`)
      values.push(v)
    }
  }
  fields.push("updated_at = datetime('now','localtime')")
  values.push(id)
  db.run(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, values)
  await saveDB()
}

export async function deleteTask(id) {
  ensureDB()
  db.run('DELETE FROM tasks WHERE id = ?', [id])
  db.run('DELETE FROM reminders WHERE task_id = ?', [id])
  await saveDB()
}

export function getTasks(filter = {}) {
  if (!db) return []
  let sql = 'SELECT * FROM tasks WHERE 1=1'
  const params = []

  if (filter.status) {
    if (Array.isArray(filter.status)) {
      sql += ` AND status IN (${filter.status.map(() => '?').join(',')})`
      params.push(...filter.status)
    } else {
      sql += ' AND status = ?'
      params.push(filter.status)
    }
  }

  if (filter.type) {
    sql += ' AND type = ?'
    params.push(filter.type)
  }

  sql += " ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'overdue' THEN 1 WHEN 'postponed' THEN 2 WHEN 'done' THEN 3 END, deadline ASC"

  return query(sql, params)
}

export function getTaskById(id) {
  if (!db) return null
  const rows = query('SELECT * FROM tasks WHERE id = ?', [id])
  return rows[0] || null
}

export async function postponeTask(id, newDeadline) {
  ensureDB()
  db.run(
    "UPDATE tasks SET status = 'postponed', deadline = ?, postponed_at = datetime('now','localtime'), updated_at = datetime('now','localtime') WHERE id = ?",
    [newDeadline, id]
  )
  await saveDB()
}

export async function completeTask(id) {
  ensureDB()
  db.run(
    "UPDATE tasks SET status = 'done', updated_at = datetime('now','localtime') WHERE id = ?",
    [id]
  )
  await saveDB()
}

// ---- 提醒 ----
export function getTasksNeedingReminder(now) {
  if (!db) return []
  // 统一使用本地时间格式 'YYYY-MM-DD HH:MM:SS'，与 SQLite datetime() 函数返回格式一致
  now = now || toLocalDateTime(new Date())
  return query(
    `SELECT t.* FROM tasks t
     WHERE t.status IN ('pending', 'postponed', 'overdue')
     AND datetime(t.deadline, '-' || t.remind_before || ' minutes') <= ?
     AND NOT EXISTS (
       SELECT 1 FROM reminders r 
       WHERE r.task_id = t.id AND r.dismissed = 0 
       AND r.snooze_until > ?
     )
     ORDER BY t.deadline ASC`,
    [now, now]
  )
}

export async function createReminder(taskId, snoozed = false, snoozeUntil = null) {
  if (!db) return
  if (!snoozeUntil) {
    // 默认：在截止时间前不再重复弹；截止后每1小时再提醒
    const task = getTaskById(taskId)
    if (task) {
      const deadlineMs = new Date(task.deadline).getTime()
      const nowMs = Date.now()
      if (nowMs < deadlineMs) {
        // 还没到截止时间：设 snooze_until 为截止时间（截止前不再弹）
        snoozeUntil = toLocalDateTime(new Date(deadlineMs))
      } else {
        // 已过截止时间：1小时后再提醒
        snoozeUntil = toLocalDateTime(new Date(nowMs + 3600000))
      }
    } else {
      snoozeUntil = toLocalDateTime(new Date(Date.now() + 3600000))
    }
  }
  db.run(
    `INSERT INTO reminders (task_id, triggered, snoozed, snooze_until, dismissed) 
     VALUES (?, datetime('now','localtime'), ?, ?, 0)`,
    [taskId, snoozed ? 1 : 0, snoozeUntil]
  )
  await saveDB()
}

export async function dismissReminder(taskId) {
  if (!db) return
  // 标记所有未关闭的提醒为已关闭
  db.run(
    "UPDATE reminders SET dismissed = 1 WHERE task_id = ? AND dismissed = 0",
    [taskId]
  )
  // 创建一条阻止记录：截止后每1小时再提醒
  const task = getTaskById(taskId)
  if (task) {
    const nextRemind = toLocalDateTime(new Date(Math.max(new Date(task.deadline).getTime(), Date.now()) + 3600000))
    db.run(
      `INSERT INTO reminders (task_id, triggered, snoozed, snooze_until, dismissed) 
       VALUES (?, datetime('now','localtime'), 1, ?, 0)`,
      [taskId, nextRemind]
    )
  }
  await saveDB()
}

export async function snoozeReminder(taskId, minutes) {
  if (!db) return
  const snoozeUntil = toLocalDateTime(new Date(Date.now() + minutes * 60000))
  // 标记旧的未关闭提醒
  db.run(
    "UPDATE reminders SET dismissed = 1 WHERE task_id = ? AND dismissed = 0",
    [taskId]
  )
  // 创建新提醒，snooze_until 为用户选择的延后时间
  await createReminder(taskId, true, snoozeUntil)
}

// 启动时清理旧 reminders
export function cleanupReminders() {
  if (!db) return
  // 删除所有已关闭且 snooze_until 已过的旧记录
  db.run("DELETE FROM reminders WHERE dismissed = 1 AND snooze_until < datetime('now','localtime')")
  // 清理所有 dismissed=0 但 snooze_until 已过的记录，让系统重新触发
  db.run("DELETE FROM reminders WHERE dismissed = 0 AND snooze_until < datetime('now','localtime', '-1 day')")
  // 修复旧格式：将 UTC ISO 格式（含 'T' 或 'Z'）的 snooze_until 转为本地时间格式
  try {
    const badRows = query("SELECT id, snooze_until FROM reminders WHERE snooze_until LIKE '%T%' OR snooze_until LIKE '%Z%'")
    for (const row of badRows) {
      const localDt = toLocalDateTime(new Date(row.snooze_until))
      db.run("UPDATE reminders SET snooze_until = ? WHERE id = ?", [localDt, row.id])
    }
    if (badRows.length > 0) {
      console.log(`修复了 ${badRows.length} 条 UTC 格式的 snooze_until 记录`)
    }
  } catch (e) {
    console.error('修复旧格式 reminders 失败:', e)
  }
}

// ---- 周期任务 ----
export async function generateRecurringTasks() {
  if (!db) return
  const now = new Date()
  const today = now.toISOString().slice(0, 10)

  const templates = query(
    `SELECT * FROM tasks WHERE repeat_rule IS NOT NULL AND status = 'pending' AND (parent_id IS NULL OR parent_id = 0)`
  )

  for (const tmpl of templates) {
    if (!tmpl.repeat_rule) continue
    const rule = typeof tmpl.repeat_rule === 'string' ? JSON.parse(tmpl.repeat_rule) : tmpl.repeat_rule
    if (tmpl.repeat_end && today > tmpl.repeat_end) continue

    const existing = query(
      `SELECT id FROM tasks WHERE parent_id = ? AND date(deadline) = date(?)`,
      [tmpl.id, today]
    )
    if (existing.length > 0) continue

    if (shouldGenerateToday(rule, now)) {
      const timePart = tmpl.deadline.includes('T') ? tmpl.deadline.split('T')[1] : tmpl.deadline.split(' ')[1] || '18:00'
      const instanceDeadline = today + ' ' + timePart
      await createTask({
        title: tmpl.title,
        type: tmpl.type,
        deadline: instanceDeadline,
        remind_before: tmpl.remind_before,
        parent_id: tmpl.id
      })
    }
  }
}

function shouldGenerateToday(rule, now) {
  const dayOfWeek = now.getDay() || 7
  const dayOfMonth = now.getDate()

  switch (rule.type) {
    case 'daily': return true
    case 'weekly': return rule.weekdays ? rule.weekdays.includes(dayOfWeek) : true
    case 'monthly': return rule.day_of_month ? rule.day_of_month === dayOfMonth : true
    default: return false
  }
}

export async function markOverdueTasks() {
  if (!db) return
  db.run(
    `UPDATE tasks SET status = 'overdue' WHERE status = 'pending' AND deadline < datetime('now','localtime')`
  )
  await saveDB()
}

// ---- 设置 ----
export function getSetting(key) {
  if (!db) return null
  const rows = query('SELECT value FROM settings WHERE key = ?', [key])
  return rows[0]?.value || null
}

export async function setSetting(key, value) {
  if (!db) return
  db.run(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    [key, String(value)]
  )
  await saveDB()
}

// ---- 任务类型管理 ----
function loadTaskTypeSettings() {
  const saved = getSetting('task_types')
  if (saved) {
    try {
      const custom = JSON.parse(saved)
      // 合并：自定义覆盖默认，新增的也加入
      for (const [k, v] of Object.entries(custom)) {
        TASK_TYPE_LABELS[k] = v
      }
      // 删除已移除的
      for (const k of Object.keys(TASK_TYPE_LABELS)) {
        if (!(k in custom) && !(k in DEFAULT_TYPE_LABELS)) {
          delete TASK_TYPE_LABELS[k]
        }
      }
    } catch (e) { console.error('Load task types error:', e) }
  }
}

export function getTaskTypes() {
  return { ...TASK_TYPE_LABELS }
}

export async function saveTaskTypes(types) {
  // 更新内存中的标签
  for (const k of Object.keys(TASK_TYPE_LABELS)) {
    delete TASK_TYPE_LABELS[k]
  }
  Object.assign(TASK_TYPE_LABELS, types)
  await setSetting('task_types', JSON.stringify(types))
}

export function getDefaultTaskTypes() {
  return { ...DEFAULT_TYPE_LABELS }
}

// ---- 辅助 ----
function query(sql, params = []) {
  try {
    const res = db.exec(sql, params)
    if (!res.length) return []
    const columns = res[0].columns
    return res[0].values.map(row => {
      const obj = {}
      columns.forEach((col, i) => {
        let val = row[i]
        if (col === 'repeat_rule' && val) {
          try { val = JSON.parse(val) } catch (e) {}
        }
        obj[col] = val
      })
      return obj
    })
  } catch (e) {
    console.error('Query error:', sql, e)
    return []
  }
}

// ---- 时间格式统一工具 ----
// 所有时间字段统一使用 SQLite 本地时间格式：'YYYY-MM-DD HH:MM:SS'
// 禁止使用 JS toISOString()（UTC 格式），会导致字符串比较不一致
export function toLocalDateTime(date) {
  const d = date instanceof Date ? date : new Date(date)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export { TASK_TYPES, TASK_TYPE_LABELS, TASK_STATUSES, STATUS_LABELS }
