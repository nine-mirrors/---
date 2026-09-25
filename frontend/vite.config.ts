import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import type { Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

/**
 * 开发服务器强制 no-store（仅 dev 生效，不影响 build/test）。
 *
 * 背景：本机出现过浏览器/系统代理（安全软件、网络加速器等）把模块响应连同
 * HTTP 响应头一起缓存损坏的情况——再取该模块时拿到的是带 `HTTP/1.1 200`
 * 明文头的二进制碎片，浏览器按 JS 解析即 SyntaxError，且 Vite 默认的
 * no-cache 在不合规的中间代理面前仍会被命中。整页刷新也救不回来：
 * 子模块 URL 不变，浏览器继续吃那条坏缓存。
 *
 * 这里在响应头真正发出的最后一刻把 Cache-Control 改成 no-store，
 * 让浏览器与任何合规中间层都不得缓存源码模块（依赖预构建产物保留不可变缓存）。
 */
function devNoStorePlugin(): Plugin {
  return {
    name: 'ndh-dev-no-store',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req as { url?: string }).url ?? ''
        // Vite 依赖预构建产物带内容 hash，本就不可变，保留其长缓存以保证启动速度
        const isImmutableDep = url.includes('/node_modules/.vite/deps/')
        if (!isImmutableDep) {
          const originalWriteHead = res.writeHead.bind(res)
          res.writeHead = ((...args: Parameters<typeof originalWriteHead>) => {
            res.setHeader('Cache-Control', 'no-store, max-age=0')
            res.setHeader('Pragma', 'no-cache')
            res.setHeader('Expires', '0')
            return originalWriteHead(...args)
          }) as typeof res.writeHead
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // envDir 传相对路径，由 Vite 按启动目录（npm 脚本即在 frontend/）解析；
  // 不使用 process.cwd() 以避免本项目未引入 @types/node 的类型问题。
  const env = loadEnv(mode, '.')

  // 构建保护：任何构建默认都不允许带着 mock 数据打包，防止演示配置误上正式环境
  //（不限定 mode，避免 vite build --mode staging 绕过）。
  // 当前演示版通过 .env.production 的 VITE_ALLOW_MOCK_BUILD=true 显式放行；
  // 正式部署应把 VITE_USE_MOCK 改为 false 并删除该允许项。
  if (command === 'build' && env.VITE_USE_MOCK === 'true' && env.VITE_ALLOW_MOCK_BUILD !== 'true') {
    throw new Error(
      '构建包仍为 mock 模式（VITE_USE_MOCK=true）。正式部署请先将 VITE_USE_MOCK 改为 false；如确需打包演示版本，请显式设置 VITE_ALLOW_MOCK_BUILD=true。',
    )
  }

  return {
    plugins: [
      devNoStorePlugin(),
      vue(),
      // Element Plus 按需：模板中的 el-* 组件自动注册并只打包用到的组件与样式。
      // 函数式调用（ElMessage/ElMessageBox）不走模板，其样式在 main.ts 手动引入。
      Components({
        resolvers: [ElementPlusResolver()],
        // 生成 src/components.d.ts，供 vue-tsc/Volar 识别自动注册的全局组件
        dts: 'src/components.d.ts',
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
    },
    build: {
      rollupOptions: {
        output: {
          // vendor 拆包（仅保留两个大库的手动切分）：
          // - zrender 为 echarts 的渲染底层，独立成包
          // - echarts：useEcharts 按需注册（折线/柱状等）
          // - element-plus 已按需自动引入，组件跟随引用方 chunk，由 rollup 自动共享
          // - 其余 node_modules 归入 vendor
          manualChunks(id: string): string | undefined {
            if (!id.includes('node_modules')) return undefined
            if (id.includes('node_modules/zrender')) {
              return 'zrender'
            }
            if (id.includes('node_modules/echarts')) {
              return 'echarts'
            }
            // EP 已按需引入：不强制归 vendor，让用到的组件跟随路由 chunk 共享/懒加载
            if (
              id.includes('node_modules/element-plus') ||
              id.includes('node_modules/@element-plus')
            ) {
              return undefined
            }
            return 'vendor'
          },
        },
      },
    },
    test: {
      // 纯函数测试在 node 环境即可；DOM/组件测试在 spec 文件头用
      // // @vitest-environment jsdom 单独开启
      environment: 'node',
      include: ['src/**/*.spec.ts'],
    },
  }
})
