<template>
  <div class="modal-overlay" @click.self="!noClose && $emit('close')">
    <div class="modal-box">
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
defineProps({
  noClose: { type: Boolean, default: false }
})
defineEmits(['close'])
</script>

<style scoped>
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
</style>
