<template>
  <div class="task-card" :class="[task.status, { urgent: isUrgent }]" @dblclick="$emit('edit', task)">
    <div class="card-type-bar" :style="{ background: typeColor }"></div>
    <div class="card-body">
      <div class="card-header">
        <span class="card-type-label" :style="{ color: typeColor }">{{ typeLabel }}</span>
        <span class="card-status" :class="task.status">{{ statusLabel }}</span>
      </div>
      <div class="card-title" :class="{ 'line-through': task.status === 'done' }">{{ task.title }}</div>
      <div v-if="task.content" class="card-content">{{ task.content }}</div>
      <div class="card-footer">
        <span class="card-deadline">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          {{ formatDeadline }}
        </span>
        <span v-if="task.repeat_rule" class="card-repeat">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
          {{ repeatLabel }}
        </span>
        <div class="card-actions">
            <template v-if="task.status !== 'done'">
              <button class="action-btn complete-btn" @click.stop="$emit('complete', task.id)" title="完成">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
              </button>
              <button class="action-btn postpone-btn" @click.stop="$emit('postpone', task)" title="延期">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              </button>
            </template>
              <button class="action-btn delete-btn" @click.stop="$emit('delete', task)" title="删除">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
           </button>
           </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { TASK_TYPE_LABELS, STATUS_LABELS, getTaskTypes } from '../composables/database.js'

const props = defineProps({
  task: { type: Object, required: true }
})

defineEmits(['complete', 'postpone', 'edit', 'delete'])

const statusLabels = STATUS_LABELS

const typeColors = {
  key: '#ef4444', daily: '#3b82f6', security: '#f97316', tech: '#22c55e', career: '#a855f7'
}

const customTypeColors = ['#ef4444','#3b82f6','#f97316','#22c55e','#a855f7','#ec4899','#14b8a6','#8b5cf6','#f43f5e','#06b6d4']

const typeColor = computed(() => typeColors[props.task.type] || customTypeColors[Object.keys(getTaskTypes()).indexOf(props.task.type) % customTypeColors.length] || '#6b7280')
const typeLabel = computed(() => getTaskTypes()[props.task.type] || props.task.type)
const statusLabel = computed(() => statusLabels[props.task.status] || props.task.status)

const isUrgent = computed(() => {
  if (props.task.status === 'done') return false
  const dl = new Date(props.task.deadline)
  const diff = dl - Date.now()
  return diff < 3600000 && diff > 0 // 1小时内
})

const formatDeadline = computed(() => {
  const d = new Date(props.task.deadline)
  const now = new Date()
  const today = now.toDateString()
  const taskDate = d.toDateString()
  
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  
  if (taskDate === today) return `今天 ${time}`
  
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (d.toDateString() === tomorrow.toDateString()) return `明天 ${time}`
  
  return `${d.getMonth() + 1}/${d.getDate()} ${time}`
})

const repeatLabel = computed(() => {
  if (!props.task.repeat_rule) return ''
  const r = props.task.repeat_rule
  const map = { daily: '每天', weekly: '每周', monthly: '每月', custom: '自定义' }
  return map[r.type] || ''
})
</script>

<style scoped>
.task-card {
  display: flex;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: var(--transition);
  position: relative;
}
.task-card:hover {
  box-shadow: var(--shadow-sm);
  border-color: var(--border-color);
}

.task-card.urgent {
  border-color: var(--danger);
  animation: pulse-border 2s ease-in-out infinite;
}
@keyframes pulse-border {
  0%, 100% { border-color: var(--danger); }
  50% { border-color: rgba(239, 68, 68, 0.3); }
}

.task-card.done {
  opacity: 0.5;
}
.task-card.overdue {
  border-color: var(--danger);
  background: rgba(239, 68, 68, 0.04);
}

.card-type-bar {
  width: 3px;
  flex-shrink: 0;
}

.card-body {
  flex: 1;
  padding: 6px 10px;
  min-width: 0;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
}
.card-type-label {
  font-size: 10px;
  font-weight: 500;
}
.card-status {
  font-size: 9px;
  padding: 0px 6px;
  border-radius: 6px;
  font-weight: 500;
}
.card-status.pending {
  background: var(--accent-light);
  color: var(--accent);
}
.card-status.postponed {
  background: rgba(245, 158, 11, 0.1);
  color: var(--warning);
}
.card-status.overdue {
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger);
}
.card-status.done {
  background: rgba(16, 185, 129, 0.1);
  color: var(--success);
}

.card-title {
  font-size: 12px;
  color: var(--text-primary);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 1px;
}
.card-title.line-through {
  text-decoration: line-through;
  color: var(--text-hint);
}
.card-content {
  font-size: 10px;
  color: var(--text-hint);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 3px;
  padding-left: 2px;
}

.card-footer {
  display: flex;
  align-items: center;
  gap: 6px;
}
.card-deadline, .card-repeat {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 10px;
  color: var(--text-hint);
}
.overdue .card-deadline {
  color: var(--danger);
}

.card-actions {
  margin-left: auto;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: var(--transition);
}
.task-card:hover .card-actions {
  opacity: 1;
}

.action-btn {
  width: 22px;
  height: 22px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
}
.complete-btn {
  color: var(--success);
}
.complete-btn:hover {
  background: rgba(16, 185, 129, 0.1);
}
.postpone-btn {
  color: var(--warning);
}
.postpone-btn:hover {
  background: rgba(245, 158, 11, 0.1);
}
.delete-btn {
  color: var(--danger);
}
.delete-btn:hover {
  background: rgba(239, 68, 68, 0.1);
}
</style>
