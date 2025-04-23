// eslint.config.mjs  ◆ Flat-Config / Node 20+
import { defineConfig } from 'eslint/config'

/* ─ 公式 Flat-Config packages ─ */
import js from '@eslint/js'
import ts from 'typescript-eslint'
import react from 'eslint-plugin-react'
import nextPlg from '@next/eslint-plugin-next'   // ←★ 正しいパッケージ名
import jsonPlg from '@eslint/json'
import globals from 'globals'

export default defineConfig([
  /* ─ 1. すべての JS / TS / JSX ─────────────────────── */
  {
    files: ['**/*.{js,jsx,ts,tsx,mjs,cjs}'],
    languageOptions: {
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
      globals: { ...globals.browser, ...globals.node }
    },
    plugins: { react },
    settings: { react: { version: 'detect' } },
    rules: { 'no-empty': ['error', { allowEmptyCatch: true }] }
  },

  /* ─ 2. JS / TS / React 推奨セット ─────────────────── */
  js.configs.recommended,
  ts.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],          // React18+ : react-in-jsx-scope 無効

  /* ─ 3. Next.js Core-Web-Vitals ルール ─────────────── */
  {
    plugins: { '@next/next': nextPlg },
    rules: nextPlg.configs['core-web-vitals'].rules
  },

  /* ─ 4. JSON / JSONC ──────────────────────────────── */
  {
    files: ['**/*.json', '**/*.jsonc'],
    plugins: { json: jsonPlg },
    languageOptions: { parser: jsonPlg.parser },
    rules: jsonPlg.configs.recommended.rules
  },

  /* ─ 5. 無視パターン ──────────────────────────────── */
  { ignores: ['**/node_modules/**', '**/.next/**', '**/dist/**'] }
])