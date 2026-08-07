import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import VirtualKeyboard from '../VirtualKeyboard.vue'

describe('VirtualKeyboard', () => {
  it('emits update:modelValue when a qwerty key is pressed', async () => {
    const wrapper = mount(VirtualKeyboard, { props: { modelValue: '' } })
    await wrapper.get('[data-testid="kb-key-Q"]').trigger('click')
    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeDefined()
    expect(emitted![0]).toEqual(['Q'])
  })

  it('emits update:modelValue when a numpad key is pressed', async () => {
    const wrapper = mount(VirtualKeyboard, { props: { modelValue: '' } })
    await wrapper.get('[data-testid="kb-key-7"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['7'])
  })

  it('appends character to existing value', async () => {
    const wrapper = mount(VirtualKeyboard, { props: { modelValue: 'AB' } })
    await wrapper.get('[data-testid="kb-key-A"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['ABA'])
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

  it('emits submit when enter key clicked on numpad', async () => {
    const wrapper = mount(VirtualKeyboard, { props: { modelValue: 'ABC' } })
    await wrapper.get('[data-testid="kb-enter"]').trigger('click')
    expect(wrapper.emitted('submit')).toHaveLength(1)
  })
})

