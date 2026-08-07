// Reusable save-status indicator for the plan write-back forms
import { useState } from 'react'
import { getConfig, addChemical, addTool, addUpgrade, editChemical, editTool, editReminder, deleteChemical, deleteTool, deleteUpgrade, deleteReminder } from '../utils/PlanStore'
import { sortPhaseNames } from '../utils/phases'

export function SyncStatus({ status }) {
  if (!status) return null
  const map = {
    saving: { color: '#0066b1', bg: 'var(--blue-bg)', bd: 'var(--blue-bd)', icon: 'ti-loader-2', spin: true, text: 'Saving…' },
    success: { color: '#1a9e62', bg: 'var(--green-bg)', bd: 'var(--iom-bd)', icon: 'ti-circle-check', text: 'Saved.' },
    error: { color: '#cc1e1e', bg: 'var(--red-bg)', bd: 'var(--red-bd)', icon: 'ti-alert-circle', text: null },
    notoken: { color: '#c8860a', bg: 'var(--amber-bg)', bd: 'var(--amber-bd)', icon: 'ti-alert-triangle', text: 'No plan token configured. Go to Settings tab to set up.' },
  }
  const s = map[status.type]
  if (!s) return null
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', background: s.bg, border: `1px solid ${s.bd}`, marginTop: 10 }}>
      <i className={`ti ${s.icon}${s.spin ? ' spin' : ''}`} style={{ color: s.color, fontSize: 14, flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
      <div style={{ fontSize: 12, color: s.color, fontWeight: 300 }}>{s.text || status.message}</div>
    </div>
  )
}

// Hook for plan save operations
export function usePlanSync() {
  const [syncStatus, setSyncStatus] = useState(null)

  const sync = async (operation, ...args) => {
    const config = getConfig()
    if (!config.token) {
      setSyncStatus({ type: 'notoken' })
      return false
    }
    setSyncStatus({ type: 'saving' })
    try {
      await operation(config, ...args)
      setSyncStatus({ type: 'success' })
      setTimeout(() => setSyncStatus(null), 5000)
      return true
    } catch (e) {
      setSyncStatus({ type: 'error', message: e.message })
      return false
    }
  }

  return { syncStatus, sync, setSyncStatus }
}


// ── Chemical Lookup ───────────────────────────────────────────────────────────
export function ChemicalLookup({ onResult }) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [preview, setPreview] = useState(null)

  const search = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setPreview(null)
    try {
      // The proxy now requires the plan token - it was previously an open relay
      // to Anthropic on our API key.
      const { token } = getConfig()
      if (!token) { setError('No plan token — add one on the Settings tab to use lookup.'); setLoading(false); return }
      const response = await fetch('https://m3care-anthropic-proxy.andy-lambert05.workers.dev', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          system: `You are a detailing chemical expert. Search the web for the product and extract structured info. Respond ONLY with a valid JSON object — no markdown, no backticks, no preamble. Keys: name (string), category (string — one of: Wheel Cleaner, Iron Remover, Tar Remover, Pre-wash / Snow Foam, All-Purpose Cleaner, Shampoo / Wash, Ceramic Coating Maintenance, Tyre Dressing, Glass Cleaner, Leather Cleaner, Leather Conditioner, Interior Cleaner, Paint Decontamination, Quick Detailer, Other), modes (array of "normal" and/or "maint"), usedOn (string), tool (string or null), shelfLife (string or null), storageNote (string or null), dilutions (array of objects with context/ratio/amount/note). If not found return {"error":"not found"}.`,
          messages: [{ role: 'user', content: `Look up detailing product: ${query}` }]
        })
      })
      if (response.status === 401) { setError('Lookup rejected — check the plan token on the Settings tab.'); setLoading(false); return }
      const data = await response.json()
      const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim()
      const result = JSON.parse(text.replace(/```json|```/g, '').trim())
      if (result.error) setError('Product not found — try a more specific name.')
      else setPreview(result)
    } catch (e) {
      setError('Search failed. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--bd)' }}>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t3)', marginBottom: 6 }}>
        <i className="ti ti-search" aria-hidden="true" /> Chemical lookup
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="e.g. CarPro Eraser, Koch Chemie GSF..."
          style={{ flex: 1, background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '8px 10px', fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none' }}
        />
        <button onClick={search} disabled={loading || !query.trim()}
          style={{ padding: '8px 16px', background: loading ? 'var(--card2)' : '#0066b1', color: loading ? 'var(--t3)' : '#fff', border: 'none', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: loading ? 'default' : 'pointer', fontFamily: 'Inter, sans-serif', flexShrink: 0 }}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>
      {error && (
        <div style={{ padding: '10px 12px', background: 'var(--amber-bg)', border: '1px solid var(--amber-bd)', fontSize: 12, color: 'var(--amber)', marginBottom: 10 }}>{error}</div>
      )}
      {preview && (
        <div style={{ background: 'var(--card2)', border: '1px solid var(--iom-bd)', padding: 14, marginBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{preview.name}</div>
              <div style={{ fontSize: 10, color: 'var(--t3)' }}>{preview.category}</div>
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 8px', background: 'var(--iom-bg)', color: 'var(--iom)', border: '1px solid var(--iom-bd)' }}>Found</span>
          </div>
          {preview.usedOn && <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 8, fontWeight: 300, lineHeight: 1.5 }}>{preview.usedOn}</div>}
          {preview.dilutions?.map((d, i) => (
            <div key={i} style={{ fontSize: 11, color: 'var(--blue)', fontWeight: 700, marginBottom: 2 }}>
              {d.context}: <span style={{ fontWeight: 300, color: 'var(--t2)' }}>{d.ratio}{d.amount ? ` (${d.amount})` : ''}</span>
            </div>
          ))}
          <button onClick={() => onResult(preview)}
            style={{ width: '100%', marginTop: 12, padding: '9px', background: '#1a9e62', color: '#fff', border: 'none', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            + Add to inventory
          </button>
        </div>
      )}
    </div>
  )
}

// Add Chemical Form
export function AddChemicalForm({ data, onClose }) {
  const { syncStatus, sync } = usePlanSync()
  const [showLookup, setShowLookup] = useState(true)
  const [showDetails, setShowDetails] = useState(false)
  const [form, setForm] = useState({
    name: '', category: '', modes: ['normal', 'maint'], usedOn: '',
    shelfLife: '', storageNote: '', tool: '',
    dilutions: [{ context: '', ratio: '', amount: '', note: '' }],
  })

  const handleLookupResult = (result) => {
    setForm({
      name: result.name || '',
      category: result.category || '',
      modes: result.modes || ['normal', 'maint'],
      usedOn: result.usedOn || '',
      shelfLife: result.shelfLife || '',
      storageNote: result.storageNote || '',
      tool: result.tool || '',
      dilutions: result.dilutions?.length
        ? result.dilutions.map(d => ({ context: d.context || '', ratio: d.ratio || '', amount: d.amount || '', note: d.note || '' }))
        : [{ context: '', ratio: '', amount: '', note: '' }],
    })
    setShowLookup(false)
    setShowDetails(true) // lookup filled details — show them
  }

  const categories = [...new Set((data?.chemicals || []).map(c => c.category))].sort()
  const f = (key, val) => setForm(p => ({ ...p, [key]: val }))
  const updateDil = (i, key, val) => {
    const next = form.dilutions.map((d, idx) => idx === i ? { ...d, [key]: val } : d)
    f('dilutions', next)
  }
  const addDil = () => f('dilutions', [...form.dilutions, { context: '', ratio: '', amount: '', note: '' }])
  const removeDil = (i) => f('dilutions', form.dilutions.filter((_, idx) => idx !== i))

  const handleSave = async () => {
    if (!form.name.trim() || !form.category.trim()) return
    const chem = {
      name: form.name.trim(),
      category: form.category.trim(),
      modes: form.modes,
      usedOn: form.usedOn.trim(),
      shelfLife: form.shelfLife.trim() || null,
      storageNote: form.storageNote.trim() || null,
      tool: form.tool.trim() || null,
      openedDate: null,
      dilutions: form.dilutions.filter(d => d.ratio.trim()).map(d => ({
        context: d.context.trim(),
        ratio: d.ratio.trim(),
        amount: d.amount.trim() || null,
        note: d.note.trim() || null,
      })),
    }
    const ok = await sync(addChemical, chem)
    if (ok && onClose) setTimeout(onClose, 2000)
  }

  const inp = (label, key, opts = {}) => (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>{label}</label>
      <input type={opts.type || 'text'} value={form[key]} onChange={e => f(key, e.target.value)} placeholder={opts.placeholder}
        style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
    </div>
  )

  const canSave = form.name.trim() && form.category.trim() && form.modes.length > 0 && syncStatus?.type !== 'saving'

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--bd2)', padding: 20, marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t1)', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        Add Chemical
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setShowLookup(s => !s)}
            style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '3px 10px', border: '1px solid var(--bd2)', background: showLookup ? '#0066b1' : 'transparent', color: showLookup ? '#fff' : 'var(--t3)', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            <i className="ti ti-search" aria-hidden="true" /> Lookup
          </button>
          {onClose && <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 16 }}>×</button>}
        </div>
      </div>
      {showLookup && <ChemicalLookup onResult={handleLookupResult} />}
      {inp('Product name *', 'name', { placeholder: 'e.g. CarPro HydrO2 Foam' })}
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Category *</label>
        <select value={form.category} onChange={e => f('category', e.target.value)}
          style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>
          <option value="">— Select or type below —</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={form.category} onChange={e => f('category', e.target.value)} placeholder="Or type a new category"
          style={{ width: '100%', marginTop: 6, background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Appears in wash modes</label>
        <div style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 300, marginBottom: 8 }}>Select which washes this chemical is used in. Defaults to both.</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['normal', 'Bi-weekly Wash'], ['maint', 'Deep Clean']].map(([val, lbl]) => {
            const active = form.modes.includes(val)
            return (
              <button key={val} onClick={() => {
                const has = form.modes.includes(val)
                f('modes', has && form.modes.length > 1 ? form.modes.filter(m => m !== val) : [...new Set([...form.modes, val])])
              }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', border: '1px solid', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif', cursor: 'pointer', background: active ? '#0066b1' : 'transparent', color: active ? '#fff' : 'var(--t3)', borderColor: active ? '#0066b1' : 'var(--bd2)' }}>
                <i className={`ti ${active ? 'ti-checkbox' : 'ti-square'}`} style={{ fontSize: 12 }} aria-hidden="true" />
                {lbl}
              </button>
            )
          })}
        </div>
        {form.modes.length === 0 && (
          <div style={{ fontSize: 10, color: '#cc1e1e', marginTop: 6 }}>Select at least one wash mode.</div>
        )}
        {form.modes.length === 2 && (
          <div style={{ fontSize: 10, color: 'var(--iom)', marginTop: 6 }}>✓ Will appear in both washes</div>
        )}
        {form.modes.length === 1 && (
          <div style={{ fontSize: 10, color: '#c8860a', marginTop: 6 }}>Will only appear in {form.modes[0] === 'normal' ? 'Bi-weekly Wash' : 'Deep Clean'}</div>
        )}
      </div>

      {/* Progressive disclosure — details & dilutions */}
      <button onClick={() => setShowDetails(s => !s)} className="detail-toggle">
        <i className={`ti ti-chevron-${showDetails ? 'up' : 'down'}`} style={{ fontSize: 11 }} aria-hidden="true" />
        {showDetails ? 'Hide details' : 'Details & dilutions'}
        {!showDetails && form.dilutions.filter(d => d.ratio.trim()).length > 0 && (
          <span style={{ opacity: 0.6 }}>· {form.dilutions.filter(d => d.ratio.trim()).length} dilution{form.dilutions.filter(d => d.ratio.trim()).length !== 1 ? 's' : ''}</span>
        )}
      </button>

      {showDetails && (
        <>
          {inp('Used on / areas of use', 'usedOn', { placeholder: 'e.g. All painted panels after dry' })}
          {inp('Tool required', 'tool', { placeholder: 'e.g. IK E Foam Pro 2' })}
          {inp('Shelf life', 'shelfLife', { placeholder: 'e.g. 2 years unopened' })}
          {inp('Storage note', 'storageNote', { placeholder: 'e.g. Keep above 40°F' })}

          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t3)', marginBottom: 10, marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--bd)' }}>Dilutions</div>
          {form.dilutions.map((d, i) => (
            <div key={i} style={{ background: 'var(--card2)', border: '1px solid var(--bd)', padding: 12, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Dilution {i + 1}</div>
                {form.dilutions.length > 1 && <button onClick={() => removeDil(i)} style={{ background: 'transparent', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 14 }}>×</button>}
              </div>
              {[['Context', 'context', 'e.g. Foam cannon — per CarPro'], ['Ratio', 'ratio', 'e.g. 400–500:1'], ['Amount', 'amount', 'e.g. 12–15ml per 6L'], ['Note', 'note', 'e.g. Do not exceed 3 min dwell']].map(([lbl, key, ph]) => (
                <div key={key} style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--t3)', display: 'block', marginBottom: 3 }}>{lbl}</label>
                  <input value={d[key]} onChange={e => updateDil(i, key, e.target.value)} placeholder={ph}
                    style={{ width: '100%', background: 'var(--card)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '6px 8px', fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
                </div>
              ))}
            </div>
          ))}
          <button onClick={addDil} style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', background: 'transparent', border: '1px solid var(--bd2)', padding: '5px 12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', marginBottom: 14 }}>
            + Add dilution
          </button>
        </>
      )}

      <SyncStatus status={syncStatus} />
      <div style={{ marginTop: 12 }}>
        <button onClick={handleSave} disabled={!canSave}
          style={{ padding: '8px 20px', background: '#0066b1', color: '#fff', border: 'none', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: canSave ? 'pointer' : 'default', fontFamily: 'Inter, sans-serif', opacity: canSave ? 1 : 0.4 }}>
          Save
        </button>
      </div>
    </div>
  )
}

// Add Tool Form
export function AddToolForm({ data, onClose }) {
  const { syncStatus, sync } = usePlanSync()
  const [form, setForm] = useState({ name: '', category: '', qty: '1', usedFor: '' })

  const categories = [...new Set((data?.tools || []).map(t => t.category))].sort()
  const f = (key, val) => setForm(p => ({ ...p, [key]: val }))

  const handleSave = async () => {
    if (!form.name.trim() || !form.category.trim()) return
    const tool = { name: form.name.trim(), category: form.category.trim(), qty: form.qty.trim() || '1', usedFor: form.usedFor.trim() }
    const ok = await sync(addTool, tool)
    if (ok && onClose) setTimeout(onClose, 2000)
  }

  const canSave = form.name.trim() && form.category.trim() && syncStatus?.type !== 'saving'

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--bd2)', padding: 20, marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t1)', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        Add Tool
        {onClose && <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 16 }}>×</button>}
      </div>
      {[['Tool name *', 'name', 'e.g. Gyeon Bathe Bucket'], ['Qty', 'qty', '1']].map(([lbl, key, ph]) => (
        <div key={key} style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>{lbl}</label>
          <input value={form[key]} onChange={e => f(key, e.target.value)} placeholder={ph}
            style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
        </div>
      ))}
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Category *</label>
        <select value={form.category} onChange={e => f('category', e.target.value)}
          style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>
          <option value="">— Select or type below —</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={form.category} onChange={e => f('category', e.target.value)} placeholder="Or type a new category"
          style={{ width: '100%', marginTop: 6, background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Used for</label>
        <textarea value={form.usedFor} onChange={e => f('usedFor', e.target.value)} placeholder="e.g. Wheels and prewash foam application" rows={2}
          style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif', resize: 'vertical', outline: 'none' }} />
      </div>
      <SyncStatus status={syncStatus} />
      <div style={{ marginTop: 12 }}>
        <button onClick={handleSave} disabled={!canSave}
          style={{ padding: '8px 20px', background: '#0066b1', color: '#fff', border: 'none', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: canSave ? 'pointer' : 'default', fontFamily: 'Inter, sans-serif', opacity: canSave ? 1 : 0.4 }}>
          Save
        </button>
      </div>
    </div>
  )
}

// Add Upgrade Form
export function AddUpgradeForm({ data, onClose }) {
  const { syncStatus, sync } = usePlanSync()
  const existingPhases = sortPhaseNames([...new Set((data?.upgrades?.items || []).map(i => i.phase))])
  const [form, setForm] = useState({ item: '', phase: '', customPhase: '', source: 'Self', notes: '' })
  const f = (key, val) => setForm(p => ({ ...p, [key]: val }))

  const handleSave = async () => {
    const phase = form.phase === '__custom__' ? form.customPhase.trim() : form.phase
    if (!form.item.trim() || !phase) return
    const upgrade = {
      id: 'u' + Date.now(),
      phase,
      item: form.item.trim(),
      source: form.source,
      done: false,
      notes: form.notes.trim(),
    }
    const ok = await sync(addUpgrade, upgrade)
    if (ok && onClose) setTimeout(onClose, 2000)
  }

  const phase = form.phase === '__custom__' ? form.customPhase.trim() : form.phase
  const canSave = form.item.trim() && phase && syncStatus?.type !== 'saving'

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--bd2)', padding: 20, marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t1)', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        Add Upgrade
        {onClose && <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 16 }}>×</button>}
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Phase *</label>
        <select value={form.phase} onChange={e => f('phase', e.target.value)}
          style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>
          <option value="">— Select phase —</option>
          {existingPhases.map(p => <option key={p} value={p}>{p}</option>)}
          <option value="__custom__">New phase…</option>
        </select>
        {form.phase === '__custom__' && (
          <input value={form.customPhase} onChange={e => f('customPhase', e.target.value)} placeholder="New phase name"
            style={{ width: '100%', marginTop: 6, background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
        )}
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Item *</label>
        <input value={form.item} onChange={e => f('item', e.target.value)} placeholder="e.g. Millway Carbon Mirrors"
          style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 6 }}>Source</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {['Self', 'Shop'].map(s => (
            <button key={s} onClick={() => f('source', s)}
              style={{ padding: '5px 14px', border: '1px solid', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif', cursor: 'pointer', background: form.source === s ? (s === 'Self' ? '#0066b1' : '#cc1e1e') : 'transparent', color: form.source === s ? '#fff' : 'var(--t3)', borderColor: form.source === s ? (s === 'Self' ? '#0066b1' : '#cc1e1e') : 'var(--bd2)' }}>
              {s}
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Notes</label>
        <textarea value={form.notes} onChange={e => f('notes', e.target.value)} placeholder="Optional notes" rows={2}
          style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif', resize: 'vertical', outline: 'none' }} />
      </div>
      <SyncStatus status={syncStatus} />
      <div style={{ marginTop: 12 }}>
        <button onClick={handleSave} disabled={!canSave}
          style={{ padding: '8px 20px', background: '#0066b1', color: '#fff', border: 'none', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: canSave ? 'pointer' : 'default', fontFamily: 'Inter, sans-serif', opacity: canSave ? 1 : 0.4 }}>
          Save
        </button>
      </div>
    </div>
  )
}

// ── Edit Chemical Form ────────────────────────────────────────────────────────
export function EditChemicalForm({ chem, onClose }) {
  const { syncStatus, sync } = usePlanSync()
  const [showDetails, setShowDetails] = useState(false)
  const [form, setForm] = useState({
    name: chem.name,
    category: chem.category,
    modes: chem.modes || ['normal', 'maint'],
    usedOn: chem.usedOn || '',
    shelfLife: chem.shelfLife || '',
    storageNote: chem.storageNote || '',
    tool: chem.tool || '',
    dilutions: chem.dilutions?.length ? chem.dilutions : [{ context: '', ratio: '', amount: '', note: '' }],
  })
  const f = (key, val) => setForm(p => ({ ...p, [key]: val }))
  const updateDil = (i, key, val) => f('dilutions', form.dilutions.map((d, idx) => idx === i ? { ...d, [key]: val } : d))
  const addDil = () => f('dilutions', [...form.dilutions, { context: '', ratio: '', amount: '', note: '' }])
  const removeDil = (i) => f('dilutions', form.dilutions.filter((_, idx) => idx !== i))

  const handleSave = async () => {
    if (!form.name.trim() || !form.category.trim() || form.modes.length === 0) return
    const updated = { ...chem, ...form, dilutions: form.dilutions.filter(d => d.ratio.trim()) }
    const ok = await sync(editChemical, updated)
    if (ok && onClose) setTimeout(onClose, 2000)
  }
  const canSave = form.name.trim() && form.category.trim() && form.modes.length > 0 && syncStatus?.type !== 'saving'

  const inp = (label, key, opts = {}) => (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>{label}</label>
      <input type={opts.type || 'text'} value={form[key]} onChange={e => f(key, e.target.value)} placeholder={opts.placeholder}
        style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
    </div>
  )

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--bd2)', padding: 20, marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t1)', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        Edit — {chem.name}
        {onClose && <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 16 }}>×</button>}
      </div>
      {inp('Product name', 'name')}
      {inp('Category', 'category')}
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 6 }}>Wash modes</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['normal', 'Bi-weekly'], ['maint', 'Deep Clean']].map(([val, lbl]) => {
            const active = form.modes.includes(val)
            return (
              <button key={val} onClick={() => f('modes', active && form.modes.length > 1 ? form.modes.filter(m => m !== val) : [...new Set([...form.modes, val])])}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', border: '1px solid', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif', cursor: 'pointer', background: active ? '#0066b1' : 'transparent', color: active ? '#fff' : 'var(--t3)', borderColor: active ? '#0066b1' : 'var(--bd2)' }}>
                <i className={`ti ${active ? 'ti-checkbox' : 'ti-square'}`} style={{ fontSize: 12 }} aria-hidden="true" />{lbl}
              </button>
            )
          })}
        </div>
      </div>

      {/* Progressive disclosure — details & dilutions */}
      <button onClick={() => setShowDetails(s => !s)} className="detail-toggle">
        <i className={`ti ti-chevron-${showDetails ? 'up' : 'down'}`} style={{ fontSize: 11 }} aria-hidden="true" />
        {showDetails ? 'Hide details' : 'Details & dilutions'}
        {!showDetails && (
          <span style={{ opacity: 0.6 }}>· {form.dilutions.filter(d => (d.ratio || '').trim()).length} dilution{form.dilutions.filter(d => (d.ratio || '').trim()).length !== 1 ? 's' : ''}</span>
        )}
      </button>

      {showDetails && (
        <>
          {inp('Used on', 'usedOn')}
          {inp('Tool', 'tool')}
          {inp('Shelf life', 'shelfLife')}
          {inp('Storage note', 'storageNote')}
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t3)', marginBottom: 10, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--bd)' }}>Dilutions</div>
          {form.dilutions.map((d, i) => (
            <div key={i} style={{ background: 'var(--card2)', border: '1px solid var(--bd)', padding: 12, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase' }}>Dilution {i + 1}</div>
                {form.dilutions.length > 1 && <button onClick={() => removeDil(i)} style={{ background: 'transparent', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 14 }}>×</button>}
              </div>
              {[['Context', 'context', ''], ['Ratio', 'ratio', ''], ['Amount', 'amount', ''], ['Note', 'note', '']].map(([lbl, key]) => (
                <div key={key} style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--t3)', display: 'block', marginBottom: 3 }}>{lbl}</label>
                  <input value={d[key] || ''} onChange={e => updateDil(i, key, e.target.value)}
                    style={{ width: '100%', background: 'var(--card)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '6px 8px', fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
                </div>
              ))}
            </div>
          ))}
          <button onClick={addDil} style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', background: 'transparent', border: '1px solid var(--bd2)', padding: '5px 12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', marginBottom: 14 }}>+ Add dilution</button>
        </>
      )}
      <SyncStatus status={syncStatus} />
      <div style={{ marginTop: 12 }}>
        <button onClick={handleSave} disabled={!canSave}
          style={{ padding: '8px 20px', background: '#0066b1', color: '#fff', border: 'none', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: canSave ? 'pointer' : 'default', fontFamily: 'Inter, sans-serif', opacity: canSave ? 1 : 0.4 }}>
          Save changes
        </button>
      </div>
    </div>
  )
}

// ── Edit Tool Form ────────────────────────────────────────────────────────────
export function EditToolForm({ tool, data, onClose }) {
  const { syncStatus, sync } = usePlanSync()
  const [form, setForm] = useState({ name: tool.name, category: tool.category, qty: tool.qty || '1', usedFor: tool.usedFor || '' })
  const f = (key, val) => setForm(p => ({ ...p, [key]: val }))
  const canSave = form.name.trim() && form.category.trim() && syncStatus?.type !== 'saving'
  const categories = [...new Set((data?.tools || []).map(t => t.category))].sort()

  const handleSave = async () => {
    if (!canSave) return
    const ok = await sync(editTool, { ...form }, tool.name)
    if (ok && onClose) setTimeout(onClose, 2000)
  }

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--bd2)', padding: 20, marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t1)', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        Edit — {tool.name}
        {onClose && <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 16 }}>×</button>}
      </div>
      {[['Tool name', 'name'], ['Qty', 'qty']].map(([lbl, key]) => (
        <div key={key} style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>{lbl}</label>
          <input value={form[key]} onChange={e => f(key, e.target.value)}
            style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
        </div>
      ))}
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Category</label>
        <select value={form.category} onChange={e => f('category', e.target.value)}
          style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif', marginBottom: 6 }}>
          <option value="">— Select category —</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={form.category} onChange={e => f('category', e.target.value)} placeholder="Or type a new category"
          style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Used for</label>
        <textarea value={form.usedFor} onChange={e => f('usedFor', e.target.value)} rows={2}
          style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif', resize: 'vertical', outline: 'none' }} />
      </div>
      <SyncStatus status={syncStatus} />
      <div style={{ marginTop: 12 }}>
        <button onClick={handleSave} disabled={!canSave}
          style={{ padding: '8px 20px', background: '#0066b1', color: '#fff', border: 'none', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: canSave ? 'pointer' : 'default', fontFamily: 'Inter, sans-serif', opacity: canSave ? 1 : 0.4 }}>
          Save changes
        </button>
      </div>
    </div>
  )
}

// ── Edit Reminder Form ────────────────────────────────────────────────────────
export function EditReminderForm({ reminder, onClose }) {
  const { syncStatus, sync } = usePlanSync()
  const [form, setForm] = useState({ name: reminder.name, interval: reminder.interval, intervalLabel: reminder.intervalLabel || '', notes: reminder.notes || '' })
  const f = (key, val) => setForm(p => ({ ...p, [key]: val }))
  const canSave = form.name.trim() && form.interval && syncStatus?.type !== 'saving'

  const handleSave = async () => {
    if (!canSave) return
    const updated = { ...reminder, ...form, interval: parseInt(form.interval) }
    const ok = await sync(editReminder, updated)
    if (ok && onClose) setTimeout(onClose, 2000)
  }

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--bd2)', padding: 20, marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t1)', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        Edit — {reminder.name}
        {onClose && <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 16 }}>×</button>}
      </div>
      {[['Name', 'name', 'text', ''], ['Interval (days)', 'interval', 'number', ''], ['Interval label', 'intervalLabel', 'text', 'e.g. Every 3 weeks']].map(([lbl, key, type, ph]) => (
        <div key={key} style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>{lbl}</label>
          <input type={type} value={form[key]} onChange={e => f(key, e.target.value)} placeholder={ph}
            style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
        </div>
      ))}
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Notes</label>
        <textarea value={form.notes} onChange={e => f('notes', e.target.value)} rows={2}
          style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif', resize: 'vertical', outline: 'none' }} />
      </div>
      <SyncStatus status={syncStatus} />
      <div style={{ marginTop: 12 }}>
        <button onClick={handleSave} disabled={!canSave}
          style={{ padding: '8px 20px', background: '#0066b1', color: '#fff', border: 'none', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: canSave ? 'pointer' : 'default', fontFamily: 'Inter, sans-serif', opacity: canSave ? 1 : 0.4 }}>
          Save changes
        </button>
      </div>
    </div>
  )
}
