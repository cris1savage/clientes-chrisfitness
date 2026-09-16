'use client';

import { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Flag, TrendingDown, Activity, Footprints, Dumbbell, Star, Check, Flame } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Card from '@/components/Card';
import {
  phaseForDate, phaseColor, todayISO, mondayOf, fmtDate, addDaysISO,
  avgKcalForMonth, avgWeeklyField, monthLabelFull,
} from '@/lib/timeline';

const MONTH_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const RANGES      = ['1S','1M','3M','6M','12M','TODO'];

const METRICS = [
  { key: 'commitment', label: 'Compromiso',      icon: Star,       max: 10,    color: '#FBBF24' },
  { key: 'training',   label: 'Nivel entrenos',   icon: Dumbbell,   max: 10,    color: '#5ECCFA' },
  { key: 'steps_avg',  label: 'Pasos/día (media)',icon: Footprints, max: 15000, color: '#4ADE80', autoField: 'steps' },
  { key: 'adherence',  label: 'Adherencia dieta', icon: Activity,   max: 100,   unit: '%', color: '#A78BFA', autoField: 'adherence' },
];

// Gauge circular — versión "pro" del progreso, sustituye a la barra plana
function RadialGauge({ value, max, color, auto }) {
  const size = 68, stroke = 6, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const pct = max ? Math.max(0, Math.min((value || 0) / max, 1)) : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} stroke="var(--color-border)" strokeWidth={stroke} fill="none" />
        {value != null && (
          <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={stroke} fill="none"
            strokeDasharray={c} strokeDashoffset={c - pct * c} strokeLinecap="round"
            transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: 'stroke-dashoffset 0.4s ease' }} />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold" style={{ color: value != null ? color : 'var(--color-muted)' }}>{value ?? '—'}</span>
        {auto && value != null && <span className="text-[8px] text-muted -mt-0.5">auto</span>}
      </div>
    </div>
  );
}

export default function ResumenClient({ clienteId, cliente, initialCheckins, initialWeeks }) {
  const supabase = useMemo(() => createClient(), []);

  const [checkins,      setCheckins]      = useState(initialCheckins);
  const [weeks,         setWeeks]         = useState(initialWeeks);
  const [phases,        setPhases]        = useState(cliente.phases || []);
  const [longTermGoal,  setLongTermGoal]  = useState(cliente.long_term_goal || '');
  const [clienteNotes,  setClienteNotes]  = useState(cliente.notes || '');
  const [chartRange,    setChartRange]    = useState('TODO');
  const [metrics,       setMetrics]       = useState(cliente.tracking_metrics || {});
  const [metricsSaved,  setMetricsSaved]  = useState(false);

  const today            = todayISO();
  const currentWeekStart = mondayOf(today);
  const currentPhaseObj  = phaseForDate(phases, today);
  const currentPhaseName = currentPhaseObj?.name;

  // Días en el programa desde la fecha de inicio del cliente
  const startDate  = cliente.start_date || null;
  const diasPrograma = startDate
    ? Math.floor((new Date(today) - new Date(startDate)) / 86400000)
    : null;

  // Pesos
  const sorted   = [...checkins].sort((a,b) => a.month.localeCompare(b.month));
  const latestCh = [...sorted].reverse().find((c) => c.weight != null);
  const firstCh  = sorted.find((c) => c.weight != null);
  const latestWk = [...weeks].reverse().find((w) => w.real_weight != null);
  const firstWk  = weeks.find((w) => w.real_weight != null);

  const currentWeight = latestCh?.weight ?? latestWk?.real_weight ?? null;
  const firstWeight   = firstCh?.weight  ?? firstWk?.real_weight  ?? null;
  const hasMultiple   = (latestCh && firstCh && latestCh.month !== firstCh.month)
    || (!latestCh && latestWk && firstWk && latestWk.id !== firstWk.id);
  const weightDiff = currentWeight != null && firstWeight != null && hasMultiple
    ? Math.round((currentWeight - firstWeight) * 10) / 10 : null;

  // Kcal semana
  const thisWeek = weeks.find((w) => w.week_start === currentWeekStart);
  const kcalOn   = thisWeek?.kcal_on ?? thisWeek?.kcal ?? null;
  const kcalOff  = thisWeek?.kcal_off ?? null;

  // Kcal media del mes — sumada/calculada a partir de las semanas del Timeline
  const currentMonthKey = today.slice(0, 7);
  const kcalMonthAvg = useMemo(() => avgKcalForMonth(weeks, currentMonthKey), [weeks, currentMonthKey]);

  // Datos "automáticos" calculados desde las notas semanales de Mes actual (evita tener que rellenarlo dos veces)
  const currentMonthCheckin = checkins.find((c) => c.month === currentMonthKey);
  const autoFromWeekly = {
    steps:      avgWeeklyField(currentMonthCheckin?.weekly_notes, 'steps'),
    adherence:  avgWeeklyField(currentMonthCheckin?.weekly_notes, 'adherence'),
  };

  // Objetivo peso fase
  let goalWeight = null;
  if (currentPhaseObj) {
    const m = (currentPhaseObj.goal || '').match(/(\d{2,3}(?:[.,]\d)?)\s*kg/i);
    if (m) goalWeight = Number(m[1].replace(',', '.'));
  }
  if (goalWeight == null && weeks.length > 0) {
    const phWks = weeks.filter((w) => phaseForDate(phases, w.week_start)?.name === currentPhaseName);
    const last  = [...phWks].reverse().find((w) => w.target_weight != null);
    if (last) goalWeight = Math.round(last.target_weight * 10) / 10;
  }

  // ── Gráfica dual: peso real (azul) + objetivo timeline (naranja) ──
  // Fuente única: tracking_timeline_weeks — así los filtros de tiempo son consistentes
  const today2 = todayISO();

  // Construir puntos del timeline — objetivo siempre, real solo si existe
  const timelinePts = weeks
    .filter((w) => w.target_weight != null || w.real_weight != null)
    .map((w) => ({
      label:    fmtDate(w.week_start),
      weekStart: w.week_start,
      Objetivo: w.target_weight != null ? Number(w.target_weight) : undefined,
      Real:     w.real_weight != null ? Number(w.real_weight) : undefined,
    }));

  // Fallback mensual si no hay timeline — solo peso real
  const monthlyFallback = sorted.filter((c) => c.weight != null).map((c) => {
    const [,mm] = c.month.split('-');
    return { label: MONTH_SHORT[Number(mm)-1], Real: Number(c.weight) };
  });

  const useTimeline = timelinePts.length >= 2;
  const basePts     = useTimeline ? timelinePts : monthlyFallback;

  // Aplicar filtro de rango
  const rangeMap = { '1S': 1, '1M': 4, '3M': 13, '6M': 26, '12M': 52 };
  const chartData = (() => {
    if (chartRange === 'TODO') return basePts;
    const n = rangeMap[chartRange] || basePts.length;
    if (useTimeline) {
      // Desde hoy hacia atrás (pasado) y hacia adelante (futuro) según el rango
      const todayIdx = basePts.findIndex((p) => p.weekStart >= today2);
      const center   = todayIdx >= 0 ? todayIdx : basePts.length - 1;
      // Para 1S: solo esta semana y las 2 anteriores
      // Para 1M: 4 semanas atrás y 4 adelante
      const back = Math.ceil(n / 2);
      const fwd  = Math.floor(n / 2);
      return basePts.slice(Math.max(0, center - back), center + fwd + 1);
    }
    return basePts.slice(-Math.ceil(n / 4));
  })();

  const allVals   = chartData.flatMap((d) => [d.Real, d.Objetivo].filter((v) => v != null));
  const domainMin = allVals.length ? Math.floor(Math.min(...allVals) - 1) : 60;
  const domainMax = allVals.length ? Math.ceil(Math.max(...allVals) + 1) : 100;

  const savePhases    = async (next) => { setPhases(next); await supabase.from('tracking_clients').update({ phases: next }).eq('id', clienteId); };
  const saveLongGoal  = async (v)    => { setLongTermGoal(v); await supabase.from('tracking_clients').update({ long_term_goal: v }).eq('id', clienteId); };
  const saveNotes     = async (v)    => { setClienteNotes(v); await supabase.from('tracking_clients').update({ notes: v }).eq('id', clienteId); };
  const saveMetrics   = async ()     => {
    await supabase.from('tracking_clients').update({ tracking_metrics: metrics }).eq('id', clienteId);
    setMetricsSaved(true); setTimeout(() => setMetricsSaved(false), 2000);
  };

  return (
    <div className="space-y-5">

      {/* ── FILA SUPERIOR: peso + cambio + fase + días ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-surfaceAlt)', border: '1px solid var(--color-border)' }}>
          <div className="text-muted text-[10px] uppercase tracking-widest mb-2">Peso actual</div>
          <div className="text-3xl font-bold text-cyan">{currentWeight != null ? `${currentWeight} kg` : '—'}</div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-surfaceAlt)', border: '1px solid var(--color-border)' }}>
          <div className="text-muted text-[10px] uppercase tracking-widest mb-2">Desde el inicio</div>
          <div className="text-3xl font-bold" style={{ color: weightDiff == null ? 'var(--color-muted)' : weightDiff < 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
            {weightDiff != null ? `${weightDiff > 0 ? '+' : ''}${weightDiff} kg` : '—'}
          </div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-surfaceAlt)', border: '1px solid var(--color-border)' }}>
          <div className="text-muted text-[10px] uppercase tracking-widest mb-2">Fase actual</div>
          <div className="text-xl font-bold" style={{ color: currentPhaseName ? phaseColor(phases, currentPhaseName) : 'var(--color-muted)' }}>
            {currentPhaseName || '—'}
          </div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-surfaceAlt)', border: '1px solid var(--color-border)' }}>
          <div className="text-muted text-[10px] uppercase tracking-widest mb-2">En el programa</div>
          {diasPrograma != null ? (
            <div>
              <span className="text-violet text-2xl font-bold">{diasPrograma}</span>
              <span className="text-muted text-xs ml-1">días</span>
              <div className="text-muted text-xs mt-0.5">{Math.floor(diasPrograma / 7)} semanas · desde {startDate}</div>
            </div>
          ) : <span className="text-muted text-sm">—</span>}
        </div>
      </div>

      {/* ── KCAL — media del mes desde timeline ── */}
      <div className="rounded-2xl px-5 py-4 flex items-center justify-between flex-wrap gap-4"
        style={{ background: 'var(--color-surfaceAlt)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-2 text-muted text-[10px] uppercase tracking-widest">
          <Flame size={11} /> Kcal media · {monthLabelFull(today.slice(0,7))}
          {kcalMonthAvg.weeksCount > 0 && <span className="ml-1">({kcalMonthAvg.weeksCount} sem.)</span>}
        </div>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-green text-2xl font-bold">{kcalMonthAvg.on ?? '—'}</div>
            <div className="text-muted text-[9px] uppercase tracking-widest">días on</div>
          </div>
          <div className="text-border text-lg">·</div>
          <div className="text-center">
            <div className="text-amber text-2xl font-bold">{kcalMonthAvg.off ?? '—'}</div>
            <div className="text-muted text-[9px] uppercase tracking-widest">días off</div>
          </div>
        </div>
      </div>

      {/* ── MÉTRICAS ── */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="text-muted text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1.5">
            <Activity size={11} /> Métricas de seguimiento
          </div>
          <button onClick={saveMetrics}
            className="px-3 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1"
            style={{ background: metricsSaved ? '#4ADE8018' : 'var(--color-violet)', color: metricsSaved ? 'var(--color-green)' : '#0D0A1F' }}>
            {metricsSaved ? <><Check size={10} /> Guardado</> : 'Guardar'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {METRICS.map((m) => {
            const autoVal   = m.autoField ? autoFromWeekly[m.autoField] : null;
            const isAuto    = m.autoField && metrics[m.key] == null && autoVal != null;
            const shownVal  = metrics[m.key] ?? (m.autoField ? autoVal : null);
            return (
              <div key={m.key} className="flex items-center gap-3 rounded-xl p-3" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                <RadialGauge value={shownVal} max={m.max} color={m.color} auto={isAuto} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-muted text-[11px] mb-1"><m.icon size={11} style={{ color: m.color }} />{m.label}</div>
                  <input type="number" min={0} max={m.max || 999999}
                    value={metrics[m.key] ?? ''}
                    onChange={(e) => setMetrics((prev) => ({ ...prev, [m.key]: e.target.value === '' ? null : Number(e.target.value) }))}
                    placeholder={isAuto ? `${autoVal} (auto)` : '—'}
                    className="w-full bg-surfaceAlt border border-border text-ink rounded-lg px-2 py-1 text-xs outline-none focus:border-cyan" />
                  {m.autoField && (
                    <div className="text-[9px] text-muted mt-0.5">
                      {isAuto ? `Calculado desde Mes actual: ${autoVal}. Escribe aquí para sobreescribir.` : `Valor manual. Deja vacío para usar el automático (${autoVal ?? '—'}).`}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── OBJETIVOS ── */}
      <Card>
        <div className="text-muted text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1.5 mb-4">
          <Flag size={11} /> Objetivos
        </div>
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="w-0.5 rounded-full shrink-0 self-stretch" style={{ background: 'var(--color-cyan)' }} />
            <div className="flex-1">
              <div className="text-cyan text-[10px] font-bold mb-1.5 uppercase tracking-widest">Largo plazo</div>
              <textarea value={longTermGoal} onChange={(e) => setLongTermGoal(e.target.value)} onBlur={(e) => saveLongGoal(e.target.value)}
                placeholder="Ej. Llegar a 78kg con visibilidad abdominal para junio 2027..." rows={2}
                className="bg-transparent border-none text-ink text-sm w-full outline-none resize-none leading-relaxed" />
            </div>
          </div>
          {currentPhaseObj?.goal ? (
            <div className="flex gap-3">
              <div className="w-0.5 rounded-full shrink-0 self-stretch" style={{ background: 'var(--color-amber)' }} />
              <div className="flex-1">
                <div className="text-amber text-[10px] font-bold mb-1.5 uppercase tracking-widest">Fase actual — {currentPhaseName}</div>
                <div className="text-ink text-sm leading-relaxed">{currentPhaseObj.goal}</div>
              </div>
            </div>
          ) : (
            <div className="text-muted text-xs">Edita el objetivo de la fase desde la pestaña <span className="text-violet font-semibold">Fases</span>.</div>
          )}
        </div>
      </Card>

      {/* ── GRÁFICA ── */}
      {chartData.length >= 1 && (
        <div className="rounded-xl p-4" style={{ background: '#0D1117', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="text-muted text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1.5">
              <TrendingDown size={11} /> Progreso de peso
            </div>
            <div className="flex gap-1">
              {RANGES.map((r) => (
                <button key={r} onClick={() => setChartRange(r)}
                  className="px-2.5 py-1 rounded-md text-[10px] font-bold transition-all"
                  style={{
                    background: chartRange === r ? 'var(--color-cyan)' : 'transparent',
                    color:      chartRange === r ? '#00161C'            : 'var(--color-muted)',
                    border:     `1px solid ${chartRange === r ? 'var(--color-cyan)' : '#1C2226'}`,
                  }}>{r}</button>
              ))}
            </div>
          </div>
          <div className="w-full h-[210px]">
            <ResponsiveContainer>
              <AreaChart data={chartData} margin={{ top: 5, right: 12, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id={`wg-${clienteId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#5ECCFA" stopOpacity={0.18} />
                    <stop offset="85%"  stopColor="#5ECCFA" stopOpacity={0.02} />
                    <stop offset="100%" stopColor="#5ECCFA" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1C2226" vertical={false} />
                <XAxis dataKey="label" tick={{ fill:'#5A6870', fontSize:11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill:'#5A6870', fontSize:11 }} tickLine={false} axisLine={false} domain={[domainMin, domainMax]} width={28} />
                <Tooltip
                  contentStyle={{ background:'#0D1117', border:'1px solid #1C2226', borderRadius:8, fontSize:12 }}
                  labelStyle={{ color:'#C8D5DA' }}
                  formatter={(v, name) => [`${v} kg`, name === 'Objetivo' ? '🟠 Objetivo' : '🔵 Peso real']}
                />
                <Area type="monotone" dataKey="Objetivo" stroke="#FBBF24" strokeWidth={1.5} strokeDasharray="5 3" fill="none" dot={false} activeDot={{ r: 4, fill: '#FBBF24', stroke: '#0D1117', strokeWidth: 2 }} connectNulls />
                <Area type="monotone" dataKey="Real" stroke="#5ECCFA" strokeWidth={2.5} fill={`url(#wg-${clienteId})`} dot={{ r:4, fill:'#5ECCFA', stroke:'#0D1117', strokeWidth:2 }} activeDot={{ r:5, fill:'#5ECCFA', stroke:'#0D1117', strokeWidth:2 }} connectNulls={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── NOTAS PRIVADAS ── */}
      <Card>
        <div className="text-muted text-[10px] font-semibold uppercase tracking-widest mb-2">Notas privadas</div>
        <textarea value={clienteNotes} onChange={(e) => setClienteNotes(e.target.value)} onBlur={(e) => saveNotes(e.target.value)}
          placeholder="Observaciones, contexto personal, notas del entrenador..." rows={3}
          className="bg-transparent text-ink text-sm w-full outline-none resize-none leading-relaxed border-none" />
      </Card>
    </div>
  );
}
