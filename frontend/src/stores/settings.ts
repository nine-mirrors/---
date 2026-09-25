// 全局设置：语音播报开关、桌面端侧边栏收放，经 readGlobal/writeGlobal 全局存储（设备级偏好，不按账号隔离）

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { LS_KEYS } from '@/constants/dict'
import { readGlobal, writeGlobal } from '@/utils/storage'

interface SettingsPersist {
  speechEnabled?: boolean
  siderCollapsed?: boolean
}

export const useSettingsStore = defineStore('settings', () => {
  const saved = readGlobal<SettingsPersist>(LS_KEYS.settings)

  const speechEnabled = ref(!!(saved && saved.speechEnabled === true))
  const siderCollapsed = ref(!!(saved && saved.siderCollapsed === true))

  function persist(): void {
    writeGlobal<SettingsPersist>(LS_KEYS.settings, {
      speechEnabled: speechEnabled.value,
      siderCollapsed: siderCollapsed.value,
    })
  }

  function toggleSpeech(): void {
    speechEnabled.value = !speechEnabled.value
    persist()
  }

  function setSpeech(v: boolean): void {
    speechEnabled.value = v === true
    persist()
  }

  function toggleSider(): void {
    siderCollapsed.value = !siderCollapsed.value
    persist()
  }

  function setSiderCollapsed(v: boolean): void {
    siderCollapsed.value = v === true
    persist()
  }

  return {
    speechEnabled,
    siderCollapsed,
    toggleSpeech,
    setSpeech,
    toggleSider,
    setSiderCollapsed,
  }
})
