// m3care Worker
//
// Two responsibilities:
//   GET|PUT  /api/plan   -> the wash/upgrade plan document, stored in D1
//   POST     /*          -> Anthropic API proxy (Chemical Lookup), unchanged
//
// The plan used to live in public/wash-plan.json and was written via the GitHub
// Contents API. That meant base64 round-trips (which silently corrupted the file
// by re-encoding it on every save), a 1 MiB ceiling, SHA conflict retries, and a
// full CI deploy per checkbox. D1 removes all of that.

const ALLOWED_ORIGINS = [
  'https://andylambert05-ship-it.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
]

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || ''
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, If-Match',
    'Vary': 'Origin',
  }
}

const json = (request, body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request), ...extra },
  })

// ── /api/plan ────────────────────────────────────────────────────────────────

// Structural validation. The forms guard most of this, but the API must not
// rely on the client - an upgrade with an empty title and phase was previously
// accepted with a 200 and rendered as a blank row.
function validatePlan(d) {
  const problems = []
  for (const key of ['meta', 'upgrades', 'chemicals', 'washSteps']) {
    if (!d[key]) problems.push(`missing top-level key: ${key}`)
  }
  const named = (list, label, field) => {
    if (!Array.isArray(list)) return
    list.forEach((x, i) => {
      if (!x || typeof x !== 'object') { problems.push(`${label}[${i}] is not an object`); return }
      if (!String(x[field] || '').trim()) problems.push(`${label}[${i}] has an empty ${field}`)
    })
    const ids = list.map(x => x && x.id).filter(Boolean)
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i)
    if (dupes.length) problems.push(`${label} has duplicate ids: ${[...new Set(dupes)].join(', ')}`)
  }
  named(d.upgrades?.items, 'upgrades', 'item')
  named(d.chemicals, 'chemicals', 'name')
  named(d.tools, 'tools', 'name')
  named(d.reminders, 'reminders', 'name')
  named(d.factoryParts?.items, 'factoryParts', 'component')
  if (Array.isArray(d.upgrades?.items)) {
    d.upgrades.items.forEach((u, i) => {
      if (!String(u?.phase || '').trim()) problems.push(`upgrades[${i}] has an empty phase`)
      if (!String(u?.id || '').trim()) problems.push(`upgrades[${i}] has no id`)
    })
  }
  return problems
}

async function getPlan(request, env) {
  const row = await env.DB.prepare('SELECT data, updated_at FROM plan WHERE id = 1').first()
  if (!row) return json(request, { error: 'Plan not found' }, 404)
  // data is stored as TEXT; hand it back parsed so the client never decodes
  return json(request, { data: JSON.parse(row.data), updated_at: row.updated_at })
}

async function putPlan(request, env) {
  if (!env.PLAN_TOKEN) return json(request, { error: 'Server missing PLAN_TOKEN' }, 500)
  const auth = request.headers.get('Authorization') || ''
  if (auth !== `Bearer ${env.PLAN_TOKEN}`) return json(request, { error: 'Unauthorized' }, 401)

  let payload
  try {
    payload = await request.json()
  } catch {
    return json(request, { error: 'Body is not valid JSON' }, 400)
  }
  if (!payload || typeof payload.data !== 'object' || payload.data === null) {
    return json(request, { error: 'Expected { data: <object> }' }, 400)
  }

  const problems = validatePlan(payload.data)
  if (problems.length) {
    return json(request, { error: 'Invalid plan', problems: problems.slice(0, 10) }, 400)
  }

  const next = JSON.stringify(payload.data)

  // Corruption guard. The old base64 bug doubled the file on every save and ran
  // undetected for 12 saves. Anything growing more than 50% in one write is far
  // more likely to be a bug than a real edit; require ?force=1 to override.
  const current = await env.DB.prepare('SELECT data, updated_at FROM plan WHERE id = 1').first()
  if (current) {
    const force = new URL(request.url).searchParams.get('force') === '1'
    if (!force && next.length > current.data.length * 1.5) {
      return json(request, {
        error: 'Refusing write: payload grew from ' + current.data.length +
               ' to ' + next.length + ' bytes in a single save. Retry with ?force=1 if intended.',
      }, 409)
    }
    // Optional optimistic concurrency: send If-Match with the updated_at you read.
    const ifMatch = request.headers.get('If-Match')
    if (ifMatch && ifMatch !== current.updated_at) {
      return json(request, { error: 'Conflict: plan changed since you loaded it', updated_at: current.updated_at }, 412)
    }
  }

  const updatedAt = new Date().toISOString()
  await env.DB.prepare('UPDATE plan SET data = ?, updated_at = ? WHERE id = 1')
    .bind(next, updatedAt).run()

  return json(request, { ok: true, updated_at: updatedAt, bytes: next.length })
}

// ── Anthropic proxy (unchanged behaviour) ────────────────────────────────────

async function anthropicProxy(request, env) {
  // The Anthropic key is billed to us, so this must not be an open relay.
  // Previously ANY POST to ANY path reached api.anthropic.com with our
  // credentials attached - a request with no headers at all came back with
  // 'invalid_request_error' rather than 'authentication_error', i.e. the key
  // had already been accepted. Same token as writes, so the app is unaffected.
  if (!env.PLAN_TOKEN) return json(request, { error: 'Server missing PLAN_TOKEN' }, 500)
  const auth = request.headers.get('Authorization') || ''
  if (auth !== `Bearer ${env.PLAN_TOKEN}`) return json(request, { error: 'Unauthorized' }, 401)

  const body = await request.text()
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'web-search-2025-03-05',
    },
    body,
  })
  const data = await response.text()
  return new Response(data, {
    status: response.status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
  })
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(request) })
    }

    const { pathname } = new URL(request.url)

    if (pathname === '/api/plan') {
      if (request.method === 'GET') return getPlan(request, env)
      if (request.method === 'PUT') return putPlan(request, env)
      return json(request, { error: 'Method not allowed' }, 405)
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders(request) })
    }
    return anthropicProxy(request, env)
  },
}
