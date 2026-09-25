// 可接入设备开关：key 为 DEVICES 中的设备 key，经 ns* 命名空间持久化
// R2.3：4 设备（删 CGM）；查询时支持设备 key 与首页卡片名

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { DEVICES, LS_KEYS } from '@/constants/dict'
import { nsRead, nsWrite } from '@/utils/storage'

const DEVICE_KEYS = DEVICES.map((device) => device.key)

function defaultConnected(): Record<string, boolean> {
  return DEVICE_KEYS.reduce<Record<string, boolean>>((acc, key) => {
    acc[key] = true
    return acc
  }, {})
}

// 仅合并已知设备 key，避免脏数据写入未知字段
function loadConnected(): Record<string, boolean> {
  const result = defaultConnected()
  const saved = nsRead<Record<string, unknown>>(LS_KEYS.devices)
  if (saved && typeof saved === 'object') {
    for (const key of DEVICE_KEYS) {
      if (saved[key] !== undefined) result[key] = saved[key] === true
    }
  }
  return result
}

export const useDevicesStore = defineStore('devices', () => {
  const connected = ref<Record<string, boolean>>(loadConnected())

  function persist(): void {
    nsWrite<Record<string, boolean>>(LS_KEYS.devices, connected.value)
  }

  // 卡片名 → 设备 key；本身是设备 key 时原样返回
  function resolveDeviceKey(cardKeyOrDeviceKey: string): string | null {
    if (DEVICE_KEYS.includes(cardKeyOrDeviceKey)) return cardKeyOrDeviceKey
    const matched = DEVICES.find((device) => device.card === cardKeyOrDeviceKey)
    return matched ? matched.key : null
  }

  function isConnected(cardKeyOrDeviceKey: string): boolean {
    const key = resolveDeviceKey(cardKeyOrDeviceKey)
    return key ? connected.value[key] === true : false
  }

  function toggle(key: string): void {
    if (!DEVICE_KEYS.includes(key)) return
    connected.value[key] = !connected.value[key]
    persist()
  }

  function setConnected(key: string, value: boolean): void {
    if (!DEVICE_KEYS.includes(key)) return
    connected.value[key] = value
    persist()
  }

  function reset(): void {
    connected.value = defaultConnected()
    persist()
  }

  return { connected, isConnected, toggle, setConnected, reset }
})
