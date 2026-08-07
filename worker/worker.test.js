import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'

const TOKEN = 'test-plan-token'
const auth = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
const URL_PLAN = 'https://example.com/api/plan'

// Minimal document that satisfies validatePlan()
const basePlan = () => ({
  meta: { title: 'M3 Care Plan', version: '4.0.0' },
  upgrades: { items: [{ id: 'u1', item: 'Midpipe', phase: 'Phase 1 - Test', priority: 1 }] },
  chemicals: [{ id: 'c1', name: 'Foam Soap' }],
  tools: [{ name: 'Pressure Washer' }],
  reminders: [{ id: 'r1', name: 'Check wheel torque' }],
  factoryParts: { items: [{ id: 'f1', component: 'Oil Filter' }] },
  washSteps: { normal: [{ id: 's1', title: 'Pre-rinse' }] },
})

async function seed(plan = basePlan()) {
  await env.DB.prepare(
    'CREATE TABLE IF NOT EXISTS plan (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL, updated_at TEXT NOT NULL)'
  ).run()
  await env.DB.prepare('DELETE FROM plan').run()
  await env.DB.prepare('INSERT INTO plan (id, data, updated_at) VALUES (1, ?, ?)')
    .bind(JSON.stringify(plan), new Date().toISOString()).run()
}

const put = (body, headers = auth, qs = '') =>
  SELF.fetch(URL_PLAN + qs, { method: 'PUT', headers, body: JSON.stringify(body) })

describe('CORS', () => {
  beforeEach(() => seed())

  it('reflects an allowed origin on preflight', async () => {
    const res = await SELF.fetch(URL_PLAN, { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173' } })
    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173')
  })

  it('does NOT reflect a disallowed origin', async () => {
    const res = await SELF.fetch(URL_PLAN, { method: 'OPTIONS', headers: { Origin: 'https://evil.example.com' } })
    expect(res.headers.get('Access-Control-Allow-Origin')).not.toBe('https://evil.example.com')
  })
})

describe('GET /api/plan', () => {
  beforeEach(() => seed())

  it('returns the plan and a timestamp, without auth', async () => {
    const res = await SELF.fetch(URL_PLAN)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.meta.title).toBe('M3 Care Plan')
    expect(body.updated_at).toBeTruthy()
  })

  it('404s when no row exists', async () => {
    await env.DB.prepare('DELETE FROM plan').run()
    const res = await SELF.fetch(URL_PLAN)
    expect(res.status).toBe(404)
  })
})

describe('PUT /api/plan — auth', () => {
  beforeEach(() => seed())

  it('401s with no Authorization header', async () => {
    const res = await put({ data: basePlan() }, { 'Content-Type': 'application/json' })
    expect(res.status).toBe(401)
  })

  it('401s with the wrong token', async () => {
    const res = await put({ data: basePlan() }, { Authorization: 'Bearer nope', 'Content-Type': 'application/json' })
    expect(res.status).toBe(401)
  })
})

describe('PUT /api/plan — validation', () => {
  beforeEach(() => seed())

  it('accepts a well-formed plan', async () => {
    const res = await put({ data: basePlan() })
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
  })

  it('400s on a malformed body', async () => {
    const res = await SELF.fetch(URL_PLAN, { method: 'PUT', headers: auth, body: 'not json' })
    expect(res.status).toBe(400)
  })

  it('400s when data is missing', async () => {
    const res = await put({})
    expect(res.status).toBe(400)
  })

  it('400s on an empty upgrade item and phase', async () => {
    const p = basePlan()
    p.upgrades.items.push({ id: 'u2', item: '', phase: '' })
    const res = await put({ data: p })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid plan')
    expect(body.problems.join(' ')).toMatch(/empty item/)
  })

  it('400s on duplicate ids', async () => {
    const p = basePlan()
    p.upgrades.items.push({ ...p.upgrades.items[0] })
    const res = await put({ data: p })
    expect(res.status).toBe(400)
    expect((await res.json()).problems.join(' ')).toMatch(/duplicate ids/)
  })

  it('400s when a required top-level key is missing', async () => {
    const p = basePlan()
    delete p.chemicals
    const res = await put({ data: p })
    expect(res.status).toBe(400)
  })
})

describe('PUT /api/plan — safety guards', () => {
  beforeEach(() => seed())

  it('409s when the payload grows more than 1.5x', async () => {
    const p = basePlan()
    p.chemicals = Array.from({ length: 400 }, (_, i) => ({ id: 'c' + i, name: 'Padding chemical name ' + i }))
    const res = await put({ data: p })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/Refusing write/)
  })

  it('allows the same oversized write with ?force=1', async () => {
    const p = basePlan()
    p.chemicals = Array.from({ length: 400 }, (_, i) => ({ id: 'c' + i, name: 'Padding chemical name ' + i }))
    const res = await put({ data: p }, auth, '?force=1')
    expect(res.status).toBe(200)
  })

  it('412s on a stale If-Match', async () => {
    const res = await put({ data: basePlan() }, { ...auth, 'If-Match': '1999-01-01T00:00:00.000Z' })
    expect(res.status).toBe(412)
  })

  it('accepts a current If-Match', async () => {
    const cur = await (await SELF.fetch(URL_PLAN)).json()
    const res = await put({ data: basePlan() }, { ...auth, 'If-Match': cur.updated_at })
    expect(res.status).toBe(200)
  })
})

describe('PUT /api/plan — writes on an empty database (the UPSERT fix)', () => {
  it('creates row 1 when it does not exist, instead of silently no-opping', async () => {
    await env.DB.prepare(
      'CREATE TABLE IF NOT EXISTS plan (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL, updated_at TEXT NOT NULL)'
    ).run()
    await env.DB.prepare('DELETE FROM plan').run()

    const res = await put({ data: basePlan() })
    expect(res.status).toBe(200)

    // The regression: a bare UPDATE would have returned ok:true and written nothing
    const read = await SELF.fetch(URL_PLAN)
    expect(read.status).toBe(200)
    expect((await read.json()).data.meta.title).toBe('M3 Care Plan')
  })
})

describe('routing', () => {
  beforeEach(() => seed())

  it('405s on DELETE /api/plan', async () => {
    expect((await SELF.fetch(URL_PLAN, { method: 'DELETE' })).status).toBe(405)
  })

  it('405s on POST /api/plan', async () => {
    expect((await SELF.fetch(URL_PLAN, { method: 'POST', body: '{}' })).status).toBe(405)
  })

  it('405s on GET of an unknown path', async () => {
    expect((await SELF.fetch('https://example.com/nope')).status).toBe(405)
  })

  it('401s the Anthropic proxy without a token', async () => {
    const res = await SELF.fetch('https://example.com/', { method: 'POST', body: '{}' })
    expect(res.status).toBe(401)
  })
})

describe('unicode integrity', () => {
  beforeEach(() => seed())

  it('round-trips emoji, CJK and dashes byte-exact', async () => {
    const marker = 'émoji ❄️ 日本語 — dash ° 1:100'
    const p = basePlan()
    p.upgrades.items[0].notes = marker
    expect((await put({ data: p })).status).toBe(200)
    const body = await (await SELF.fetch(URL_PLAN)).json()
    expect(body.data.upgrades.items[0].notes).toBe(marker)
  })
})
