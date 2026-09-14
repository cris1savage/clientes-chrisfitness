'use client';

import { useState, useMemo } from 'react';
import { Info, RotateCcw, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  phaseForDate, phaseColor, todayISO, mondayOf, fmtDate,
  generateWeeks, recalcFrom,
} from '@/lib/timeline';

export default function TimelineClient({ clienteId, phases, initialWeeks, initialCheckins }) {
  const supabase        = useMemo(() => createClient(), []);
  const [weeks, setWeeks] = useState(initialWeeks);

  const today          = todayISO();
  const currentWeekStart = mondayOf(today);

  const ensureWeeks = async () => {
    if (phases.length === 0) return;
    const startWeight = initialCheckins.find((c) => c.weight != null)?.weight || 80;
    const generated   = generateWeeks(phases, phases[0].start_date, 52, startWeight);
    const { data } = await supabase
      .from('client_timeline_weeks')
      .upsert(
        generated.map((w) => ({ active_client_id: clienteId, ...w })),
        { onConflict: 'active_client_id,week_start', ignoreDuplicates: true }
      )
      .select();
    if (data) setWeeks((prev) => {
      const map = Object.fromEntries(prev.map((w) => [w.week_start, w]));
      data.forEach((w) => { if (!map[w.week_start]) map[w.week_start] = w; });
      return Object.values(map).sort((a, b) => a.week_start.localeCompare(b.week_start));
    });
  };

  const editWeekTarget = async (idx, value) => {
    const v = Number(value);
    if (Number.isNaN(v)) return;
    const updated = recalcFrom(weeks, phases, idx, v);
    setWeeks((w) => w.map((row, i) => i >= idx ? updated[i - idx] : row));
    await supabase.from('client_timeline_weeks').upsert(
      updated.map((w) => ({ active_client_id: clienteId, ...w, updated_at: new Date().toISOString() })),
      { onConflict: 'active_client_id,week_start' }
    );
  };

  const editWeekField = async (id, patch) => {
    setWeeks((w) => w.map((row) => row.id === id ? { ...row, ...patch } : row));
    await supabase.from('client_timeline_weeks').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  };

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="rounded-xl px-4 py-3 flex items-start gap-2.5 text-sm"
        style={{ background: '#5ECCFA10', border: '1px solid #5ECCFA28' }}>
        <Info size={14} className="text-cyan shrink-0 mt-0.5" />
        <span className="text-muted leading-relaxed text-xs">
          El ritmo de cada semana viene de la fase a la que pertenece (ajústalo en Resumen).
          Edita el Objetivo de cualquier semana y recalcula hacia adelante automáticamente.
        </span>
      </div>

      {/* Acciones */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {weeks.length === 0 && phases.length > 0 && (
          <button onClick={ensureWeeks}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold"
            style={{ background: 'var(--color-violet)', color: '#0D0A1F' }}>
            <Plus size={14} /> Generar 52 semanas
          </button>
        )}
        {phases.length === 0 && (
          <div className="text-muted text-xs">Añade fases en Resumen primero para generar el timeline.</div>
        )}
        {weeks.length > 0 && (
          <button onClick={ensureWeeks}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-muted ml-auto"
            style={{ border: '1px solid var(--color-border)' }}>
            <RotateCcw size={12} /> Reiniciar cadena
          </button>
        )}
      </div>

      {/* Tabla */}
      {weeks.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
          {/* Cabecera */}
          <div className="grid px-4 py-2.5 text-muted text-[10px] uppercase tracking-widest"
            style={{
              background: 'var(--color-surfaceAlt)',
              gridTemplateColumns: '36px 88px 112px 72px 72px 88px 88px 52px',
            }}>
            <div>Sem.</div>
            <div>Fecha</div>
            <div>Fase</div>
            <div>Kcal ON</div>
            <div>Kcal OFF</div>
            <div>Objetivo</div>
            <div>Real</div>
            <div></div>
          </div>

          {/* Filas */}
          {weeks.map((w, idx) => {
            const ph   = phaseForDate(phases, w.week_start);
            const diff = w.real_weight != null
              ? Math.round((w.real_weight - w.target_weight) * 10) / 10
              : null;
            const isThisWeek = w.week_start === currentWeekStart;
            const kcalOnVal  = w.kcal_on ?? w.kcal ?? '';
            const kcalOffVal = w.kcal_off ?? '';

            return (
              <div key={w.id}
                className="grid px-4 py-2 items-center"
                style={{
                  gridTemplateColumns: '36px 88px 112px 72px 72px 88px 88px 52px',
                  background:   isThisWeek ? '#5ECCFA08' : idx % 2 === 0 ? 'var(--color-bg)' : 'var(--color-surface)',
                  borderTop:    '1px solid var(--color-border)',
                  borderLeft:   `2px solid ${isThisWeek ? 'var(--color-cyan)' : 'transparent'}`,
                }}>
                <span className="text-muted text-xs">{idx + 1}</span>
                <span className="text-ink text-xs">{fmtDate(w.week_start)}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md w-fit"
                  style={{
                    background: ph ? `${phaseColor(phases, ph.name)}18` : 'transparent',
                    color:      ph ? phaseColor(phases, ph.name) : 'var(--color-muted)',
                  }}>
                  {ph?.name || '—'}
                </span>
                <input type="number" value={kcalOnVal} placeholder="—"
                  onChange={(e) => editWeekField(w.id, { kcal_on: e.target.value ? Number(e.target.value) : null, kcal: e.target.value ? Number(e.target.value) : null })}
                  className="bg-surface border border-border text-green rounded-lg px-2 py-1 text-xs w-14 outline-none focus:border-green" />
                <input type="number" value={kcalOffVal} placeholder="—"
                  onChange={(e) => editWeekField(w.id, { kcal_off: e.target.value ? Number(e.target.value) : null })}
                  className="bg-surface border border-border text-amber rounded-lg px-2 py-1 text-xs w-14 outline-none focus:border-amber" />
                <input type="number" step="0.1" value={w.target_weight ?? ''}
                  onChange={(e) => editWeekTarget(idx, e.target.value)}
                  className="rounded-lg px-2 py-1 text-xs w-16 outline-none font-semibold text-ink"
                  style={{
                    background:  w.target_overridden ? '#FBBF2412' : 'var(--color-surface)',
                    border:      `1px solid ${w.target_overridden ? 'var(--color-amber)' : 'var(--color-border)'}`,
                  }} />
                <input type="number" step="0.1" value={w.real_weight ?? ''} placeholder="—"
                  onChange={(e) => editWeekField(w.id, { real_weight: e.target.value === '' ? null : Number(e.target.value) })}
                  className="bg-surface border border-border text-ink rounded-lg px-2 py-1 text-xs w-16 outline-none focus:border-cyan" />
                <span className="text-xs font-bold text-right"
                  style={{ color: diff == null ? 'var(--color-muted)' : diff <= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                  {diff != null ? `${diff > 0 ? '+' : ''}${diff}` : '—'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
