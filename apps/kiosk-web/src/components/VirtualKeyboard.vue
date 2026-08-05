<script setup lang="ts">
const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
]

function append(char: string) {
  emit('update:modelValue', props.modelValue + char)
}

function backspace() {
  emit('update:modelValue', props.modelValue.slice(0, -1))
}
</script>

<template>
  <div class="virtual-keyboard" data-testid="virtual-keyboard">
    <div v-for="(row, ri) in ROWS" :key="ri" class="kb-row">
      <button
        v-for="key in row"
        :key="key"
        type="button"
        class="kb-key"
        @click="append(key)"
      >
        {{ key }}
      </button>
      <button
        v-if="ri === ROWS.length - 1"
        type="button"
        class="kb-key kb-key--backspace"
        data-testid="kb-backspace"
        @click="backspace"
      >
        &#9003;
      </button>
    </div>
    <div class="kb-row">
      <button
        type="button"
        class="kb-key kb-key--space"
        data-testid="kb-space"
        @click="append(' ')"
      >
        Spasi
      </button>
    </div>
  </div>
</template>
