import { onBeforeUnmount, ref } from 'vue'

const MAX_EDGE = 1024
const MIME_JPEG = 'image/jpeg'
const OPEN_FAIL_MESSAGE = '摄像头打不开，可以用相册选择照片'

export interface CameraError {
  type: string
  message: string
}

export interface CapturedImage {
  dataUrl: string
  width: number
  height: number
  type: string
}

// 按错误类型给出可操作的中文提示；未命中的类型回落到通用文案
const ERROR_MESSAGES: Record<string, string> = {
  NotAllowedError: '摄像头权限被拒绝，可点浏览器地址栏左侧图标开启，或先用相册选照片',
  PermissionDeniedError: '摄像头权限被拒绝，可点浏览器地址栏左侧图标开启，或先用相册选照片',
  NotFoundError: '没有检测到摄像头，可以先用相册选照片',
  DevicesNotFoundError: '没有检测到摄像头，可以先用相册选照片',
  // navigator.mediaDevices 不存在（多为非 localhost / 非 https 环境）
  NotSupportedError: '当前环境不能直接拍照，请用 127.0.0.1 或 https 访问，或先用相册',
}

function stopMediaStream(mediaStream: MediaStream | null | undefined): void {
  if (!mediaStream) return
  mediaStream.getTracks().forEach((track) => {
    try {
      track.stop()
    } catch {
      // 轨道已停止时忽略
    }
  })
}

/**
 * 摄像头拍照 / 相册图片读取组合式函数。
 * 输出统一结构：{ dataUrl, width, height, type }
 */
export function useCamera() {
  const stream = ref<MediaStream | null>(null)
  const active = ref(false)
  const error = ref<CameraError | null>(null)

  // 每次 start 自增的请求序号：stop()/重试会使权限未决期间的旧请求失效，
  // 旧 Promise 晚到的流必须立即停止且不得写入响应式状态
  let requestSeq = 0

  function setError(type: string): void {
    error.value = { type, message: ERROR_MESSAGES[type] || OPEN_FAIL_MESSAGE }
  }

  /**
   * 打开后置摄像头并绑定到 video 元素。
   * @returns 是否成功
   */
  async function start(videoEl: HTMLVideoElement | null | undefined): Promise<boolean> {
    error.value = null

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      setError('NotSupportedError')
      active.value = false
      stopMediaStream(stream.value)
      stream.value = null
      return false
    }

    // 发起新请求前先停掉旧流，并让此前所有未决请求作废
    stopMediaStream(stream.value)
    stream.value = null
    active.value = false
    const seq = requestSeq + 1
    requestSeq = seq

    let mediaStream: MediaStream
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
    } catch (err) {
      // 请求已被 stop()/重试取代：不写任何状态（提示也不应覆盖新请求）
      if (seq !== requestSeq) return false
      // NotAllowedError / NotFoundError 等按类型给出口语化提示
      setError(err instanceof Error ? err.name : 'UnknownError')
      active.value = false
      stream.value = null
      return false
    }

    // 权限弹窗期间用户已关闭弹窗或点了重试：晚到的流立即关停，不预览、不写状态
    if (seq !== requestSeq) {
      stopMediaStream(mediaStream)
      return false
    }

    stream.value = mediaStream
    active.value = true
    if (videoEl) {
      videoEl.srcObject = mediaStream
      try {
        await videoEl.play()
      } catch {
        // 自动播放被拦截时不视为致命错误，用户点击播放控件即可
      }
      // play() 等待期间弹窗可能已关闭，再确认一次请求有效性
      if (seq !== requestSeq) {
        stopMediaStream(mediaStream)
        if (videoEl.srcObject === mediaStream) {
          videoEl.srcObject = null
        }
        if (stream.value === mediaStream) {
          stream.value = null
          active.value = false
        }
        return false
      }
    }
    return true
  }

  /**
   * 将来源画面绘制到 canvas，并按最长边 1024 等比压缩。
   */
  function drawToCompressedCanvas(
    source: CanvasImageSource,
    sourceWidth: number,
    sourceHeight: number,
  ): CapturedImage {
    const width0 = Math.max(1, Math.round(sourceWidth))
    const height0 = Math.max(1, Math.round(sourceHeight))
    const longest = Math.max(width0, height0)
    const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1
    const width = Math.max(1, Math.round(width0 * scale))
    const height = Math.max(1, Math.round(height0 * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('canvas 2d context unavailable')
    }
    ctx.drawImage(source, 0, 0, width, height)

    return {
      dataUrl: canvas.toDataURL(MIME_JPEG, 0.8),
      width,
      height,
      type: MIME_JPEG,
    }
  }

  /**
   * 从 <video> 当前帧抓图。
   */
  function capture(videoEl: HTMLVideoElement | null | undefined): CapturedImage | null {
    if (!videoEl || !videoEl.videoWidth || !videoEl.videoHeight) return null
    return drawToCompressedCanvas(videoEl, videoEl.videoWidth, videoEl.videoHeight)
  }

  /**
   * 读取相册文件并压缩，输出结构与 capture 一致。
   */
  function loadFromFile(file: File | null | undefined): Promise<CapturedImage> {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error('empty file'))
        return
      }
      const objectUrl = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        try {
          const result = drawToCompressedCanvas(
            img,
            img.naturalWidth || img.width,
            img.naturalHeight || img.height,
          )
          resolve(result)
        } catch (err) {
          reject(err)
        } finally {
          URL.revokeObjectURL(objectUrl)
        }
      }
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('image decode failed'))
      }
      img.src = objectUrl
    })
  }

  function stop(): void {
    // 作废旧请求：权限未决期间关闭弹窗时，晚到的流由 start 自行关停
    requestSeq += 1
    stopMediaStream(stream.value)
    stream.value = null
    active.value = false
  }

  onBeforeUnmount(() => {
    stop()
  })

  return { stream, active, error, start, capture, loadFromFile, stop }
}
