// 零新增依赖方案：本工程不安装 @types/node（FR-47 白名单外），
// vite.config.ts 仅用到 node:url 的 fileURLToPath/URL，这里给出最小诚实声明。
// 如需更多 Node API，统一在 Task 12+ 评估后扩充或申请加入 @types/node。
declare module 'node:url' {
  export class URL {
    constructor(input: string, base?: string | URL)
    readonly pathname: string
  }
  export function fileURLToPath(url: URL | string): string
}
