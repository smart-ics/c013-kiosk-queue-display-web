<script setup lang="ts">
const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  submit: []
}>()

const QWERTY_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
]

const NUMPAD_ROWS = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
  ['.', '0'],
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
    <div class="kb-side kb-side--qwerty">
      <div v-for="(row, ri) in QWERTY_ROWS" :key="ri" class="kb-row">
        <button
          v-for="key in row"
          :key="key"
          type="button"
          class="kb-key"
          :data-testid="`kb-key-${key}`"
          @click="append(key)"
        >
          {{ key }}
        </button>
        <button
          v-if="ri === QWERTY_ROWS.length - 1"
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

    <div class="kb-side kb-side--numpad">
      <div v-for="(row, ri) in NUMPAD_ROWS" :key="ri" class="kb-row">
        <button
          v-for="key in row"
          :key="key"
          type="button"
          class="kb-key kb-key--num"
          :data-testid="`kb-key-${key}`"
          @click="append(key)"
        >
          {{ key }}
        </button>
        <button
          v-if="ri === NUMPAD_ROWS.length - 1"
          type="button"
          class="kb-key kb-key--enter"
          data-testid="kb-enter"
          @click="emit('submit')"
        >
          &#8629;
        </button>
      </div>
    </div>
  </div>
</template>
