'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Video, Check, X, FileDown, Loader2, Trash2, Ruler, Dumbbell, Apple, Clock, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Card from '@/components/Card';
import {
  phaseForDate, phaseColor, PHASE_NAMES, todayISO, defaultWeeklyNotes,
  MEASUREMENTS, WEEK_STRENGTHS, STRENGTH_COLOR, GOAL_STATUSES, GOAL_COLORS, monthLabelFull,
} from '@/lib/timeline';
import { downloadCheckinPDF } from '@/lib/pdf';

export default function MesClient({ clienteId, clienteName, phases, initialCheckins }) {
  const supabase = useMemo(() => createClient(), []);
  const router   = useRouter();
  const [checkins,          setCheckins]          = useState(initialCheckins);
  const [measurementsDraft, setMeasurementsDraft] = useState(null);
  const [measurementsSaved, setMeasurementsSaved] = useState(false);
  const [exportingId,       setExportingId]       = useState(null);
  const [autoExported,      setAutoExported]       = useState(false);

  const currentMonth  = todayISO().slice(0, 7);
  const hasCurrentMonth = checkins.some((c) => c.month === currentMonth);
  const currentCheckin  = checkins.find((c) => c.month === currentMonth);

  useEffect(() => { setMeasurementsDraft(null); setMeasurementsSaved(false); }, [currentCheckin?.id]);

  const addMonth = async () => {
    const phase = phaseForDate(phases, todayISO())?.name || null;
    const { data } = await supabase.from('client_checkins').insert({
      active_client_id: clienteId,
      month: currentMonth,
      phase,
      weekly_notes: defaultWeeklyNotes(currentMonth),
    }).select().single();
    if (data) { setCheckins((cs) => [data, ...cs]); router.refresh(); }
  };

  const updateCheckin = async (id, patch) => {
    setCheckins((cs) => cs.map((c) => c.id === id ? { ...c, ...patch } : c));
    await supabase.from('client_checkins').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  };

  const updateWeekNote = (checkin, idx, patch) => {
    const notes = (checkin.weekly_notes?.length ? checkin.weekly_notes : defaultWeeklyNotes(checkin.month))
      .map((w, i) => i === idx ? { ...w, ...patch } : w);
    updateCheckin(checkin.id, { weekly_notes: notes });
  };

  const editMeasurement = (name, value) => {
    setMeasurementsSaved(false);
    setMeasurementsDraft((d) => ({
      ...(d || currentCheckin?.measurements || {}),
      [name]: value === '' ? null : Number(value),
    }));
  };

  const saveMeasurements = async () => {
    if (!currentCheckin) return;
    await updateCheckin(currentCheckin.id, { measurements: measurementsDraft || currentCheckin.measurements || {} });
    setMeasurementsSaved(true);
    setTimeout(() => setMeasurementsSaved(false), 2500);
  };

  const removeCheckin = async (id, month) => {
    if (!window.confirm(`¿Borrar el seguimiento de ${monthLabelFull(month)}?`)) return;
    setCheckins((cs) => cs.filter((c) => c.id !== id));
    await supabase.from('client_checkins').delete().eq('id', id);
  };

  // Toggle videollamada — auto-exporta PDF al marcarla como realizada
  const toggleCall = async (checkin) => {
    const newDone = !checkin.call_done;
    await updateCheckin(checkin.id, { call_done: newDone });
    if (newDone && !autoExported) {
      // Pequeño delay para que la UI se actualice antes de generar el PDF
      setTimeout(async () => {
        setExportingId(checkin.id);
        const updatedCheckin = { ...checkin, call_done: true };
        await downloadCheckinPDF({ name: clienteName, id: clienteId }, updatedCheckin, checkins);
        setExportingId(null);
        setAutoExported(true);
      }, 400);
    }
  };

  const exportPdf = async (checkin) => {
    setExportingId(checkin.id);
    await downloadCheckinPDF({ name: clienteName, id: clienteId }, checkin, checkins);
    setExportingId(null);
  };

  if (!hasCurrentMonth) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="text-muted text-sm">No hay seguimiento para {monthLabelFull(currentMonth)} todavía.</div>
        <button
          onClick={addMonth}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
          style={{ background: 'var(--color-violet)', color: '#0D0A1F' }}
        >
          <Plus size={15} /> Crear seguimiento de {monthLabelFull(currentMonth)}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Selector de fase */}
      <Card>
        <div className="text-muted text-[10px] uppercase tracking-widest mb-3">Fase de este mes</div>
        <div className="flex flex-wrap gap-2">
          {PHASE_NAMES.filter((n) => n !== 'Otra').map((p) => (
            <button key={p} onClick={() => updateCheckin(currentCheckin.id, { phase: p })}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: currentCheckin.phase === p ? phaseColor(phases, p) : 'transparent',
                color:      currentCheckin.phase === p ? '#00161C' : 'var(--color-muted)',
                border:     `1px solid ${currentCheckin.phase === p ? phaseColor(phases, p) : 'var(--color-border)'}`,
              }}
            >{p}</button>
          ))}
        </div>
      </Card>

      {/* Stats rápidos */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl p-4" style={{ background: 'var(--color-surfaceAlt)', border: '1px solid var(--color-border)' }}>
          <div className="text-muted text-[10px] uppercase tracking-widest mb-1">Peso</div>
          <div className="flex items-baseline gap-1">
            <input type="number" step="0.1" value={currentCheckin.weight ?? ''}
              onChange={(e) => updateCheckin(currentCheckin.id, { weight: e.target.value ? Number(e.target.value) : null })}
              className="text-cyan text-2xl font-bold bg-transparent outline-none w-full" placeholder="—" />
            {currentCheckin.weight != null && <span className="text-cyan text-sm font-bold">kg</span>}
          </div>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--color-surfaceAlt)', border: '1px solid var(--color-border)' }}>
          <div className="text-muted text-[10px] uppercase tracking-widest mb-1">Media pasos</div>
          <input type="number" value={currentCheckin.steps_avg ?? ''}
            onChange={(e) => updateCheckin(currentCheckin.id, { steps_avg: e.target.value ? Number(e.target.value) : null })}
            className="text-green text-2xl font-bold bg-transparent outline-none w-full" placeholder="—" />
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--color-surfaceAlt)', border: '1px solid var(--color-border)' }}>
          <div className="text-muted text-[10px] uppercase tracking-widest mb-1">Cintura</div>
          <div className="flex items-baseline gap-1">
            <input type="number" step="0.5" value={(measurementsDraft ?? currentCheckin.measurements ?? {})['Cintura'] ?? ''}
              onChange={(e) => editMeasurement('Cintura', e.target.value)}
              className="text-amber text-2xl font-bold bg-transparent outline-none w-full" placeholder="—" />
            {(measurementsDraft ?? currentCheckin.measurements ?? {})['Cintura'] != null && <span className="text-amber text-sm font-bold">cm</span>}
          </div>
        </div>
      </div>

      {/* Semana a semana */}
      <Card>
        <div className="flex items-center gap-2 text-muted text-[10px] uppercase tracking-widest mb-4">
          <Clock size={11} /> Semana a semana
        </div>
        <div className="space-y-4">
          {(currentCheckin.weekly_notes?.length ? currentCheckin.weekly_notes : defaultWeeklyNotes(currentCheckin.month)).map((w, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: STRENGTH_COLOR[w.strength] || 'var(--color-border)' }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-ink text-sm font-semibold">{w.label}</span>
                  <div className="flex gap-1">
                    {WEEK_STRENGTHS.map((s) => (
                      <button key={s} onClick={() => updateWeekNote(currentCheckin, i, { strength: s })}
                        className="px-2.5 py-0.5 rounded-md text-xs font-bold transition-all"
                        style={{
                          background: w.strength === s ? `${STRENGTH_COLOR[s]}20` : 'transparent',
                          color:      w.strength === s ? STRENGTH_COLOR[s] : 'var(--color-muted)',
                          border:     `1px solid ${w.strength === s ? STRENGTH_COLOR[s] : 'transparent'}`,
                        }}
                      >{s}</button>
                    ))}
                  </div>
                </div>
                <input value={w.note || ''} onChange={(e) => updateWeekNote(currentCheckin, i, { note: e.target.value })}
                  placeholder="Nota de esta semana..."
                  className="text-muted text-sm bg-transparent border-none outline-none w-full" />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Entrenamiento + Nutrición */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <div className="flex items-center gap-1.5 text-muted text-[10px] uppercase tracking-widest mb-2"><Dumbbell size={11} /> Entrenamiento</div>
          <textarea value={currentCheckin.training_notes || ''} rows={4}
            onChange={(e) => updateCheckin(currentCheckin.id, { training_notes: e.target.value })}
            placeholder="Progresión, ejercicios clave, observaciones..."
            className="bg-transparent text-ink text-sm w-full outline-none resize-none leading-relaxed border-none" />
        </Card>
        <Card>
          <div className="flex items-center gap-1.5 text-muted text-[10px] uppercase tracking-widest mb-2"><Apple size={11} /> Nutrición</div>
          <textarea value={currentCheckin.nutrition_notes || ''} rows={4}
            onChange={(e) => updateCheckin(currentCheckin.id, { nutrition_notes: e.target.value })}
            placeholder="Adherencia, puntos débiles, ajustes..."
            className="bg-transparent text-ink text-sm w-full outline-none resize-none leading-relaxed border-none" />
        </Card>
      </div>

      {/* Objetivo del mes */}
      <Card>
        <div className="text-muted text-[10px] uppercase tracking-widest mb-2">Objetivo del mes</div>
        <textarea value={currentCheckin.goals || ''} rows={2}
          onChange={(e) => updateCheckin(currentCheckin.id, { goals: e.target.value })}
          placeholder="Ej. Bajar a 80kg manteniendo la fuerza en press banca..."
          className="bg-transparent text-ink text-sm w-full outline-none resize-none leading-relaxed border-none mb-3" />
        <div className="flex gap-2 flex-wrap">
          {GOAL_STATUSES.map((s) => (
            <button key={s} onClick={() => updateCheckin(currentCheckin.id, { goal_status: s })}
              className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: currentCheckin.goal_status === s ? `${GOAL_COLORS[s]}20` : 'transparent',
                color:      currentCheckin.goal_status === s ? GOAL_COLORS[s] : 'var(--color-muted)',
                border:     `1px solid ${currentCheckin.goal_status === s ? GOAL_COLORS[s] : 'var(--color-border)'}`,
              }}
            >{s}</button>
          ))}
        </div>
      </Card>

      {/* Videollamada */}
      <Card>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 text-ink font-semibold text-sm mb-0.5">
              <Video size={14} className="text-muted" /> Videollamada mensual
            </div>
            <input type="date" value={currentCheckin.call_date || ''}
              onChange={(e) => updateCheckin(currentCheckin.id, { call_date: e.target.value || null })}
              className="bg-transparent text-muted text-xs outline-none border-none" />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => toggleCall(currentCheckin)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: currentCheckin.call_done ? '#4ADE8018' : 'var(--color-bg)',
                color:      currentCheckin.call_done ? 'var(--color-green)' : 'var(--color-muted)',
                border:     `1px solid ${currentCheckin.call_done ? 'var(--color-green)' : 'var(--color-border)'}`,
              }}>
              {currentCheckin.call_done ? <Check size={12} /> : <X size={12} />}
              {currentCheckin.call_done ? 'Realizada' : 'Pendiente'}
            </button>
            {currentCheckin.call_done && (
              <button onClick={() => exportPdf(currentCheckin)} disabled={exportingId === currentCheckin.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                style={{ background: 'var(--color-surfaceAlt)', color: 'var(--color-cyan)', border: '1px solid var(--color-border)' }}
                title="Exportar PDF del mes">
                {exportingId === currentCheckin.id ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />}
                PDF
              </button>
            )}
          </div>
        </div>
        {autoExported && (
          <div className="mt-2 flex items-center gap-1.5 text-green text-xs">
            <Sparkles size={11} /> PDF exportado automáticamente al cerrar la llamada
          </div>
        )}
      </Card>

      {/* Mediciones corporales */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5 text-muted text-[10px] uppercase tracking-widest"><Ruler size={11} /> Mediciones (este mes)</div>
          <button onClick={saveMeasurements}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
            style={{ background: measurementsSaved ? '#4ADE8018' : 'var(--color-violet)', color: measurementsSaved ? 'var(--color-green)' : '#0D0A1F' }}>
            {measurementsSaved ? <><Check size={11} /> Guardado</> : 'Guardar mediciones'}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-x-4 gap-y-3">
          {MEASUREMENTS.map((m) => (
            <div key={m}>
              <div className="text-muted text-[10px] mb-1">{m}</div>
              <input type="number"
                value={(measurementsDraft ?? currentCheckin.measurements ?? {})[m] ?? ''}
                onChange={(e) => editMeasurement(m, e.target.value)}
                placeholder="—"
                className="bg-surface border border-border text-ink rounded-lg px-2.5 py-2 text-sm w-full outline-none focus:border-cyan" />
            </div>
          ))}
        </div>
      </Card>

      {/* Notas y borrar */}
      <input value={currentCheckin.notes || ''}
        onChange={(e) => updateCheckin(currentCheckin.id, { notes: e.target.value })}
        placeholder="Notas adicionales de este mes..."
        className="w-full bg-surfaceAlt border border-border text-ink rounded-xl px-4 py-3 text-sm outline-none focus:border-cyan" />

      <button onClick={() => removeCheckin(currentCheckin.id, currentCheckin.month)}
        className="text-red text-xs flex items-center gap-1 mx-auto opacity-50 hover:opacity-100 transition-opacity">
        <Trash2 size={12} /> Borrar seguimiento de este mes
      </button>
    </div>
  );
}
