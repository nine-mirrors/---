/* eslint-env node */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:vue/vue3-recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
    'plugin:prettier/recommended',
  ],
  plugins: ['import'],
  settings: {
    // 让 import 插件按 tsconfig paths 解析 '@/...' 别名
    'import/resolver': {
      typescript: { project: './tsconfig.json' },
    },
  },
  parser: 'vue-eslint-parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parser: '@typescript-eslint/parser',
  },
  rules: {
    'vue/multi-word-component-names': 'off',
    // 未使用项只告警不阻断；TS 文件交由 @typescript-eslint 版本检查
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'warn',
    // 少量历史弱类型边界（http 拦截器、onboarding 草稿）以 any 诚实表达并附行内注释
    '@typescript-eslint/no-explicit-any': 'warn',
    'vue/no-unused-components': 'warn',
    'vue/no-unused-vars': 'warn',
    // 静态 import 图零循环（动态 import() 打破的环不在此列），防止分层腐化
    'import/no-cycle': ['error', { maxDepth: 10, ignoreExternal: true }],
  },
  overrides: [
    {
      // Node 侧配置文件（vite.config.ts 等）允许 Node 全局
      files: ['*.cjs', '*.mjs'],
      env: {
        node: true,
      },
    },
  ],
}
