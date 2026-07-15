<template>
  <div class="app-root" :data-theme="theme">
    <!-- 抽屉收起时的标签条 -->
    <div v-if="!drawerOpen" class="drawer-tab" :class="dockSide"
      @mouseenter="onTabEnter"
      @mouseleave="onTabLeave"
      @mousedown="onTabMouseDown"
      @click="onTabClick">
      <span class="tab-text">任务</span>
      <span class="tab-arrow">{{ dockSide === 'right' ? '‹' : '›' }}</span>
    </div>

    <!-- 展开态主面板 -->
    <div v-if="drawerOpen" class="panel" :class="dockSide">
        <!-- 顶部操作栏 -->
        <div class="title-bar" @dblclick="togglePin">
          <div class="title-actions">
            <button class="icon-btn" @click="togglePin" :title="pinned ? '取消置顶' : '置顶'" :class="{ active: pinned }">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 17v5M9 10l-3-3 2-2 3 3M15 10l3-3-2-2-3 3"/><rect x="6" y="10" width="12" height="4" rx="1"/></svg>
            </button>
          </div>
          <span class="app-title">任务提醒助手</span>
          <div class="title-actions">
            <button class="icon-btn" @click="toggleDrawer" title="收起面板">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 19l-7-7 7-7M18 19l-7-7 7-7"/></svg>
            </button>
          </div>
        </div>

        <!-- 搜索 -->
        <div class="quick-add">
          <input v-model="searchQuery" placeholder="搜索任务..." class="quick-input" />
          <button v-if="searchQuery" class="add-btn" @click="searchQuery = ''" title="清空">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <!-- 筛选 -->
        <div class="filter-bar">
          <div class="type-filters">
            <button v-for="(label, key) in typeLabels" :key="key"
              class="filter-chip type-chip"
              :class="{ active: typeFilter === key }"
              :style="typeFilter === key ? { background: getColorForKey(key), color: '#fff', borderColor: getColorForKey(key) } : {}"
              @click="typeFilter = typeFilter === key ? null : key">{{ label }}</button>
          </div>
          <div class="status-filters">
            <button class="filter-chip status-chip" :class="{ active: viewMode === 'postponed' }" @click="viewMode = viewMode === 'postponed' ? 'active' : 'postponed'">延期</button>
            <button class="filter-chip status-chip" :class="{ active: viewMode === 'overdue' }" @click="viewMode = viewMode === 'overdue' ? 'active' : 'overdue'">逾期</button>
            <button class="filter-chip status-chip" :class="{ active: viewMode === 'history' }" @click="viewMode = viewMode === 'history' ? 'active' : 'history'">历史</button>
          </div>
        </div>

        <!-- 任务列表 -->
        <div class="task-list" ref="taskListRef">
          <transition-group name="list" tag="div" class="task-list-inner">
            <TaskCard v-for="task in filteredTasks" :key="task.id"
              :task="task"
              @complete="completeTask"
              @postpone="openPostpone"
              @edit="openEdit"
              @delete="confirmDelete" />
          </transition-group>
          <div v-if="filteredTasks.length === 0" class="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-hint)" stroke-width="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
            <span>{{ viewMode === 'history' ? '暂无历史记录' : viewMode === 'overdue' ? '暂无逾期任务' : viewMode === 'postponed' ? '暂无延期任务' : '暂无任务' }}</span>
          </div>
        </div>

        <!-- 底部栏 -->
        <div class="bottom-bar">
          <button class="icon-btn" @click="openAddModal" title="添加任务">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
          </button>
          <span class="task-count">{{ activeTaskCount }} 项待办</span>
          <button class="icon-btn" @click="showSettings = true" title="设置">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
          </button>
         </div>
       </div>

    <!-- ========= 弹窗们 ========= -->

    <!-- 延期弹窗 -->
    <TransitionPopup v-if="postponeTask" @close="postponeTask = null">
      <div class="modal-title">延期至</div>
      <div class="form-row">
        <input type="date" v-model="postponeDate" class="form-input" />
        <input type="time" v-model="postponeTime" class="form-input" />
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary" @click="confirmPostpone">确认延期</button>
        <button class="btn btn-ghost" @click="postponeTask = null">取消</button>
      </div>
    </TransitionPopup>

    <!-- 添加/编辑弹窗 -->
    <TransitionPopup v-if="editModal" @close="closeEditModal">
      <div class="modal-title">{{ editModal.id ? '编辑任务' : '添加任务' }}</div>
      <div class="form-group">
        <label>任务名称</label>
        <input v-model="editModal.title" class="form-input" placeholder="输入任务名称" ref="editTitleRef" />
      </div>
      <div class="form-group">
        <label>任务内容</label>
        <textarea v-model="editModal.content" class="form-input form-textarea" placeholder="描述具体任务内容（可选）" rows="3"></textarea>
      </div>
      <div class="form-row">
        <div class="form-group flex-1">
          <label>类型</label>
          <select v-model="editModal.type" class="form-input">
            <option v-for="(label, key) in typeLabels" :key="key" :value="key">{{ label }}</option>
          </select>
        </div>
        <div class="form-group flex-1">
          <label>提前提醒</label>
          <select v-model="editModal.remind_before" class="form-input">
            <option :value="60">1小时</option>
            <option :value="120">2小时</option>
            <option :value="1440">1天</option>
            <option :value="2880">2天</option>
            <option :value="10080">7天</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group flex-1">
          <label>截止日期</label>
          <input type="date" v-model="editDate" class="form-input" />
        </div>
        <div class="form-group flex-1">
          <label>截止时间</label>
          <input type="time" v-model="editTime" class="form-input" />
        </div>
      </div>
      <div class="form-group">
        <label>重复</label>
        <select v-model="editModal.repeat_type" class="form-input" @change="onRepeatChange">
          <option value="none">不重复</option>
          <option value="daily">每天</option>
          <option value="weekly">每周</option>
          <option value="monthly">每月</option>
        </select>
      </div>
      <div v-if="editModal.repeat_type === 'weekly'" class="form-group">
        <label>重复日</label>
        <div class="weekday-picker">
          <button v-for="(d, i) in ['一','二','三','四','五','六','日']" :key="i"
            class="weekday-btn" :class="{ active: editModal.weekdays?.includes(i + 1) }"
            @click="toggleWeekday(i + 1)">{{ d }}</button>
        </div>
      </div>
      <div v-if="editModal.repeat_type === 'monthly'" class="form-group">
        <label>每月几号</label>
        <input type="number" v-model.number="editModal.day_of_month" min="1" max="31" class="form-input" placeholder="1-31" />
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary" @click="saveTask">{{ editModal.id ? '保存' : '添加' }}</button>
        <button class="btn btn-ghost" @click="closeEditModal">取消</button>
      </div>
    </TransitionPopup>

    <!-- 设置面板 -->
    <TransitionPopup v-if="showSettings" @close="showSettings = false">
      <div class="modal-title">设置</div>
      <div class="setting-item">
        <span>开机自动启动</span>
        <label class="switch"><input type="checkbox" v-model="autoStart" @change="toggleAutoStart" /><span class="slider"></span></label>
      </div>
      <div class="setting-item">
        <span>抽屉方向</span>
        <select v-model="dockSide" class="form-input small" @change="applyDockSide">
          <option value="right">右侧</option>
          <option value="left">左侧</option>
        </select>
      </div>
      <div class="setting-item">
        <span>默认提前提醒</span>
        <select v-model="defaultRemindBefore" class="form-input small" @change="saveDefaultRemind">
          <option :value="60">1小时</option>
          <option :value="120">2小时</option>
          <option :value="1440">1天</option>
          <option :value="2880">2天</option>
          <option :value="10080">7天</option>
        </select>
      </div>
      <div class="setting-group-label">任务类型</div>
      <div class="type-manager">
        <div v-for="(label, key) in typeLabels" :key="key" class="type-manager-item">
          <span class="type-dot" :style="{ background: getColorForKey(key) }"></span>
          <input :value="label" class="form-input type-name-input" @change="updateTypeName(key, $event.target.value)" />
          <button class="icon-btn tiny" @click="removeType(key)" title="删除" v-if="!isDefaultType(key)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="type-manager-add">
          <input v-model="editTypeVal" class="form-input type-name-input" placeholder="新类型名称" @keyup.enter="addType" />
          <button class="btn btn-primary tiny" @click="addType">添加</button>
        </div>
      </div>
      <div class="setting-group-label">主题风格</div>
      <div class="theme-picker">
        <div v-for="t in themes" :key="t.id" class="theme-option" :class="{ active: theme === t.id }" @click="setTheme(t.id)">
          <div class="theme-preview" :style="{ background: t.preview }"></div>
          <span>{{ t.name }}</span>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" @click="showSettings = false">关闭</button>
      </div>
    </TransitionPopup>

    <!-- 删除确认 -->
    <TransitionPopup v-if="deleteTarget" @close="deleteTarget = null">
      <div class="modal-title">确认删除</div>
      <p class="confirm-text">确定要删除「{{ deleteTarget.title }}」吗？</p>
      <div class="modal-actions">
        <button class="btn btn-danger" @click="doDelete">删除</button>
        <button class="btn btn-ghost" @click="deleteTarget = null">取消</button>
      </div>
    </TransitionPopup>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import TaskCard from './components/TaskCard.vue'
import TransitionPopup from './components/TransitionPopup.vue'
import {
  initDB, createTask, updateTask, deleteTask as dbDeleteTask,
  getTasks, completeTask as dbCompleteTask,
  postponeTask as dbPostponeTask,
  getTasksNeedingReminder, createReminder, dismissReminder as dbDismissReminder,
  snoozeReminder as dbSnoozeReminder,
  generateRecurringTasks, markOverdueTasks,
  getSetting, setSetting,
  getTaskTypes, saveTaskTypes, getDefaultTaskTypes,
  cleanupReminders, toLocalDateTime,
  STATUS_LABELS
} from './composables/database.js'

const typeLabels = ref(getTaskTypes())
const statusLabels = STATUS_LABELS

const typeColors = { key: '#ef4444', daily: '#3b82f6', security: '#f97316', tech: '#22c55e', career: '#a855f7' }

// 任务类型设置相关
const editTypeKey = ref('')
const editTypeVal = ref('')
const customTypeColors = ['#ef4444','#3b82f6','#f97316','#22c55e','#a855f7','#ec4899','#14b8a6','#8b5cf6','#f43f5e','#06b6d4']
const newTypeColor = ref('#8b5cf6')

function getColorForKey(k) {
  return typeColors[k] || customTypeColors[Object.keys(typeLabels.value).indexOf(k) % customTypeColors.length]
}

const themes = [
  { id: 'light', name: '极简白', preview: 'linear-gradient(135deg, #fff, #f5f6f8)' },
  { id: 'dark', name: '暗夜黑', preview: 'linear-gradient(135deg, #0f172a, #1e293b)' },
  { id: 'blue', name: '纯净蓝', preview: 'linear-gradient(135deg, #eff6ff, #dbeafe)' },
  { id: 'frosted', name: '透明磨砂', preview: 'linear-gradient(135deg, rgba(255,255,255,0.7), rgba(200,210,230,0.5))' }
]

// ---- 响应式状态 ----
const tasks = ref([])
const searchQuery = ref('')
const typeFilter = ref(null)
const viewMode = ref('active') // active / overdue / history
const drawerOpen = ref(true)
const pinned = ref(false)
const theme = ref('light')
const autoStart = ref(false)
const dockSide = ref('right')
const defaultRemindBefore = ref(60)
const showSettings = ref(false)
const postponeTask = ref(null)
const postponeDate = ref('')
const postponeTime = ref('')
const editModal = ref(null)
const editDate = ref('')
const editTime = ref('')
const deleteTarget = ref(null)
const taskListRef = ref(null)
const editTitleRef = ref(null)

let reminderTimer = null
let refreshTimer = null

// ---- 计算属性 ----
const filteredTasks = computed(() => {
  let list = tasks.value
  // 按视图模式过滤
  if (viewMode.value === 'history') {
    list = list.filter(t => t.status === 'done')
  } else if (viewMode.value === 'overdue') {
    list = list.filter(t => t.status === 'overdue')
  } else if (viewMode.value === 'postponed') {
    list = list.filter(t => t.status === 'postponed')
  } else {
    list = list.filter(t => t.status !== 'done')
  }
  // 按类型过滤
  if (typeFilter.value) list = list.filter(t => t.type === typeFilter.value)
  // 搜索过滤
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(t =>
      t.title?.toLowerCase().includes(q) ||
      t.content?.toLowerCase().includes(q)
    )
  }
  return list
})

const activeTaskCount = computed(() => tasks.value.filter(t => t.status !== 'done').length)

// 切换视图时重新从数据库加载
watch(viewMode, () => refreshTasks())

// ---- 初始化 ----
onMounted(async () => {
  try {
    let path = ''
    if (window.electronAPI) path = await window.electronAPI.getDbPath()
    await initDB(path)

    // 数据库初始化后，刷新类型标签（loadTaskTypeSettings 在 initDB 内执行）
    typeLabels.value = getTaskTypes()

    theme.value = getSetting('theme') || 'light'
    pinned.value = getSetting('pinned') === 'true'
    dockSide.value = getSetting('dockSide') || 'right'
    defaultRemindBefore.value = parseInt(getSetting('defaultRemindBefore') || '60')

    if (window.electronAPI) {
      autoStart.value = await window.electronAPI.getAutoStart()
      if (pinned.value) await window.electronAPI.toggleAlwaysOnTop(true)
    }

    await generateRecurringTasks()
    await markOverdueTasks()
    cleanupReminders() // 清理旧提醒记录
    refreshTasks()

    startReminderLoop()
    refreshTimer = setInterval(async () => {
      await markOverdueTasks()
      refreshTasks()
    }, 30000)
  } catch (e) {
    console.error('Init error:', e)
  }
})

onUnmounted(() => {
  if (reminderTimer) clearInterval(reminderTimer)
  if (refreshTimer) clearInterval(refreshTimer)
})

// ---- 任务操作 ----
function refreshTasks() {
  if (viewMode.value === 'history') {
    tasks.value = getTasks({ status: 'done' })
  } else if (viewMode.value === 'overdue') {
    tasks.value = getTasks({ status: 'overdue' })
  } else if (viewMode.value === 'postponed') {
    tasks.value = getTasks({ status: 'postponed' })
  } else {
    tasks.value = getTasks({ status: ['pending', 'postponed', 'overdue'] })
  }
}

async function completeTask(id) {
  await dbCompleteTask(id)
  refreshTasks()
}

function openPostpone(task) {
  postponeTask.value = task
  // 默认延期到明天 17:30
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  postponeDate.value = tomorrow.toISOString().slice(0, 10)
  postponeTime.value = '17:30'
}

async function confirmPostpone() {
  if (!postponeTask.value) return
  await dbPostponeTask(postponeTask.value.id, `${postponeDate.value} ${postponeTime.value}`)
  postponeTask.value = null
  refreshTasks()
}

function openAddModal() {
  const today = new Date()
  editModal.value = {
    title: '', content: '', type: 'daily', remind_before: defaultRemindBefore.value,
    repeat_type: 'none', weekdays: [], day_of_month: 1
  }
  editDate.value = today.toISOString().slice(0, 10)
  editTime.value = '17:30'
  nextTick(() => { editTitleRef.value?.focus() })
}

function openEdit(task) {
  editModal.value = {
    id: task.id, title: task.title, content: task.content || '',
    type: task.type,
    remind_before: task.remind_before || 60,
    repeat_type: task.repeat_rule?.type || 'none',
    weekdays: task.repeat_rule?.weekdays || [],
    day_of_month: task.repeat_rule?.day_of_month || 1
  }
  const dl = new Date(task.deadline)
  editDate.value = dl.toISOString().slice(0, 10)
  editTime.value = dl.toISOString().slice(11, 16)
}

function closeEditModal() { editModal.value = null }

function onRepeatChange() {
  if (editModal.value.repeat_type === 'weekly') editModal.value.weekdays = [1, 2, 3, 4, 5]
}

function toggleWeekday(day) {
  const idx = editModal.value.weekdays.indexOf(day)
  if (idx >= 0) editModal.value.weekdays.splice(idx, 1)
  else editModal.value.weekdays.push(day)
}

async function saveTask() {
  const m = editModal.value
  if (!m || !m.title.trim()) {
    alert('请输入任务名称')
    return
  }
  if (!editDate.value || !editTime.value) {
    alert('请选择截止时间')
    return
  }
  try {
    const deadline = `${editDate.value} ${editTime.value}`
    let repeat_rule = null
    if (m.repeat_type !== 'none') {
      repeat_rule = { type: m.repeat_type }
      if (m.repeat_type === 'weekly') repeat_rule.weekdays = m.weekdays
      if (m.repeat_type === 'monthly') repeat_rule.day_of_month = m.day_of_month
    }
    const taskData = {
      title: m.title.trim(),
      content: m.content?.trim() || '',
      type: m.type || 'daily',
      deadline,
      remind_before: Number(m.remind_before) || 60,
      repeat_rule
    }
    if (m.id) {
      await updateTask(m.id, { ...taskData })
    } else {
      await createTask(taskData)
    }
    closeEditModal()
    refreshTasks()
  } catch (e) {
    console.error('saveTask error:', e)
    alert('添加任务失败：' + (e.message || '未知错误'))
  }
}

function confirmDelete(task) { deleteTarget.value = task }

async function doDelete() {
  if (!deleteTarget.value) return
  await dbDeleteTask(deleteTarget.value.id)
  deleteTarget.value = null
  refreshTasks()
}

// ---- 窗口控制 ----
function toggleDrawer() {
  drawerOpen.value = !drawerOpen.value
  if (window.electronAPI) {
    if (drawerOpen.value) {
      window.electronAPI.expandDrawer()
    } else {
      window.electronAPI.collapseDrawer()
    }
  }
}

// ---- 标签条拖拽 ----
let tabDragStartY = 0
let tabDragMoved = false

function onTabMouseDown(e) {
  tabDragStartY = e.screenY
  tabDragMoved = false
  const onMouseMove = (ev) => {
    const deltaY = ev.screenY - tabDragStartY
    if (Math.abs(deltaY) > 2) tabDragMoved = true
    if (tabDragMoved && window.electronAPI) {
      window.electronAPI.moveTab(deltaY)
      tabDragStartY = ev.screenY
    }
  }
  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function onTabClick() {
  // 拖拽过则不触发点击
  if (tabDragMoved) return
  toggleDrawer()
}

function onTabEnter() {
  // 鼠标进入标签区域，恢复鼠标事件接收
  if (window.electronAPI) window.electronAPI.setIgnoreMouseEvents(false)
}

function onTabLeave() {
  // 鼠标离开标签区域，恢复穿透
  if (window.electronAPI) window.electronAPI.setIgnoreMouseEvents(true)
}

async function togglePin() {
  pinned.value = !pinned.value
  setSetting('pinned', pinned.value)
  if (window.electronAPI) await window.electronAPI.toggleAlwaysOnTop(pinned.value)
}

function minimizeApp() {
  if (window.electronAPI) window.electronAPI.hideWindow()
}

function setTheme(id) { theme.value = id; setSetting('theme', id) }

async function toggleAutoStart() {
  if (window.electronAPI) await window.electronAPI.setAutoStart(autoStart.value)
}

function applyDockSide() {
  setSetting('dockSide', dockSide.value)
  if (window.electronAPI) window.electronAPI.setDockSide(dockSide.value)
}

function saveDefaultRemind() { setSetting('defaultRemindBefore', defaultRemindBefore.value) }

// ---- 任务类型管理 ----
const defaultTypes = getDefaultTaskTypes()
function isDefaultType(key) { return key in defaultTypes }

function updateTypeName(key, newName) {
  if (!newName.trim()) return
  typeLabels.value = { ...typeLabels.value, [key]: newName.trim() }
  saveTaskTypes(typeLabels.value)
}

function removeType(key) {
  if (isDefaultType(key)) return
  delete typeLabels.value[key]
  typeLabels.value = { ...typeLabels.value } // 触发响应式更新
  saveTaskTypes(typeLabels.value)
}

function addType() {
  const name = editTypeVal.value.trim()
  if (!name) return
  // 生成 key：用拼音首字母或随机
  const key = 'custom_' + Date.now()
  typeLabels.value[key] = name
  // 分配颜色
  typeColors[key] = customTypeColors[Object.keys(typeLabels.value).length % customTypeColors.length]
  typeLabels.value = { ...typeLabels.value }
  saveTaskTypes(typeLabels.value)
  editTypeVal.value = ''
}

// ---- 提醒系统 ----
function startReminderLoop() {
  checkReminders()
  reminderTimer = setInterval(checkReminders, 30000)
}

function checkReminders() {
  // 统一使用本地时间格式，与 SQLite datetime() 返回格式一致
  const now = toLocalDateTime(new Date())
  const needRemind = getTasksNeedingReminder(now)
  for (const task of needRemind) {
    const deadline = new Date(task.deadline)
    const diffMs = deadline - Date.now()
    let remaining = ''
    if (diffMs > 0) {
      const mins = Math.floor(diffMs / 60000)
      remaining = mins < 60 ? `还剩${mins}分钟` : `还剩${Math.floor(mins / 60)}小时${mins % 60}分钟`
    } else {
      remaining = '已逾期'
    }
    createReminder(task.id)
    // 只弹桌面提醒窗口
    if (window.electronAPI) window.electronAPI.showReminder({ ...task, remaining })
  }
}

// 监听桌面弹窗的延后/关闭操作
if (window.electronAPI) {
  window.electronAPI.onSnoozeReminder(async (data) => {
    await dbSnoozeReminder(data.taskId, data.minutes)
    refreshTasks()
  })
  window.electronAPI.onDismissReminder(async (data) => {
    await dbDismissReminder(data.taskId)
    refreshTasks()
  })
  window.electronAPI.onCompleteTask?.(async (data) => {
    await dbCompleteTask(data.taskId)
    // 同时关闭该任务的所有提醒
    await dbDismissReminder(data.taskId)
    refreshTasks()
  })
  // 监听主进程抽屉状态变更（如 Alt+T 触发）
  window.electronAPI.onDrawerStateChanged?.((data) => {
    drawerOpen.value = !data.collapsed
    if (data.side) dockSide.value = data.side
  })
}

// ---- 工具函数 ----
function formatLocalDateTime(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function formatDateTime(dt) {
  if (!dt) return ''
  const d = new Date(dt)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
</script>

<style scoped>
.app-root {
  width: 100vw;
  height: 100vh;
  background: transparent;
  position: relative;
  overflow: hidden;
}

/* 收起时的侧边标签 */
.drawer-tab {
  width: 22px;
  height: 64px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 50;
  transition: all 0.2s ease;
  box-shadow: var(--shadow-sm);
}
.drawer-tab.right {
  border-right: none;
  border-radius: 8px 0 0 8px;
}
.drawer-tab.left {
  border-left: none;
  border-radius: 0 8px 8px 0;
}
.drawer-tab:hover {
  background: var(--accent-light);
  width: 26px;
}
.tab-text {
  font-size: 9px;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: 1px;
}
.tab-arrow {
  font-size: 16px;
  color: var(--text-hint);
  line-height: 1;
  margin-top: 2px;
}

/* 主面板 */
.panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow: hidden;
  border-radius: 0;
}

/* 动画（已禁用，窗口大小由主进程控制） */

/* 列表项动画 */
.list-enter-active, .list-leave-active {
  transition: all 0.25s ease;
}
.list-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.list-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
.list-move {
  transition: transform 0.25s ease;
}

/* 标题栏 */
.title-bar {
  -webkit-app-region: drag;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 6px;
  flex-shrink: 0;
}
.app-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: 0.5px;
}
.title-actions {
  -webkit-app-region: no-drag;
  display: flex;
  gap: 2px;
}
.icon-btn {
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: all 0.15s ease;
}
.icon-btn:hover { background: var(--bg-secondary); color: var(--text-primary); }
.icon-btn.active { color: var(--accent); background: var(--accent-light); }

/* 快速添加 */
.quick-add {
  padding: 0 14px 8px;
  flex-shrink: 0;
  position: relative;
}
.quick-input {
  width: 100%;
  padding: 9px 36px 9px 12px;
  background: var(--bg-input);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 13px;
  transition: all 0.2s ease;
}
.quick-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-light);
}
.quick-input::placeholder { color: var(--text-hint); }
.add-btn {
  position: absolute;
  right: 18px;
  top: 50%;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  transition: all 0.15s ease;
}
.add-btn:hover { background: var(--accent-light); }

/* 筛选 */
.filter-bar {
  padding: 0 14px 8px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.type-filters, .status-filters {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.filter-chip {
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border: 1px solid transparent;
  transition: all 0.15s ease;
  line-height: 1.5;
}
.type-chip.active, .status-chip.active {
  color: #fff;
}
.filter-chip:hover { opacity: 0.85; }

/* 任务列表 */
.task-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 14px;
}
.task-list-inner {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 160px;
  color: var(--text-hint);
  font-size: 13px;
}

/* 底部栏 */
.bottom-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  border-top: 1px solid var(--border-light);
  flex-shrink: 0;
}
.task-count {
  font-size: 12px;
  color: var(--text-hint);
}

/* 弹窗通用 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }

.modal-box {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 20px 22px;
  box-shadow: var(--shadow-lg);
  width: 92%;
  max-width: 340px;
  animation: slideUp 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
@keyframes slideUp { from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }

.modal-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
}

/* 表单 */
.form-group { margin-bottom: 12px; }
.form-group label {
  display: block;
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 4px;
  font-weight: 500;
}
.form-input {
  width: 100%;
  padding: 8px 10px;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 13px;
  transition: all 0.2s ease;
}
.form-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-light);
}
select.form-input { cursor: pointer; }
.form-textarea {
  resize: vertical;
  min-height: 60px;
  font-family: inherit;
  line-height: 1.5;
}
.form-input.small { width: auto; min-width: 100px; }
.form-row { display: flex; gap: 10px; }
.flex-1 { flex: 1; }

/* 任务类型管理 */
.type-manager {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.type-manager-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.type-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.type-name-input {
  flex: 1;
  padding: 5px 8px !important;
  font-size: 12px !important;
}
.type-manager-add {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-top: 4px;
}
.icon-btn.tiny {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}
.btn.tiny {
  padding: 4px 10px;
  font-size: 11px;
}

.modal-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  justify-content: flex-end;
}
.btn {
  padding: 7px 16px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s ease;
}
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover { opacity: 0.85; }
.btn-ghost { background: var(--bg-secondary); color: var(--text-secondary); }
.btn-ghost:hover { background: var(--border-color); }
.btn-danger { background: var(--danger); color: #fff; }
.btn-danger:hover { opacity: 0.85; }

.confirm-text { font-size: 13px; color: var(--text-secondary); margin-bottom: 4px; }

/* 周选择器 */
.weekday-picker { display: flex; gap: 4px; }
.weekday-btn {
  width: 34px; height: 28px; border-radius: var(--radius-sm);
  font-size: 12px; color: var(--text-secondary);
  background: var(--bg-input); border: 1px solid var(--border-color);
  transition: all 0.15s ease;
}
.weekday-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }

/* 设置 */
.setting-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 0; border-bottom: 1px solid var(--border-light);
  font-size: 13px; color: var(--text-primary);
}
.setting-group-label {
  font-size: 12px; color: var(--text-hint);
  margin-top: 14px; margin-bottom: 8px;
}

/* 开关 */
.switch { position: relative; width: 40px; height: 22px; display: inline-block; }
.switch input { display: none; }
.slider {
  position: absolute; inset: 0; background: var(--border-color);
  border-radius: 11px; transition: all 0.2s ease; cursor: pointer;
}
.slider::before {
  content: ''; position: absolute;
  width: 18px; height: 18px; left: 2px; top: 2px;
  background: #fff; border-radius: 50%;
  transition: all 0.2s ease;
}
.switch input:checked + .slider { background: var(--accent); }
.switch input:checked + .slider::before { transform: translateX(18px); }

/* 主题选择 */
.theme-picker { display: flex; gap: 10px; }
.theme-option {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  cursor: pointer; font-size: 11px; color: var(--text-secondary);
  transition: all 0.15s ease;
}
.theme-option.active { color: var(--accent); font-weight: 600; }
.theme-preview {
  width: 48px; height: 36px; border-radius: 8px;
  border: 2px solid transparent; transition: all 0.2s ease;
}
.theme-option.active .theme-preview {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-light);
}

/* 提醒弹窗 */
.reminder-modal {
  border-left: 4px solid var(--danger);
  padding-left: 16px;
}
.reminder-icon { font-size: 28px; margin-bottom: 8px; }
.reminder-title { font-size: 15px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px; }
.reminder-task { font-size: 14px; color: var(--text-primary); margin-bottom: 4px; font-weight: 500; }
.reminder-deadline { font-size: 12px; color: var(--text-secondary); margin-bottom: 16px; }
.remaining { color: var(--danger); font-weight: 600; margin-left: 6px; }
.reminder-actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.snooze-select {
  padding: 6px 8px; border: 1px solid var(--border-color);
  border-radius: var(--radius-sm); font-size: 12px;
  background: var(--bg-input); color: var(--text-primary); cursor: pointer;
  font-family: inherit;
}
</style>
