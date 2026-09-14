'use client';

import { useState, useMemo } from 'react';
import { Info, RotateCcw, Plus, Save, Check, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  phaseForDate, phaseColor, todayISO, mondayOf,
  generateWeeks, recalcFrom,
} from '@/lib/timeline';

export default function TimelineClient({ clienteId, phases, initialWeeks, initialCheckins }) {
  const supabase = useMemo(() => createClient(), []);

  // Estado local — editable sin guardar hasta pulsar el botón
  const [weeks,   setWeeks]   = useState(initialWeeks);
  const [draft,   setDraft]   = useState(initialWeeks); // borrador local
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [dirty,   setDirty]   = useState(false); // hay cambios sin guardar

  const today            = todayISO();
  const currentWeekStart = mondayOf(today);

  // Generar/reiniciar semanas
  const ensureWeeks = async () => {
    if (phases.length === 0) return;
    const startWeight = initialCheckins.find((c) => c.weight != null)?.weight || 80;
    const generated   = generateWeeks(phases, phases[0].start_date, 52, startWeight);
    const { data } = await supabase
      .from('tracking_timeline_weeks')
      .upsert(
        generated.map((w) => ({ tracking_client_id: clienteId, ...w })),
        { onConflict: 'tracking_client_id,week_start', ignoreDuplicates: true }
      )
      .select();
    if (data) {
      const merged = (() => {
        const map = Object.fromEntries(weeks.map((w) => [w.week_start, w]));
        data.forEach((w) => { if (!map[w.week_start]) map[w.week_start] = w; });
        return Object.values(map).sort((a, b) => a.week_start.localeCompare(b.week_start));
      })();
      setWeeks(merged);
      setDraft(merged);
      setDirty(false);
    }
  };

  // Editar objetivo — recalcula en el borrador local, NO guarda
  const editWeekTarget = (idx, value) => {
    const v = Number(value);
    if (Number.isNaN(v) || value === '') {
      setDraft((d) => d.map((row, i) => i === idx ? { ...row, target_weight: value === '' ? null : row.target_weight } : row));
      setDirty(true);
      return;
    }
    const updated = recalcFrom(draft, phases, idx, v);
    setDraft((d) => d.map((row, i) => i >= idx ? updated[i - idx] : row));
    setDirty(true);
  };

  // Editar kcal o peso real — solo en borrador
  const editWeekField = (weekStart, patch) => {
    setDraft((d) => d.map((row) => row.week_start === weekStart ? { ...row, ...patch } : row));
    setDirty(true);
  };

  // Guardar todo de golpe
  const saveAll = async () => {
    setSaving(true);
    await supabase.from('tracking_timeline_weeks').upsert(
      draft.map((w) => ({ tracking_client_id: clienteId, ...w, updated_at: new Date().toISOString() })),
      { onConflict: 'tracking_client_id,week_start' }
    );
    setWeeks(draft);
    setSaving(false);
    setSaved(true);
    setDirty(false);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-4">

      {/* Info banner */}
      <div className="rounded-xl px-4 py-3 flex items-start gap-2.5"
        style={{ background: '#5ECCFA10', border: '1px solid #5ECCFA28' }}>
        <Info size={14} className="text-cyan shrink-0 mt-0.5" />
        <span className="text-muted leading-relaxed text-xs">
          Edita los valores y pulsa <strong className="text-cyan">Guardar cambios</strong> cuando termines.
          El objetivo se recalcula automáticamente hacia adelante desde la semana que edites.
        </span>
      </div>

      {/* Aviso semanas con día incorrecto */}
      {draft.length > 0 && (() => {
        const d = new Date(draft[0].week_start + 'T12:00:00Z');
        const isMonday = (d.getUTCDay() + 6) % 7 === 0;
        if (isMonday) return null;
        return (
          <div className="rounded-xl px-4 py-3 flex items-center gap-2.5"
            style={{ background: '#FBBF2410', border: '1px solid #FBBF2430' }}>
            <span className="text-amber text-xs">⚠️ Las fechas no empiezan en lunes. Pulsa <strong>Reiniciar cadena</strong> para corregirlo.</span>
          </div>
        );
      })()}

      {/* Acciones */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2">
          {draft.length === 0 && phases.length > 0 && (
            <button onClick={ensureWeeks}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold"
              style={{ background: 'var(--color-violet)', color: '#0D0A1F' }}>
              <Plus size={14} /> Generar 52 semanas
            </button>
          )}
          {phases.length === 0 && (
            <div className="text-muted text-xs">Añade fases primero para generar el timeline.</div>
          )}
          {draft.length > 0 && (
            <button onClick={ensureWeeks}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-muted"
              style={{ border: '1px solid var(--color-border)' }}>
              <RotateCcw size={12} /> Reiniciar cadena
            </button>
          )}
        </div>

        {/* Botón guardar */}
        {draft.length > 0 && (
          <button onClick={saveAll} disabled={saving || !dirty}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-40"
            style={{
              background: saved ? '#4ADE8018' : dirty ? 'var(--color-violet)' : 'var(--color-surfaceAlt)',
              color:      saved ? 'var(--color-green)' : dirty ? '#0D0A1F' : 'var(--color-muted)',
              border:     saved ? '1px solid var(--color-green)' : 'none',
            }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Save size={14} />}
            {saving ? 'Guardando…' : saved ? 'Guardado' : dirty ? 'Guardar cambios' : 'Sin cambios'}
          </button>
        )}
      </div>

      {/* Tabla */}
      {draft.length > 0 && (
        <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid var(--color-border)' }}>
          <div className="grid px-4 py-3 text-muted text-[10px] uppercase tracking-widest"
            style={{
              background: 'var(--color-surfaceAlt)',
              gridTemplateColumns: '44px 110px 140px 100px 100px 110px 110px 64px',
              minWidth: 800,
            }}>
            <div>Sem.</div>
            <div>Lunes</div>
            <div>Fase</div>
            <div>Kcal ON</div>
            <div>Kcal OFF</div>
            <div>Objetivo</div>
            <div>Real</div>
            <div>Dif.</div>
          </div>

          {draft.map((w, idx) => {
            const ph          = phaseForDate(phases, w.week_start);
            const diff        = w.real_weight != null && w.target_weight != null
              ? Math.round((w.real_weight - w.target_weight) * 10) / 10
              : null;
            const isThisWeek  = w.week_start === currentWeekStart;
            const kcalOnVal   = w.kcal_on ?? w.kcal ?? '';
            const kcalOffVal  = w.kcal_off ?? '';

            // Lunes real en UTC
            const mondayLabel = (() => {
              const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
              const d = new Date(w.week_start + 'T12:00:00Z');
              const dow = d.getUTCDay();
              const diff2 = dow === 0 ? 6 : dow - 1;
              d.setUTCDate(d.getUTCDate() - diff2);
              return `Lun ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
            })();

            return (
              <div key={w.week_start}
                className="grid px-4 py-3 items-center"
                style={{
                  gridTemplateColumns: '44px 110px 140px 100px 100px 110px 110px 64px',
                  minWidth: 800,
                  background:   isThisWeek ? '#5ECCFA08' : idx % 2 === 0 ? 'var(--color-bg)' : 'var(--color-surface)',
                  borderTop:    '1px solid var(--color-border)',
                  borderLeft:   `3px solid ${isThisWeek ? 'var(--color-cyan)' : 'transparent'}`,
                }}>
                <span className="text-muted text-xs font-semibold">{idx + 1}</span>
                <span className="text-xs" style={{ color: isThisWeek ? 'var(--color-cyan)' : 'var(--color-ink)' }}>
                  {mondayLabel}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md w-fit"
                  style={{
                    background: ph ? `${phaseColor(phases, ph.name)}18` : 'transparent',
                    color:      ph ? phaseColor(phases, ph.name) : 'var(--color-muted)',
                  }}>
                  {ph?.name || '—'}
                </span>

                <input type="number" value={kcalOnVal} placeholder="—"
                  onChange={(e) => editWeekField(w.week_start, { kcal_on: e.target.value ? Number(e.target.value) : null, kcal: e.target.value ? Number(e.target.value) : null })}
                  className="bg-surface border border-border text-green rounded-lg px-2.5 py-1.5 text-sm w-20 outline-none focus:border-green" />

                <input type="number" value={kcalOffVal} placeholder="—"
                  onChange={(e) => editWeekField(w.week_start, { kcal_off: e.target.value ? Number(e.target.value) : null })}
                  className="bg-surface border border-border text-amber rounded-lg px-2.5 py-1.5 text-sm w-20 outline-none focus:border-amber" />

                <input type="number" step="0.1" value={w.target_weight ?? ''} placeholder="—"
                  onChange={(e) => editWeekTarget(idx, e.target.value)}
                  className="rounded-lg px-2.5 py-1.5 text-sm w-20 outline-none font-semibold text-ink"
                  style={{
                    background: w.target_overridden ? '#FBBF2412' : 'var(--color-surface)',
                    border:     `1px solid ${w.target_overridden ? 'var(--color-amber)' : 'var(--color-border)'}`,
                  }} />

                <input type="number" step="0.1" value={w.real_weight ?? ''} placeholder="—"
                  onChange={(e) => editWeekField(w.week_start, { real_weight: e.target.value === '' ? null : Number(e.target.value) })}
                  className="bg-surface border border-border text-ink rounded-lg px-2.5 py-1.5 text-sm w-20 outline-none focus:border-cyan" />

                <span className="text-sm font-bold text-right pl-2"
                  style={{ color: diff == null ? 'var(--color-muted)' : diff <= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                  {diff != null ? `${diff > 0 ? '+' : ''}${diff}` : '—'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Aviso cambios sin guardar */}
      {dirty && (
        <div className="text-amber text-xs text-center">
          ⚠️ Tienes cambios sin guardar — pulsa <strong>Guardar cambios</strong> arriba
        </div>
      )}
    </div>
  );
}
