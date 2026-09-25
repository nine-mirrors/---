// 零依赖图片处理（FR-4/FR-49）：
// - readExifOrientation：手写解析 JPEG APP1/TIFF 的 Orientation（1/3/6/8 等），无效返回 1
// - prepareMealImage：加载图片 → 最长边 1024 等比缩放 → 按 EXIF 方向校正 → JPEG 0.8 导出
//
// 只允许返回 EXIF 规范 1–8；无法解析时一律按 1（不旋转）处理，绝不阻断老人记录流程。

export const MEAL_IMAGE_MAX_EDGE = 1024
export const MEAL_IMAGE_QUALITY = 0.8
export const MEAL_IMAGE_MIME = 'image/jpeg'

const MARKER_PREFIX = 0xff
const MARKER_APP1 = 0xe1
const MARKER_SOS = 0xda // 扫描数据开始，其后不再有 APP 段
const TIFF_BIG = 0x4d4d // 'MM'
const TIFF_LITTLE = 0x4949 // 'II'
const TIFF_MAGIC = 0x002a
const TAG_ORIENTATION = 0x0112

type ByteReader = (index: number) => number

/**
 * 解析 JPEG EXIF Orientation。
 * @param input JPEG 文件的 ArrayBuffer 或 Uint8Array
 * @returns 1（正常）/3（180°）/6（顺时针 90°）/8（逆时针 90°）等；无效或无 EXIF 返回 1
 */
export function readExifOrientation(input: ArrayBuffer | Uint8Array): number {
  try {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1

    let offset = 2
    while (offset + 4 <= bytes.length) {
      // 段间可能有 0xFF 填充字节
      if (bytes[offset] !== MARKER_PREFIX) return 1
      const marker = bytes[offset + 1]
      if (marker === MARKER_SOS) return 1
      const segLen = (bytes[offset + 2] << 8) | bytes[offset + 3]
      if (segLen < 2 || offset + 2 + segLen > bytes.length) return 1

      if (marker === MARKER_APP1) {
        const payload = offset + 4
        // "Exif\0\0"
        if (
          bytes[payload] === 0x45 &&
          bytes[payload + 1] === 0x78 &&
          bytes[payload + 2] === 0x69 &&
          bytes[payload + 3] === 0x66 &&
          bytes[payload + 4] === 0x00 &&
          bytes[payload + 5] === 0x00
        ) {
          return parseTiffOrientation(bytes, payload + 6)
        }
      }

      offset += 2 + segLen
    }
    return 1
  } catch {
    return 1
  }
}

// 在 TIFF 头起始位置解析 IFD0 的 Orientation 标签
function parseTiffOrientation(bytes: Uint8Array, tiffStart: number): number {
  const order = (bytes[tiffStart] << 8) | bytes[tiffStart + 1]
  if (order !== TIFF_LITTLE && order !== TIFF_BIG) return 1
  const little = order === TIFF_LITTLE

  const u16: ByteReader = (i) =>
    little ? bytes[i] | (bytes[i + 1] << 8) : (bytes[i] << 8) | bytes[i + 1]
  const u32: ByteReader = (i) =>
    little
      ? (bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24)) >>> 0
      : ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0

  if (u16(tiffStart + 2) !== TIFF_MAGIC) return 1

  const ifdOffset = u32(tiffStart + 4)
  const ifdStart = tiffStart + ifdOffset
  if (ifdStart + 2 > bytes.length) return 1

  const entryCount = u16(ifdStart)
  for (let i = 0; i < entryCount; i += 1) {
    const entry = ifdStart + 2 + i * 12
    if (entry + 12 > bytes.length) return 1
    if (u16(entry) === TAG_ORIENTATION) {
      // SHORT 类型、count=1 时，值放在 4 字节值域的前 2 字节（两端序均左对齐）
      const orientation = u16(entry + 8)
      return orientation >= 1 && orientation <= 8 ? orientation : 1
    }
  }
  return 1
}

/** 方向是否需要交换画布宽高（6/8 为 90° 旋转） */
export function orientationSwapsDimensions(orientation: number): boolean {
  return orientation === 6 || orientation === 8
}

function loadImage(objectUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片读取失败，请换一张试试'))
    img.src = objectUrl
  })
}

function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('图片压缩失败，请换一张试试'))
      },
      MEAL_IMAGE_MIME,
      MEAL_IMAGE_QUALITY,
    )
  })
}

/**
 * 餐前图片统一处理：读取 EXIF 方向 → 等比缩放到最长边 1024 → 方向校正 → JPEG(0.8)。
 * 依赖浏览器 DOM（Image/canvas/URL），不在 node 单测覆盖；readExifOrientation 已单测。
 */
export async function prepareMealImage(file: File | Blob): Promise<Blob> {
  const buffer = await file.arrayBuffer()
  const orientation = readExifOrientation(buffer)

  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await loadImage(objectUrl)
    const sourceW = img.naturalWidth || img.width
    const sourceH = img.naturalHeight || img.height

    const longest = Math.max(sourceW, sourceH)
    const ratio = longest > MEAL_IMAGE_MAX_EDGE ? MEAL_IMAGE_MAX_EDGE / longest : 1
    const drawW = Math.max(1, Math.round(sourceW * ratio))
    const drawH = Math.max(1, Math.round(sourceH * ratio))
    const swaps = orientationSwapsDimensions(orientation)

    const canvas = document.createElement('canvas')
    canvas.width = swaps ? drawH : drawW
    canvas.height = swaps ? drawW : drawH
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas 2d context unavailable')

    ctx.save()
    // 3=180°；6=顺时针 90°；8=逆时针 90°；其余（1/2/4/5/7）本演示不做镜像翻转
    if (orientation === 3) {
      ctx.translate(drawW, drawH)
      ctx.rotate(Math.PI)
    } else if (orientation === 6) {
      ctx.translate(drawH, 0)
      ctx.rotate(Math.PI / 2)
    } else if (orientation === 8) {
      ctx.translate(0, drawW)
      ctx.rotate(-Math.PI / 2)
    }
    ctx.drawImage(img, 0, 0, drawW, drawH)
    ctx.restore()

    return await canvasToJpegBlob(canvas)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
