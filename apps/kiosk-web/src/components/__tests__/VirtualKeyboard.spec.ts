import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import VirtualKeyboard from '../VirtualKeyboard.vue'

describe('VirtualKeyboard', () => {
  it('emits update:modelValue when a key is pressed', async () => {
    const wrapper = mount(VirtualKeyboard, { props: { modelValue: '' } })
    await wrapper.get('button:not([data-testid])').trigger('click')
    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeDefined()
    expect(emitted![0]).toEqual(['1'])
  })

  it('appends character to existing value', async () => {
    const wrapper = mount(VirtualKeyboard, { props: { modelValue: 'AB' } })
    const firstKey = wrapper.find('.kb-key:not(.kb-key--backspace):not(.kb-key--space)')
    await firstKey.trigger('click')
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['AB1'])
  })

  it('removes last character on backspace', async () => {
    const wrapper = mount(VirtualKeyboard, { props: { modelValue: 'ABC' } })
    await wrapper.get('[data-testid="kb-backspace"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['AB'])
  })

  it('adds space when spacebar clicked', async () => {
    const wrapper = mount(VirtualKeyboard, { props: { modelValue: 'Hello' } })
    await wrapper.get('[data-testid="kb-space"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['Hello '])
  })
})
