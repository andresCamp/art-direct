import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  // Svelte plugin is required so vitest can compile .svelte and .svelte.ts
  // files (which use rune syntax). Without it, $effect / $state are silently
  // no-ops outside .svelte files — exactly the bug that broke persistence.
  plugins: [svelte({ hot: false })],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    // Class generator + persistence tests live here.
    include: ['src/**/*.test.ts'],
    // Tests that touch the singleton store + db need module isolation.
    // resetModules ensures each test file gets a fresh import graph.
    isolate: true,
  },
})
