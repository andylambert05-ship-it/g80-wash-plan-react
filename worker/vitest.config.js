import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

// Runs the tests inside the real workerd runtime with a local D1, rather than a
// mock. PLAN_TOKEN is injected as a test-only binding - the real one is a
// Cloudflare secret and never appears in the repo.
export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          bindings: {
            PLAN_TOKEN: 'test-plan-token',
            ANTHROPIC_API_KEY: 'test-anthropic-key',
          },
        },
      },
    },
  },
})
