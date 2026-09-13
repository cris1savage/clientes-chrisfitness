'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Video, Check, X, FileDown, Loader2, Trash2, Ruler, Dumbbell, Apple, Clock, Sparkles, Footprints, Percent } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Card from '@/components/Card';
import {
  phaseForDate, phaseColor, PHASE_NAMES, todayISO, defaultWeeklyNotes,
  MEASUREMENTS, WEEK_STRENGTHS, STRENGTH_COLOR, GOAL_STATUSES, GOAL_COLORS, monthLabelFull,
  weekRangeLabel, avgWeeklyField, LEVEL_OPTIONS, LEVEL_COLORS,
  calcKcalMedia, calcKcalFromMacros,
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
        <div className="space-y-5">
          {(currentCheckin.weekly_notes?.length ? currentCheckin.weekly_notes : defaultWeeklyNotes(currentCheckin.month)).map((w, i) => {
            // Calcular kcal media automática
            const kcalMedia = calcKcalMedia(w.kcal_on, w.kcal_off, w.dias_on);
            // Calcular kcal desde macros si no hay kcal directa
            const kcalMacros = calcKcalFromMacros(w.protein, w.carbs, w.fat);
            const kcalTotal  = kcalMedia ?? kcalMacros;
            const diasOff    = w.dias_on != null ? 7 - Number(w.dias_on) : null;

            return (
              <div key={i} className="pb-5 last:pb-0" style={{ borderBottom: i < 3 ? '1px solid var(--color-border)' : 'none' }}>
                {/* Cabecera semana */}
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: STRENGTH_COLOR[w.strength] || 'var(--color-border)' }} />
                    <span className="text-ink text-sm font-semibold">{weekRangeLabel(currentCheckin.month, i)}</span>
                  </div>
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

                {/* Nota libre */}
                <input value={w.note || ''} onChange={(e) => updateWeekNote(currentCheckin, i, { note: e.target.value })}
                  placeholder="Nota de esta semana..."
                  className="text-muted text-sm bg-transparent border-none outline-none w-full mb-3" />

                {/* Fila 1: Pasos + Kcal ON + Kcal OFF + Días ON */}
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {/* Pasos */}
                  <div className="rounded-lg px-3 py-2" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                    <div className="text-muted text-[9px] uppercase tracking-widest mb-1 flex items-center gap-1">
                      <Footprints size={9} style={{ color: '#4ADE80' }} /> Pasos/día
                    </div>
                    <input type="number" value={w.steps ?? ''} placeholder="—"
                      onChange={(e) => updateWeekNote(currentCheckin, i, { steps: e.target.value === '' ? null : Number(e.target.value) })}
                      className="bg-transparent text-sm font-bold outline-none w-full text-green border-none" />
                  </div>

                  {/* Adherencia */}
                  <div className="rounded-lg px-3 py-2" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                    <div className="text-muted text-[9px] uppercase tracking-widest mb-1 flex items-center gap-1">
                      <Percent size={9} style={{ color: '#A78BFA' }} /> Adherencia
                    </div>
                    <div className="flex items-baseline gap-0.5">
                      <input type="number" min="0" max="100" value={w.adherence ?? ''} placeholder="—"
                        onChange={(e) => updateWeekNote(currentCheckin, i, { adherence: e.target.value === '' ? null : Number(e.target.value) })}
                        className="bg-transparent text-sm font-bold outline-none w-full text-violet border-none" />
                      {w.adherence != null && <span className="text-violet text-xs font-bold">%</span>}
                    </div>
                  </div>
                </div>

                {/* Kcal ON / OFF / Días ON */}
                <div className="rounded-xl p-3 mb-2" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                  <div className="text-muted text-[9px] uppercase tracking-widest mb-2">Kcal días ON / OFF</div>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div>
                      <div className="text-[9px] text-amber font-bold mb-1">Kcal ON</div>
                      <input type="number" value={w.kcal_on ?? ''} placeholder="—"
                        onChange={(e) => updateWeekNote(currentCheckin, i, { kcal_on: e.target.value === '' ? null : Number(e.target.value) })}
                        className="bg-transparent text-amber text-sm font-bold outline-none w-full border-none" />
                    </div>
                    <div>
                      <div className="text-[9px] text-orange font-bold mb-1" style={{ color: '#FB923C' }}>Kcal OFF</div>
                      <input type="number" value={w.kcal_off ?? ''} placeholder="—"
                        onChange={(e) => updateWeekNote(currentCheckin, i, { kcal_off: e.target.value === '' ? null : Number(e.target.value) })}
                        className="bg-transparent text-sm font-bold outline-none w-full border-none" style={{ color: '#FB923C' }} />
                    </div>
                    <div>
                      <div className="text-[9px] text-muted mb-1">Días ON / OFF</div>
                      <div className="flex items-center gap-1 text-sm font-bold">
                        <input type="number" min="0" max="7" value={w.dias_on ?? ''} placeholder="—"
                          onChange={(e) => updateWeekNote(currentCheckin, i, { dias_on: e.target.value === '' ? null : Number(e.target.value) })}
                          className="bg-transparent text-amber text-sm font-bold outline-none w-7 border-none" />
                        {diasOff != null && <span className="text-muted text-xs">/ {diasOff} off</span>}
                      </div>
                    </div>
                  </div>
                  {/* Media calculada */}
                  {kcalMedia != null && (
                    <div className="text-[10px] text-muted">
                      Media: <span className="text-amber font-bold">{kcalMedia} kcal/día</span>
                      {w.dias_on != null && <span className="ml-1">({w.dias_on}d on · {diasOff}d off)</span>}
                    </div>
                  )}
                </div>

                {/* Macros días ON */}
                <div className="rounded-xl p-3" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                  <div className="text-muted text-[9px] uppercase tracking-widest mb-2">Macros días ON</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <div className="text-[9px] font-bold mb-1" style={{ color: '#5ECCFA' }}>Proteínas (g)</div>
                      <input type="number" value={w.protein ?? ''} placeholder="—"
                        onChange={(e) => updateWeekNote(currentCheckin, i, { protein: e.target.value === '' ? null : Number(e.target.value) })}
                        className="bg-transparent text-sm font-bold outline-none w-full border-none text-cyan" />
                    </div>
                    <div>
                      <div className="text-[9px] font-bold mb-1 text-amber">Carbos (g)</div>
                      <input type="number" value={w.carbs ?? ''} placeholder="—"
                        onChange={(e) => updateWeekNote(currentCheckin, i, { carbs: e.target.value === '' ? null : Number(e.target.value) })}
                        className="bg-transparent text-amber text-sm font-bold outline-none w-full border-none" />
                    </div>
                    <div>
                      <div className="text-[9px] font-bold mb-1" style={{ color: '#FB923C' }}>Grasas (g)</div>
                      <input type="number" value={w.fat ?? ''} placeholder="—"
                        onChange={(e) => updateWeekNote(currentCheckin, i, { fat: e.target.value === '' ? null : Number(e.target.value) })}
                        className="bg-transparent text-sm font-bold outline-none w-full border-none" style={{ color: '#FB923C' }} />
                    </div>
                  </div>
                  {/* Kcal calculadas desde macros */}
                  {kcalMacros != null && (
                    <div className="text-[10px] text-muted mt-2">
                      Kcal calculadas: <span className="text-green font-bold">{kcalMacros} kcal</span>
                      <span className="ml-1">
                        ({w.protein ?? 0}P × 4 + {w.carbs ?? 0}C × 4 + {w.fat ?? 0}G × 9)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Resumen medias del mes */}
        {(() => {
          const notes    = currentCheckin.weekly_notes?.length ? currentCheckin.weekly_notes : defaultWeeklyNotes(currentCheckin.month);
          const avgSteps = avgWeeklyField(notes, 'steps');
          const avgAdh   = avgWeeklyField(notes, 'adherence');
          const kcalMedias = notes.map((w) => calcKcalMedia(w.kcal_on, w.kcal_off, w.dias_on)).filter((v) => v != null);
          const avgKcal  = kcalMedias.length ? Math.round(kcalMedias.reduce((a, b) => a + b, 0) / kcalMedias.length) : null;
          const avgProt  = avgWeeklyField(notes, 'protein');
          const avgCarbs = avgWeeklyField(notes, 'carbs');
          const avgFat   = avgWeeklyField(notes, 'fat');
          if (!avgSteps && !avgKcal && !avgAdh && !avgProt) return null;
          return (
            <div className="mt-4 pt-4 space-y-1.5" style={{ borderTop: '1px solid var(--color-border)' }}>
              <div className="text-muted text-[9px] uppercase tracking-widest mb-2">Medias del mes</div>
              <div className="flex flex-wrap gap-4 text-xs">
                {avgSteps != null && <span><span className="text-muted">Pasos: </span><span className="font-bold text-green">{Math.round(avgSteps).toLocaleString()}</span></span>}
                {avgKcal  != null && <span><span className="text-muted">Kcal media: </span><span className="font-bold text-amber">{avgKcal}</span></span>}
                {avgAdh   != null && <span><span className="text-muted">Adherencia: </span><span className="font-bold text-violet">{avgAdh}%</span></span>}
              </div>
              {(avgProt || avgCarbs || avgFat) && (
                <div className="flex flex-wrap gap-4 text-xs">
                  {avgProt  != null && <span><span className="text-muted">Prot: </span><span className="font-bold text-cyan">{avgProt}g</span></span>}
                  {avgCarbs != null && <span><span className="text-muted">Carbs: </span><span className="font-bold text-amber">{avgCarbs}g</span></span>}
                  {avgFat   != null && <span><span className="text-muted">Grasas: </span><span className="font-bold" style={{ color: '#FB923C' }}>{avgFat}g</span></span>}
                  {avgProt && avgCarbs && avgFat && (
                    <span><span className="text-muted">Kcal macros: </span><span className="font-bold text-green">{calcKcalFromMacros(avgProt, avgCarbs, avgFat)}</span></span>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </Card>

      {/* Entrenamiento + Nutrición */}
      {(() => {
        const notes = currentCheckin.weekly_notes?.length ? currentCheckin.weekly_notes : defaultWeeklyNotes(currentCheckin.month);
        const avgSteps = avgWeeklyField(notes, 'steps');
        const avgKcal  = avgWeeklyField(notes, 'kcal_avg');
        const avgAdh   = avgWeeklyField(notes, 'adherence');
        return (
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <div className="flex items-center justify-between mb-2.5 flex-wrap gap-1.5">
                <div className="flex items-center gap-1.5 text-muted text-[10px] uppercase tracking-widest"><Dumbbell size={11} /> Entrenamiento</div>
                <div className="flex gap-1">
                  {LEVEL_OPTIONS.map((lvl) => (
                    <button key={lvl} onClick={() => updateCheckin(currentCheckin.id, { training_level: lvl })}
                      title={lvl}
                      className="w-2.5 h-2.5 rounded-full transition-all"
                      style={{
                        background: currentCheckin.training_level === lvl ? LEVEL_COLORS[lvl] : 'var(--color-border)',
                        outline: currentCheckin.training_level === lvl ? `2px solid ${LEVEL_COLORS[lvl]}40` : 'none',
                      }} />
                  ))}
                </div>
              </div>
              {currentCheckin.training_level && (
                <div className="text-[11px] font-bold mb-2" style={{ color: LEVEL_COLORS[currentCheckin.training_level] }}>{currentCheckin.training_level}</div>
              )}
              <textarea value={currentCheckin.training_notes || ''} rows={3}
                onChange={(e) => updateCheckin(currentCheckin.id, { training_notes: e.target.value })}
                placeholder="Progresión, ejercicios clave, observaciones..."
                className="bg-transparent text-ink text-sm w-full outline-none resize-none leading-relaxed border-none" />
            </Card>
            <Card>
              <div className="flex items-center justify-between mb-2.5 flex-wrap gap-1.5">
                <div className="flex items-center gap-1.5 text-muted text-[10px] uppercase tracking-widest"><Apple size={11} /> Nutrición</div>
                <div className="flex gap-1">
                  {LEVEL_OPTIONS.map((lvl) => (
                    <button key={lvl} onClick={() => updateCheckin(currentCheckin.id, { nutrition_level: lvl })}
                      title={lvl}
                      className="w-2.5 h-2.5 rounded-full transition-all"
                      style={{
                        background: currentCheckin.nutrition_level === lvl ? LEVEL_COLORS[lvl] : 'var(--color-border)',
                        outline: currentCheckin.nutrition_level === lvl ? `2px solid ${LEVEL_COLORS[lvl]}40` : 'none',
                      }} />
                  ))}
                </div>
              </div>
              {currentCheckin.nutrition_level && (
                <div className="text-[11px] font-bold mb-2" style={{ color: LEVEL_COLORS[currentCheckin.nutrition_level] }}>{currentCheckin.nutrition_level}</div>
              )}
              {(avgKcal != null || avgAdh != null) && (
                <div className="flex gap-3 mb-2 text-[11px]">
                  {avgKcal != null && <span className="text-muted">Kcal media: <span className="text-amber font-bold">{avgKcal}</span></span>}
                  {avgAdh  != null && <span className="text-muted">Adherencia: <span className="text-violet font-bold">{avgAdh}%</span></span>}
                </div>
              )}
              <textarea value={currentCheckin.nutrition_notes || ''} rows={3}
                onChange={(e) => updateCheckin(currentCheckin.id, { nutrition_notes: e.target.value })}
                placeholder="Adherencia, puntos débiles, ajustes..."
                className="bg-transparent text-ink text-sm w-full outline-none resize-none leading-relaxed border-none" />
            </Card>
          </div>
        );
      })()}

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
        <textarea value={currentCheckin.call_notes || ''} rows={3}
          onChange={(e) => updateCheckin(currentCheckin.id, { call_notes: e.target.value })}
          placeholder="Guion / temas a tratar en la llamada..."
          className="mt-3 bg-surface border border-border text-ink text-sm w-full outline-none resize-none leading-relaxed rounded-lg px-3 py-2 focus:border-cyan" />
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
