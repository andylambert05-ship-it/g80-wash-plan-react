import { useState, useEffect } from 'react'
import TabFactoryParts from './TabFactoryParts'
import { getConfig, toggleUpgradeDone, bulkSetUpgradesDone } from '../utils/GitHubSync'

const PHOTO_KEY = 'gwp_upgrade_photos'

function loadPhotos() {
  try { return JSON.parse(localStorage.getItem(PHOTO_KEY) || '{}') } catch { return {} }
}
function savePhotos(photos) {
  try { localStorage.setItem(PHOTO_KEY, JSON.stringify(photos)) } catch {}
}

function loadCustomUpgrades() {
  try { return JSON.parse(localStorage.getItem('gwp_custom_upgrades') || '[]') } catch { return [] }
}
function saveCustomUpgrades(items) {
  try { localStorage.setItem('gwp_custom_upgrades', JSON.stringify(items)) } catch {}
}

const SOURCE_COLORS = { Self: '#0066b1', Shop: '#cc1e1e' }
const SOURCE_BG = { Self: '#0d1a2e', Shop: '#1a0000' }
const SOURCE_BD = { Self: '#0d2040', Shop: '#2a0000' }

export default function TabUpgrades({ data }) {
  const [section, setSection] = useState(() => localStorage.getItem('gwp_upgrades_section') || 'mods')
  // Optimistic local overrides for instant UI: { id: true/false }
  // Cleared when the page re-fetches fresh JSON.
  const [doneOverrides, setDoneOverrides] = useState({})
  const [syncing, setSyncing] = useState({}) // { id: true } while a toggle is in-flight
  const [syncErrors, setSyncErrors] = useState({}) // { id: errorMessage } if a sync fails
  const [photos, setPhotos] = useState(loadPhotos)
  const [lightbox, setLightbox] = useState(null) // { src, label }
  const [custom, setCustom] = useState(loadCustomUpgrades)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ phase: '', customPhase: '', item: '', source: 'Self', notes: '' })

  // On mount (and whenever data changes), push any local-only completion state
  // up to GitHub. This catches up devices where sync failed previously, and
  // handles the migration from the old localStorage-only behaviour.
  useEffect(() => {
    if (!data?.upgrades?.items) return
    let cache
    try { cache = JSON.parse(localStorage.getItem('gwp_upgrades') || '{}') } catch { cache = {} }
    if (!cache || Object.keys(cache).length === 0) return

    const config = getConfig()
    if (!config.token) return

    const diff = {}
    const matchedIds = []
    for (const item of data.upgrades.items) {
      if (item.id in cache) {
        matchedIds.push(item.id)
        if (!!cache[item.id] !== !!item.done) diff[item.id] = !!cache[item.id]
      }
    }
    if (Object.keys(diff).length === 0) {
      // JSON already reflects all cached entries — clean them out
      if (matchedIds.length) {
        const next = { ...cache }
        matchedIds.forEach(id => delete next[id])
        localStorage.setItem('gwp_upgrades', JSON.stringify(next))
      }
      return
    }
    bulkSetUpgradesDone(config, diff)
      .then(() => {
        // Clear pushed entries from local cache
        try {
          const fresh = JSON.parse(localStorage.getItem('gwp_upgrades') || '{}')
          Object.keys(diff).forEach(id => delete fresh[id])
          localStorage.setItem('gwp_upgrades', JSON.stringify(fresh))
        } catch {}
      })
      .catch(e => {
        console.warn('Bulk upgrade sync failed:', e)
        // Surface on each affected item so the user sees something is wrong
        setSyncErrors(prev => {
          const next = { ...prev }
          Object.keys(diff).forEach(id => { next[id] = e.message || 'Sync failed' })
          return next
        })
      })
  }, [data])

  if (!data.upgrades) return (
    <div className="panel">
      <div className="notice info">
        <i className="ti ti-info-circle" aria-hidden="true" />
        <span>Upgrades data not found in wash-plan.json.</span>
      </div>
    </div>
  )

  const baseItems = data.upgrades.items || []
  const allItems = [...baseItems, ...custom]

  // Effective done state: optimistic override wins, then localStorage cache, then the JSON
  const isItemDone = (item) => {
    if (item.id in doneOverrides) return doneOverrides[item.id]
    // localStorage cache survives reload until JSON catches up
    try {
      const cache = JSON.parse(localStorage.getItem('gwp_upgrades') || '{}')
      if (item.id in cache) return !!cache[item.id]
    } catch {}
    return !!item.done
  }

  const persistLocal = (id, done) => {
    try {
      const cache = JSON.parse(localStorage.getItem('gwp_upgrades') || '{}')
      cache[id] = done
      localStorage.setItem('gwp_upgrades', JSON.stringify(cache))
    } catch {}
  }
  const clearLocal = (id) => {
    try {
      const cache = JSON.parse(localStorage.getItem('gwp_upgrades') || '{}')
      delete cache[id]
      localStorage.setItem('gwp_upgrades', JSON.stringify(cache))
    } catch {}
  }

  const toggle = async (id) => {
    const item = allItems.find(i => i.id === id)
    if (!item) return
    if (item.custom) {
      // Custom items still live in localStorage — flip in place
      const next = custom.map(c => c.id === id ? { ...c, done: !c.done } : c)
      setCustom(next); saveCustomUpgrades(next)
      try { navigator.vibrate && navigator.vibrate(20) } catch (e) {}
      return
    }
    // Synced items: optimistic flip + persistent local cache + GitHub write
    const newDone = !isItemDone(item)
    setDoneOverrides(d => ({ ...d, [id]: newDone }))
    persistLocal(id, newDone)
    setSyncErrors(e => { const n = { ...e }; delete n[id]; return n })
    try { navigator.vibrate && navigator.vibrate(20) } catch (e) {}

    const config = getConfig()
    if (!config.token) {
      setSyncErrors(e => ({ ...e, [id]: 'No GitHub token — open Settings to enable sync' }))
      return
    }
    setSyncing(s => ({ ...s, [id]: true }))
    try {
      await toggleUpgradeDone(config, id)
      // Sync succeeded — local cache no longer needed for this item; JSON will reflect it on next fetch
      clearLocal(id)
    } catch (e) {
      // Don't revert the visual state — keep what the user tapped. Surface the error.
      setSyncErrors(err => ({ ...err, [id]: e.message || 'Sync failed' }))
      console.warn('Upgrade sync failed:', e)
    } finally {
      setSyncing(s => { const n = { ...s }; delete n[id]; return n })
    }
  }

  const addItem = () => {
    const phase = form.phase === '__custom__' ? form.customPhase.trim() : form.phase
    if (!form.item.trim() || !phase) return
    const newItem = {
      id: 'custom-' + Date.now(),
      phase,
      item: form.item.trim(),
      source: form.source,
      notes: form.notes.trim(),
      custom: true
    }
    const next = [...custom, newItem]
    setCustom(next)
    saveCustomUpgrades(next)
    setForm({ phase: '', customPhase: '', item: '', source: 'Self', notes: '' })
    setShowForm(false)
  }

  const removeCustom = (id) => {
    const next = custom.filter(c => c.id !== id)
    setCustom(next)
    saveCustomUpgrades(next)
  }

  const addPhoto = (id, label) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment' // prefer rear camera on mobile
    input.onchange = (e) => {
      const file = e.target.files[0]
      if (!file) return
      // Resize + compress to keep localStorage usage reasonable (~150KB per photo)
      const reader = new FileReader()
      reader.onload = (ev) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const MAX = 800
          const ratio = Math.min(MAX / img.width, MAX / img.height, 1)
          canvas.width = Math.round(img.width * ratio)
          canvas.height = Math.round(img.height * ratio)
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.75)
          const next = { ...photos, [id]: [...(photos[id] || []), { src: dataUrl, label, date: new Date().toISOString() }] }
          setPhotos(next)
          savePhotos(next)
        }
        img.src = ev.target.result
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  const removePhoto = (id, idx) => {
    const next = { ...photos, [id]: photos[id].filter((_, i) => i !== idx) }
    if (next[id].length === 0) delete next[id]
    setPhotos(next)
    savePhotos(next)
  }

  // Group by phase preserving order
  const phaseOrder = []
  const phases = {}
  allItems.forEach(item => {
    if (!phases[item.phase]) { phases[item.phase] = []; phaseOrder.push(item.phase) }
    phases[item.phase].push(item)
  })

  const totalDone = allItems.filter(i => isItemDone(i)).length
  const total = allItems.length
  const pct = total > 0 ? Math.round((totalDone / total) * 100) : 0
  const existingPhases = [...new Set(baseItems.map(i => i.phase))]
  const canSubmit = form.item.trim() && (form.phase !== '' && form.phase !== '__custom__' || form.customPhase.trim())

  return (
    <div className="panel">
      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <img src={lightbox.src} alt={lightbox.label} style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', border: '1px solid var(--bd2)' }} />
          <div style={{ marginTop: 12, fontSize: 11, color: '#aaa', fontWeight: 300 }}>{lightbox.label} &nbsp;·&nbsp; Tap to close</div>
        </div>
      )}
      {/* Section toggle: Modifications vs OEM+ factory parts */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--card)', border: '1px solid var(--bd)', padding: 3, marginBottom: 14 }}>
        {[
          { id: 'mods', label: 'Modifications', icon: 'ti-tools' },
          { id: 'oem', label: 'OEM+ Parts', icon: 'ti-archive' },
        ].map(s => {
          const active = section === s.id
          return (
            <button
              key={s.id}
              onClick={() => {
                try { navigator.vibrate && navigator.vibrate(8) } catch (e) {}
                setSection(s.id)
                localStorage.setItem('gwp_upgrades_section', s.id)
              }}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '8px 10px', border: 'none', cursor: 'pointer',
                background: active ? '#0066b1' : 'transparent',
                color: active ? '#fff' : 'var(--t3)',
                fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
              }}
            >
              <i className={`ti ${s.icon}`} style={{ fontSize: 12 }} aria-hidden="true" />
              {s.label}
            </button>
          )
        })}
      </div>

      {section === 'oem' ? (
        <TabFactoryParts data={data} />
      ) : (
      <>
      <div className="notice info" style={{ borderLeftColor: '#0066b1' }}>
        <i className="ti ti-car" aria-hidden="true" />
        <span>{data.upgrades.note}</span>
      </div>

      <div className="prog-wrap">
        <div className="prog-meta">
          <span className="prog-lbl">Progress</span>
          <span className="prog-ct">{totalDone} / {total}</span>
        </div>
        <div className="prog-track">
          <div className="prog-bar" style={{ width: `${pct}%`, background: '#0066b1' }} />
        </div>
      </div>

      <button className="rbtn" onClick={() => setShowForm(s => !s)} style={{ marginBottom: 16 }}>
        <i className="ti ti-plus" aria-hidden="true" /> {showForm ? 'Cancel' : 'Add upgrade'}
      </button>

      {showForm && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--bd2)', padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t3)', marginBottom: 12 }}>New Upgrade</div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Phase</label>
            <select
              value={form.phase}
              onChange={e => setForm(f => ({ ...f, phase: e.target.value }))}
              style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif' }}
            >
              <option value="">— Select phase —</option>
              {existingPhases.map(p => <option key={p} value={p}>{p}</option>)}
              <option value="__custom__">New phase...</option>
            </select>
            {form.phase === '__custom__' && (
              <input
                value={form.customPhase}
                onChange={e => setForm(f => ({ ...f, customPhase: e.target.value }))}
                placeholder="New phase name"
                style={{ width: '100%', marginTop: 6, background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif' }}
              />
            )}
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Item *</label>
            <input
              value={form.item}
              onChange={e => setForm(f => ({ ...f, item: e.target.value }))}
              placeholder="Upgrade item name"
              style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif' }}
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Source</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['Self', 'Shop'].map(s => (
                <button key={s} onClick={() => setForm(f => ({ ...f, source: s }))}
                  style={{ padding: '5px 14px', border: '1px solid', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif', cursor: 'pointer', background: form.source === s ? SOURCE_COLORS[s] : 'transparent', color: form.source === s ? '#fff' : 'var(--t3)', borderColor: form.source === s ? SOURCE_COLORS[s] : 'var(--bd2)' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Optional notes"
              rows={2}
              style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif', resize: 'vertical' }}
            />
          </div>

          <button onClick={addItem} disabled={!canSubmit}
            style={{ background: '#0066b1', color: '#fff', border: 'none', padding: '8px 18px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: canSubmit ? 'pointer' : 'not-allowed', fontFamily: 'Inter, sans-serif', opacity: canSubmit ? 1 : 0.4 }}>
            Add Item
          </button>
        </div>
      )}

      {phaseOrder.map(phase => {
        const items = phases[phase]
        const phaseDone = items.filter(i => isItemDone(i)).length
        return (
          <div key={phase} style={{ marginBottom: 20 }}>
            <div className="phase-hdr" style={{ borderLeftColor: '#0066b1', color: '#ffffff', fontSize: 13 }}>
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#ffffff', flexShrink: 0 }} />
              {phase}
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', marginLeft: 4 }}>({phaseDone}/{items.length})</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {items.map(item => {
                const isDone = isItemDone(item)
                const isSyncing = !!syncing[item.id]
                const syncErr = syncErrors[item.id]
                return (
                  <div key={item.id} onClick={() => toggle(item.id)}
                    style={{ background: 'var(--card)', border: `1px solid ${syncErr ? '#5a1a1a' : 'var(--bd)'}`, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', opacity: isDone ? 0.4 : 1, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 1, background: syncErr ? '#cc1e1e' : '#0066b1' }} />
                    <div style={{ width: 20, height: 20, border: `1px solid ${isDone ? '#0066b1' : 'var(--bd2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: isDone ? '#0066b1' : 'transparent', marginTop: 1 }}>
                      {isSyncing
                        ? <i className="ti ti-loader-2" style={{ fontSize: 11, color: isDone ? '#fff' : '#0066b1', animation: 'spin 0.8s linear infinite' }} aria-hidden="true" />
                        : isDone && <i className="ti ti-check" style={{ fontSize: 11, color: '#fff' }} aria-hidden="true" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t1)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {item.item}
                        <span style={{ fontSize: 9, padding: '2px 7px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: SOURCE_BG[item.source] || 'var(--card2)', color: SOURCE_COLORS[item.source] || 'var(--t3)', border: `1px solid ${SOURCE_BD[item.source] || 'var(--bd2)'}` }}>
                          {item.source}
                        </span>
                        {item.custom && (
                          <span style={{ fontSize: 9, padding: '2px 7px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: 'var(--card2)', color: 'var(--t3)', border: '1px solid var(--bd2)' }}>Custom</span>
                        )}
                        {syncErr && (
                          <span title={syncErr} style={{ fontSize: 9, padding: '2px 7px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: '#1a0000', color: '#cc1e1e', border: '1px solid #5a1a1a', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <i className="ti ti-alert-triangle" style={{ fontSize: 10 }} aria-hidden="true" />
                            Not synced
                          </span>
                        )}
                      </div>
                      {syncErr && (
                        <div style={{ fontSize: 11, color: '#cc1e1e', lineHeight: 1.4, fontWeight: 400, marginBottom: 4 }}>
                          Sync error: {syncErr}
                        </div>
                      )}
                      {item.notes && <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.6, fontWeight: 300 }}>{item.notes}</div>}
                      {/* Photo thumbnails */}
                      {photos[item.id] && photos[item.id].length > 0 && (
                        <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                          {photos[item.id].map((p, idx) => (
                            <div key={idx} style={{ position: 'relative' }}>
                              <img src={p.src} alt={p.label} onClick={() => setLightbox(p)}
                                style={{ width: 56, height: 56, objectFit: 'cover', cursor: 'pointer', border: '1px solid var(--bd2)' }} />
                              <button onClick={e => { e.stopPropagation(); removePhoto(item.id, idx) }}
                                style={{ position: 'absolute', top: -6, right: -6, width: 16, height: 16, borderRadius: '50%', background: '#cc1e1e', border: 'none', color: '#fff', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                            </div>
                          ))}
                          <button onClick={e => { e.stopPropagation(); addPhoto(item.id, item.item) }}
                            style={{ width: 56, height: 56, border: '1px dashed var(--bd2)', background: 'transparent', color: 'var(--t3)', cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Add photo">+</button>
                        </div>
                      )}
                      {/* Add first photo button — only on undone items with no photos */}
                      {(!photos[item.id] || photos[item.id].length === 0) && (
                        <div onClick={e => e.stopPropagation()} style={{ marginTop: 6 }}>
                          <button onClick={() => addPhoto(item.id, item.item)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', background: 'transparent', border: '1px solid var(--bd2)', padding: '3px 8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                            <i className="ti ti-camera" style={{ fontSize: 11 }} aria-hidden="true" /> Add photo
                          </button>
                        </div>
                      )}
                    </div>
                    {item.custom && (
                      <button onClick={e => { e.stopPropagation(); removeCustom(item.id) }}
                        style={{ background: 'transparent', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 14, padding: '0 4px', flexShrink: 0 }}>
                        ×
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
      </>
      )}
    </div>
  )
}
