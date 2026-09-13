'use client';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { phaseForDate, phaseColor, todayISO, mondayOf, fmtDate, STRENGTH_COLOR, GOAL_COLORS, monthLabelFull } from '@/lib/timeline';

const MONTH_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function monthLabel(ym) {
  const [,mm] = ym.split('-');
  return MONTH_SHORT[Number(mm)-1];
}

export default function VistaPublicaClient({ cliente }) {
  const today    = todayISO();
  const phases   = cliente.phases || [];
  const phase    = phaseForDate(phases, today);
  const color    = phase ? phaseColor(phases, phase.name) : '#7C878B';

  const checkins  = [...(cliente.client_checkins || [])].sort((a,b) => a.month.localeCompare(b.month));
  const weeks     = [...(cliente.client_timeline_weeks || [])].sort((a,b) => a.week_start.localeCompare(b.week_start));
  const thisMonth = today.slice(0,7);
  const currentCheckin = checkins.find((c) => c.month === thisMonth);

  // Peso
  const latestCh = [...checkins].reverse().find((c) => c.weight != null);
  const firstCh  = checkins.find((c) => c.weight != null);
  const latestWk = [...weeks].reverse().find((w) => w.real_weight != null);
  const currentW = latestCh?.weight ?? latestWk?.real_weight ?? null;
  const firstW   = firstCh?.weight ?? weeks.find((w) => w.real_weight != null)?.real_weight ?? null;
  const diff     = currentW != null && firstW != null && (latestCh?.month !== firstCh?.month || (!latestCh && latestWk))
    ? Math.round((currentW - firstW) * 10) / 10 : null;

  // Objetivo
  let goalW = null;
  if (phase) {
    const m = (phase.goal || '').match(/(\d{2,3}(?:[.,]\d)?)\s*kg/i);
    if (m) goalW = Number(m[1].replace(',','.'));
  }

  // Gráfica
  const monthlyPts = checkins.filter((c) => c.weight != null).map((c) => ({
    label: monthLabel(c.month), Peso: Number(c.weight),
  }));
  const weeklyPts  = weeks.filter((w) => w.real_weight != null).map((w) => ({
    label: fmtDate(w.week_start), Peso: Number(w.real_weight),
  }));
  const chartData = monthlyPts.length >= 2 ? monthlyPts : weeklyPts;
  const pesos     = chartData.map((d) => d.Peso);
  const domainMin = pesos.length ? Math.floor(Math.min(...pesos, goalW ?? Infinity) - 2) : 60;
  const domainMax = pesos.length ? Math.ceil(Math.max(...pesos) + 1) : 100;

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="border-b border-border px-4 py-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
            style={{ background: `${color}20`, color, border: `1px solid ${color}` }}>
            {cliente.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <div className="text-ink font-bold text-lg leading-tight">{cliente.name}</div>
            <div className="text-muted text-xs">{cliente.program || 'Chris Fitness'}</div>
          </div>
          {phase && (
            <span className="ml-auto text-xs font-bold px-2.5 py-1 rounded-lg"
              style={{ background: `${color}18`, color }}>{phase.name}</span>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Métricas principales */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl p-4" style={{ background: 'var(--color-surfaceAlt)', border: '1px solid var(--color-border)' }}>
            <div className="text-muted text-[10px] uppercase tracking-widest mb-1">Peso actual</div>
            <div className="text-cyan text-2xl font-bold">{currentW != null ? `${currentW} kg` : '—'}</div>
          </div>
          <div className="rounded-xl p-4" style={{ background: 'var(--color-surfaceAlt)', border: '1px solid var(--color-border)' }}>
            <div className="text-muted text-[10px] uppercase tracking-widest mb-1">Desde el inicio</div>
            <div className="text-2xl font-bold" style={{ color: diff == null ? 'var(--color-muted)' : diff < 0 ? '#4ADE80' : '#F87171' }}>
              {diff != null ? `${diff > 0 ? '+' : ''}${diff} kg` : '—'}
            </div>
          </div>
          <div className="rounded-xl p-4" style={{ background: 'var(--color-surfaceAlt)', border: '1px solid var(--color-border)' }}>
            <div className="text-muted text-[10px] uppercase tracking-widest mb-1">Fase</div>
            <div className="text-2xl font-bold" style={{ color }}>{phase?.name || '—'}</div>
          </div>
        </div>

        {/* Objetivo del cliente */}
        {(cliente.long_term_goal || phase?.goal) && (
          <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--color-surfaceAlt)', border: '1px solid var(--color-border)' }}>
            {cliente.long_term_goal && (
              <div className="flex gap-3">
                <div className="w-0.5 rounded-full self-stretch" style={{ background: '#5ECCFA' }} />
                <div>
                  <div className="text-cyan text-[10px] font-bold mb-0.5">TU OBJETIVO</div>
                  <div className="text-ink text-sm leading-relaxed">{cliente.long_term_goal}</div>
                </div>
              </div>
            )}
            {phase?.goal && (
              <div className="flex gap-3">
                <div className="w-0.5 rounded-full self-stretch" style={{ background: color }} />
                <div>
                  <div className="text-[10px] font-bold mb-0.5" style={{ color }}>OBJETIVO FASE ACTUAL</div>
                  <div className="text-ink text-sm leading-relaxed">{phase.goal}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Gráfica */}
        {chartData.length >= 2 && (
          <div className="rounded-xl p-4" style={{ background: '#0D1117', border: '1px solid var(--color-border)' }}>
            <div className="text-muted text-[10px] font-semibold uppercase tracking-widest mb-4">Progreso de peso</div>
            <div className="w-full h-[200px]">
              <ResponsiveContainer>
                <AreaChart data={chartData} margin={{ top:5, right:12, left:-10, bottom:0 }}>
                  <defs>
                    <linearGradient id="pub-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#5ECCFA" stopOpacity={0.22} />
                      <stop offset="85%"  stopColor="#5ECCFA" stopOpacity={0.03} />
                      <stop offset="100%" stopColor="#5ECCFA" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1C2226" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill:'#5A6870', fontSize:11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill:'#5A6870', fontSize:11 }} tickLine={false} axisLine={false} domain={[domainMin, domainMax]} width={28} />
                  <Tooltip contentStyle={{ background:'#0D1117', border:'1px solid #1C2226', borderRadius:8, fontSize:12 }}
                    labelStyle={{ color:'#C8D5DA' }} itemStyle={{ color:'#5ECCFA' }}
                    formatter={(v) => [`${v} kg`,'Peso']} />
                  {goalW != null && (
                    <ReferenceLine y={goalW} stroke="#4ADE80" strokeDasharray="6 4" strokeWidth={1.5}
                      label={{ value:`Objetivo ${goalW}kg`, position:'insideBottomRight', fill:'#4ADE80', fontSize:10, dy:-6 }} />
                  )}
                  <Area type="monotone" dataKey="Peso" stroke="#5ECCFA" strokeWidth={2.5} fill="url(#pub-fill)"
                    dot={{ r:4, fill:'#5ECCFA', stroke:'#0D1117', strokeWidth:2 }}
                    activeDot={{ r:5, fill:'#5ECCFA', stroke:'#0D1117', strokeWidth:2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Mes actual */}
        {currentCheckin && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
            <div className="px-4 py-3" style={{ background: 'var(--color-surfaceAlt)' }}>
              <div className="text-ink font-bold text-sm">{monthLabelFull(currentCheckin.month)}</div>
              {currentCheckin.phase && <div className="text-muted text-xs mt-0.5">{currentCheckin.phase}</div>}
            </div>
            <div className="px-4 py-4 space-y-3" style={{ background: 'var(--color-bg)' }}>
              {/* Semanas */}
              {(currentCheckin.weekly_notes || []).filter((w) => w.strength || w.note).map((w, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                    style={{ background: STRENGTH_COLOR[w.strength] || 'var(--color-border)' }} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-ink text-xs font-semibold">{w.label}</span>
                      {w.strength && <span className="text-xs font-bold" style={{ color: STRENGTH_COLOR[w.strength] }}>{w.strength}</span>}
                    </div>
                    {w.note && <div className="text-muted text-xs mt-0.5">{w.note}</div>}
                  </div>
                </div>
              ))}
              {/* Objetivo */}
              {currentCheckin.goals && (
                <div className="rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--color-surfaceAlt)' }}>
                  <span className="text-muted text-[10px] uppercase tracking-widest block mb-1">Objetivo del mes</span>
                  <span className="text-ink">{currentCheckin.goals}</span>
                  {currentCheckin.goal_status && GOAL_COLORS[currentCheckin.goal_status] && (
                    <span className="ml-2 text-xs font-bold" style={{ color: GOAL_COLORS[currentCheckin.goal_status] }}>
                      · {currentCheckin.goal_status}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="text-center text-muted text-[10px] pb-4">
          Seguimiento generado por Chris Fitness · Este enlace es privado
        </div>
      </main>
    </div>
  );
}
