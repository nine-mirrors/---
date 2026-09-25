import { describe, it, expect } from 'vitest'
import { readExifOrientation, orientationSwapsDimensions } from '@/utils/image'

// 构造最小可读的 EXIF TIFF 数据块（8 字节 TIFF 头 + 1 个 IFD 条目 + 4 字节 next 偏移）
function tiffBlock(orientation: number, littleEndian: boolean): number[] {
  const o = orientation & 0xff
  if (littleEndian) {
    return [
      // 字节序 II + 魔数 0x002A + IFD0 偏移 8
      0x49,
      0x49,
      0x2a,
      0x00,
      0x08,
      0x00,
      0x00,
      0x00,
      // IFD0 条目数 = 1
      0x01,
      0x00,
      // tag 0x0112(Orientation), type 3(SHORT), count 1, 值（小端，左对齐）
      0x12,
      0x01,
      0x03,
      0x00,
      0x01,
      0x00,
      0x00,
      0x00,
      o,
      0x00,
      0x00,
      0x00,
      // next IFD 偏移 = 0
      0x00,
      0x00,
      0x00,
      0x00,
    ]
  }
  return [
    // 字节序 MM + 魔数 0x002A + IFD0 偏移 8
    0x4d,
    0x4d,
    0x00,
    0x2a,
    0x00,
    0x00,
    0x00,
    0x08,
    // IFD0 条目数 = 1
    0x00,
    0x01,
    // tag 0x0112, type 3, count 1, 值（大端，左对齐在高位两字节）
    0x01,
    0x12,
    0x00,
    0x03,
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    o,
    0x00,
    0x00,
    // next IFD 偏移 = 0
    0x00,
    0x00,
    0x00,
    0x00,
  ]
}

// 组装最小 JPEG：SOI + 一个假 APP0（验证段遍历）+ APP1/EXIF
function jpegWithExif(tiff: number[]): Uint8Array {
  const app0Payload = new Array(14).fill(0)
  const app0Seg = [0xff, 0xe0, 0x00, app0Payload.length + 2, ...app0Payload]
  const exifHeader = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00] // "Exif\0\0"
  const app1Payload = [...exifHeader, ...tiff]
  const app1Len = app1Payload.length + 2
  const app1Seg = [0xff, 0xe1, (app1Len >> 8) & 0xff, app1Len & 0xff, ...app1Payload]
  return new Uint8Array([0xff, 0xd8, ...app0Seg, ...app1Seg])
}

describe('readExifOrientation', () => {
  it('小端 EXIF：1/3/6/8 典型值正确解析', () => {
    expect(readExifOrientation(jpegWithExif(tiffBlock(1, true)))).toBe(1)
    expect(readExifOrientation(jpegWithExif(tiffBlock(3, true)))).toBe(3)
    expect(readExifOrientation(jpegWithExif(tiffBlock(6, true)))).toBe(6)
    expect(readExifOrientation(jpegWithExif(tiffBlock(8, true)))).toBe(8)
  })

  it('大端 EXIF：orientation=6 正确解析', () => {
    expect(readExifOrientation(jpegWithExif(tiffBlock(6, false)))).toBe(6)
  })

  it('支持直接传入 ArrayBuffer', () => {
    const bytes = jpegWithExif(tiffBlock(8, true))
    const buf = bytes.buffer as ArrayBuffer
    expect(readExifOrientation(buf)).toBe(8)
  })

  it('无 EXIF 的 JPEG 返回 1', () => {
    // SOI + APP0 + SOS
    const jpeg = new Uint8Array([
      0xff,
      0xd8,
      0xff,
      0xe0,
      0x00,
      0x10,
      ...new Array(14).fill(0),
      0xff,
      0xda,
    ])
    expect(readExifOrientation(jpeg)).toBe(1)
  })

  it('非 JPEG / 截断 / 非法 orientation 均安全回落 1', () => {
    expect(readExifOrientation(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(1)
    expect(readExifOrientation(new Uint8Array([0xff, 0xd8]))).toBe(1)
    expect(readExifOrientation(new Uint8Array([]))).toBe(1)
    // 声明 APP1 但长度截断
    expect(readExifOrientation(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff]))).toBe(1)
    // orientation=9 超出 1–8
    expect(readExifOrientation(jpegWithExif(tiffBlock(9, true)))).toBe(1)
  })
})

describe('orientationSwapsDimensions', () => {
  it('仅 6/8 需要交换宽高', () => {
    expect(orientationSwapsDimensions(6)).toBe(true)
    expect(orientationSwapsDimensions(8)).toBe(true)
    expect(orientationSwapsDimensions(1)).toBe(false)
    expect(orientationSwapsDimensions(3)).toBe(false)
  })
})
