'use client';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, LineChart, Line,
} from 'recharts';
import {
  phaseForDate, phaseColor, todayISO, mondayOf, fmtDate,
  STRENGTH_COLOR, GOAL_COLORS, monthLabelFull, calcKcalMedia, calcKcalFromMacros,
} from '@/lib/timeline';

const MONTH_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
function monthLabel(ym) {
  if (!ym) return '';
  const [,mm] = ym.split('-');
  return MONTH_SHORT[Number(mm)-1] || '';
}

export default function VistaPublicaClient({ cliente }) {
  const today  = todayISO();
  const phases = cliente.phases || [];
  const phase  = phaseForDate(phases, today);
  const color  = phase ? phaseColor(phases, phase.name) : '#7C878B';

  const checkins = [...(cliente.tracking_checkins || [])].filter((c) => c.month).sort((a,b) => a.month.localeCompare(b.month));
  const weeks    = [...(cliente.tracking_timeline_weeks || [])].sort((a,b) => a.week_start.localeCompare(b.week_start));
  const thisMonth = today.slice(0,7);
  const currentCheckin = [...checkins].reverse().find((c) => c.month === thisMonth) || checkins[checkins.length - 1];

  // Peso actual e inicio
  const latestCh = [...checkins].reverse().find((c) => c.weight != null);
  const firstCh  = checkins.find((c) => c.weight != null);
  const latestWk = [...weeks].reverse().find((w) => w.real_weight != null);
  const currentW = latestCh?.weight ?? latestWk?.real_weight ?? null;
  const firstW   = firstCh?.weight ?? weeks.find((w) => w.real_weight != null)?.real_weight ?? null;
  const diff     = currentW != null && firstW != null && latestCh?.month !== firstCh?.month
    ? Math.round((currentW - firstW) * 10) / 10 : null;

  // Objetivo de peso de la fase
  let goalW = null;
  if (phase) {
    const m = (phase.goal || '').match(/(\d{2,3}(?:[.,]\d)?)\s*kg/i);
    if (m) goalW = Number(m[1].replace(',','.'));
  }

  // Gráfica de peso
  const monthlyPts = checkins.filter((c) => c.weight != null).map((c) => ({
    label: monthLabel(c.month), Peso: Number(c.weight),
  }));
  const weeklyPts = weeks.filter((w) => w.real_weight != null).map((w) => ({
    label: fmtDate(w.week_start), Peso: Number(w.real_weight),
  }));
  const chartData = monthlyPts.length >= 2 ? monthlyPts : weeklyPts;
  const pesos     = chartData.map((d) => d.Peso);
  const domainMin = pesos.length ? Math.floor(Math.min(...pesos, goalW ?? Infinity) - 2) : 60;
  const domainMax = pesos.length ? Math.ceil(Math.max(...pesos) + 1) : 100;

  // Semanas del mes actual
  const weekNotes = (currentCheckin?.weekly_notes || []).filter((w) => w.strength || w.note || w.steps);

  // Adherencia media
  const adherencias = (currentCheckin?.weekly_notes || []).map((w) => w.adherence).filter((v) => v != null);
  const avgAdherencia = adherencias.length ? Math.round(adherencias.reduce((a,b)=>a+b,0)/adherencias.length) : null;

  // Pasos media
  const stepsArr = (currentCheckin?.weekly_notes || []).map((w) => w.steps).filter((v) => v != null);
  const avgSteps = stepsArr.length ? Math.round(stepsArr.reduce((a,b)=>a+b,0)/stepsArr.length) : null;

  // Racha de semanas fuertes consecutivas
  const allWeekNotes = checkins.flatMap((c) => c.weekly_notes || []).filter((w) => w.strength);
  const reversed     = [...allWeekNotes].reverse();
  let racha = 0;
  for (const w of reversed) {
    if (w.strength === 'Fuerte') racha++; else break;
  }

  // Porcentaje semanas fuertes del mes actual
  const semanasMes = (currentCheckin?.weekly_notes || []).filter((w) => w.strength);
  const fuertesMes = semanasMes.filter((w) => w.strength === 'Fuerte').length;
  const pctFuertes = semanasMes.length ? Math.round((fuertesMes / semanasMes.length) * 100) : null;

  return (
    <div className="min-h-screen" style={{ background: '#050708', color: '#F2F6F7', fontFamily: 'Inter, sans-serif' }}>

      {/* Header */}
      <div style={{ borderBottom: '1px solid #212729', padding: '16px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${color}20`, color, border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, flexShrink: 0 }}>
            {cliente.name?.[0]?.toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{cliente.name}</div>
            <div style={{ color: '#7C878B', fontSize: 12 }}>Chris Fitness · Seguimiento personal</div>
          </div>
          {phase && (
            <div style={{ background: `${color}18`, color, padding: '4px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>
              {phase.name}
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Cards principales */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[
            { label: 'Peso actual', val: currentW != null ? `${currentW} kg` : '—', col: '#5ECCFA' },
            { label: 'Cambio total', val: diff != null ? `${diff > 0 ? '+' : ''}${diff} kg` : '—', col: diff == null ? '#7C878B' : diff < 0 ? '#4ADE80' : '#F87171' },
            { label: 'Fase', val: phase?.name || '—', col: color },
          ].map((s) => (
            <div key={s.label} style={{ background: '#151A1D', border: '1px solid #212729', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ fontSize: 9, color: '#7C878B', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.col }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* Stats de compromiso */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {/* Racha */}
          <div style={{ background: '#151A1D', border: '1px solid #212729', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 9, color: '#7C878B', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>🔥 Racha semanas fuertes</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: racha > 0 ? '#4ADE80' : '#7C878B' }}>{racha}</div>
            <div style={{ fontSize: 10, color: '#7C878B' }}>semanas consecutivas</div>
          </div>
          {/* % semanas fuertes */}
          <div style={{ background: '#151A1D', border: '1px solid #212729', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 9, color: '#7C878B', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>💪 Semanas fuertes</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: pctFuertes >= 75 ? '#4ADE80' : pctFuertes >= 50 ? '#FBBF24' : '#F87171' }}>
              {pctFuertes != null ? `${pctFuertes}%` : '—'}
            </div>
            <div style={{ fontSize: 10, color: '#7C878B' }}>este mes ({fuertesMes}/{semanasMes.length} semanas)</div>
          </div>
          {/* Pasos media */}
          {avgSteps != null && (
            <div style={{ background: '#151A1D', border: '1px solid #212729', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ fontSize: 9, color: '#7C878B', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>👣 Media pasos/día</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#4ADE80' }}>{avgSteps.toLocaleString()}</div>
            </div>
          )}
          {/* Adherencia */}
          {avgAdherencia != null && (
            <div style={{ background: '#151A1D', border: '1px solid #212729', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ fontSize: 9, color: '#7C878B', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>🎯 Adherencia media</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#A78BFA' }}>{avgAdherencia}%</div>
              {/* Barra */}
              <div style={{ height: 4, background: '#212729', borderRadius: 4, marginTop: 6 }}>
                <div style={{ height: 4, background: '#A78BFA', borderRadius: 4, width: `${Math.min(avgAdherencia, 100)}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Objetivo */}
        {(cliente.long_term_goal || phase?.goal) && (
          <div style={{ background: '#151A1D', border: '1px solid #212729', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cliente.long_term_goal && (
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ width: 3, background: '#5ECCFA', borderRadius: 4, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 9, color: '#5ECCFA', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>Tu objetivo</div>
                  <div style={{ fontSize: 13 }}>{cliente.long_term_goal}</div>
                </div>
              </div>
            )}
            {phase?.goal && (
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ width: 3, background: color, borderRadius: 4, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3, color }}>Objetivo de fase</div>
                  <div style={{ fontSize: 13 }}>{phase.goal}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Gráfica de peso */}
        {chartData.length >= 2 && (
          <div style={{ background: '#0D1117', border: '1px solid #212729', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 9, color: '#7C878B', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>Progreso de peso</div>
            <div style={{ height: 180 }}>
              <ResponsiveContainer>
                <AreaChart data={chartData} margin={{ top:5, right:8, left:-12, bottom:0 }}>
                  <defs>
                    <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#5ECCFA" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#5ECCFA" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1C2226" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill:'#5A6870', fontSize:10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill:'#5A6870', fontSize:10 }} tickLine={false} axisLine={false} domain={[domainMin, domainMax]} width={26} />
                  <Tooltip contentStyle={{ background:'#0D1117', border:'1px solid #1C2226', borderRadius:8, fontSize:12 }}
                    labelStyle={{ color:'#C8D5DA' }} itemStyle={{ color:'#5ECCFA' }}
                    formatter={(v) => [`${v} kg`,'Peso']} />
                  {goalW != null && (
                    <ReferenceLine y={goalW} stroke="#4ADE80" strokeDasharray="6 4" strokeWidth={1.5}
                      label={{ value:`Objetivo ${goalW}kg`, position:'insideBottomRight', fill:'#4ADE80', fontSize:9, dy:-5 }} />
                  )}
                  <Area type="monotone" dataKey="Peso" stroke="#5ECCFA" strokeWidth={2.5} fill="url(#pg)"
                    dot={{ r:4, fill:'#5ECCFA', stroke:'#0D1117', strokeWidth:2 }}
                    activeDot={{ r:5, fill:'#5ECCFA', stroke:'#0D1117', strokeWidth:2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Mes actual */}
        {currentCheckin && (
          <div style={{ background: '#151A1D', border: '1px solid #212729', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: '#0E1214', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{monthLabelFull(currentCheckin.month)}</div>
                {currentCheckin.phase && <div style={{ color: '#7C878B', fontSize: 11, marginTop: 1 }}>{currentCheckin.phase}</div>}
              </div>
              {currentCheckin.goal_status && GOAL_COLORS[currentCheckin.goal_status] && (
                <div style={{ fontSize: 11, fontWeight: 700, color: GOAL_COLORS[currentCheckin.goal_status] }}>
                  {currentCheckin.goal_status}
                </div>
              )}
            </div>
            <div style={{ padding: '12px 16px' }}>
              {weekNotes.map((w, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: i < weekNotes.length - 1 ? 10 : 0 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: STRENGTH_COLOR[w.strength] || '#212729', marginTop: 4, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{w.label || `Semana ${i+1}`}</span>
                      {w.strength && <span style={{ fontSize: 10, fontWeight: 700, color: STRENGTH_COLOR[w.strength] }}>{w.strength}</span>}
                    </div>
                    {w.note && <div style={{ color: '#7C878B', fontSize: 11, marginTop: 2 }}>{w.note}</div>}
                    <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                      {w.steps != null && <span style={{ fontSize: 10, color: '#4ADE80' }}>👣 {w.steps.toLocaleString()} pasos</span>}
                      {w.adherence != null && <span style={{ fontSize: 10, color: '#A78BFA' }}>🎯 {w.adherence}% adherencia</span>}
                      {calcKcalMedia(w.kcal_on ?? calcKcalFromMacros(w.protein_on, w.carbs_on, w.fat_on), w.kcal_off ?? calcKcalFromMacros(w.protein_off, w.carbs_off, w.fat_off), w.dias_on) != null && (
                        <span style={{ fontSize: 10, color: '#FBBF24' }}>🔥 {calcKcalMedia(w.kcal_on ?? calcKcalFromMacros(w.protein_on, w.carbs_on, w.fat_on), w.kcal_off ?? calcKcalFromMacros(w.protein_off, w.carbs_off, w.fat_off), w.dias_on)} kcal/día</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {currentCheckin.goals && (
                <div style={{ marginTop: 12, padding: '10px 12px', background: '#0E1214', borderRadius: 8 }}>
                  <div style={{ fontSize: 9, color: '#7C878B', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Objetivo del mes</div>
                  <div style={{ fontSize: 13 }}>{currentCheckin.goals}
                    {currentCheckin.goal_status && GOAL_COLORS[currentCheckin.goal_status] && (
                      <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: GOAL_COLORS[currentCheckin.goal_status] }}>
                        · {currentCheckin.goal_status}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', color: '#5A6870', fontSize: 10, padding: '8px 0 16px' }}>
          Seguimiento generado por Chris Fitness · Este enlace es privado
        </div>
      </div>
    </div>
  );
}
