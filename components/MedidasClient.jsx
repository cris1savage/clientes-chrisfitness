'use client';

import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import { MEASUREMENTS } from '@/lib/timeline';

const MONTH_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
function monthLabel(ym) {
  const [, mm] = ym.split('-');
  return MONTH_SHORT[Number(mm) - 1];
}

const MEASURE_COLORS = {
  Cuello: '#5ECCFA', Hombros: '#A78BFA', Pecho: '#4ADE80',
  'Bíceps izq': '#FBBF24', 'Bíceps der': '#FB923C',
  'Antebrazo izq': '#F87171', 'Antebrazo der': '#F472B6',
  Cintura: '#FBBF24', Cadera: '#A78BFA',
  'Muslo izq': '#34D399', 'Muslo der': '#6EE7B7',
  'Gemelo izq': '#93C5FD', 'Gemelo der': '#BAE6FD',
};

const TABS_VIEW = ['Medidas', 'Peso'];

export default function MedidasClient({ checkins, weeklyWeights }) {
  const [selected,  setSelected]  = useState('Cintura');
  const [activeTab, setActiveTab] = useState('Medidas');

  // Ordenar de más reciente a más antiguo
  const sortedDesc = [...checkins].sort((a, b) => b.month.localeCompare(a.month));
  const sortedAsc  = [...checkins].sort((a, b) => a.month.localeCompare(b.month));

  // Última y penúltima medición de cada parte
  const lastMeasurements = {};
  const prevMeasurements = {};
  sortedDesc.forEach((c) => {
    if (!c.measurements) return;
    Object.entries(c.measurements).forEach(([k, v]) => {
      if (v == null) return;
      if (lastMeasurements[k] == null) lastMeasurements[k] = { val: v, month: c.month };
      else if (prevMeasurements[k] == null) prevMeasurements[k] = { val: v, month: c.month };
    });
  });

  // Serie para la gráfica de medida seleccionada
  const serieMedida = sortedAsc
    .filter((c) => c.measurements?.[selected] != null)
    .map((c) => ({ label: monthLabel(c.month), valor: Number(c.measurements[selected]) }));

  const firstVal  = serieMedida.length ? serieMedida[0].valor : null;
  const lastVal   = serieMedida.length ? serieMedida[serieMedida.length - 1].valor : null;
  const totalDiff = firstVal != null && lastVal != null && serieMedida.length >= 2
    ? Math.round((lastVal - firstVal) * 10) / 10 : null;

  // Historial de pesos — fusionar checkins mensuales + pesos diarios del registro
  const weightHistory = (() => {
    const entries = [];
    // Pesos diarios del registro semanal
    if (weeklyWeights && weeklyWeights.length > 0) {
      weeklyWeights.forEach((w) => {
        entries.push({ date: w.date, peso: w.weight, source: 'diario' });
      });
    }
    // Pesos mensuales de los checkins
    sortedAsc.filter((c) => c.weight != null).forEach((c) => {
      entries.push({ date: c.month + '-01', peso: c.weight, label: monthLabel(c.month) + ' ' + c.month.split('-')[0], source: 'mensual' });
    });
    return entries.sort((a, b) => a.date.localeCompare(b.date));
  })();

  // Serie para la gráfica de peso
  const serieCheckins = sortedAsc
    .filter((c) => c.weight != null)
    .map((c) => ({ label: monthLabel(c.month), peso: Number(c.weight) }));

  const pesoMin = serieCheckins.length ? Math.floor(Math.min(...serieCheckins.map(d => d.peso)) - 1) : 60;
  const pesoMax = serieCheckins.length ? Math.ceil(Math.max(...serieCheckins.map(d => d.peso)) + 1) : 100;

  return (
    <div className="space-y-5">

      {/* Tabs Medidas / Peso */}
      <div className="flex gap-1">
        {TABS_VIEW.map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: activeTab === t ? 'var(--color-cyan)' : 'var(--color-surfaceAlt)',
              color:      activeTab === t ? '#00161C' : 'var(--color-muted)',
              border:     `1px solid ${activeTab === t ? 'var(--color-cyan)' : 'var(--color-border)'}`,
            }}>{t}</button>
        ))}
      </div>

      {/* ── TAB MEDIDAS ── */}
      {activeTab === 'Medidas' && (
        <>
          {/* Tabla resumen */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
            <div className="grid grid-cols-[1fr_70px_70px_50px] px-4 py-2.5 text-muted text-[10px] uppercase tracking-widest"
              style={{ background: 'var(--color-surfaceAlt)' }}>
              <div>Medida</div>
              <div className="text-right">Actual</div>
              <div className="text-right">Anterior</div>
              <div className="text-right">Dif.</div>
            </div>
            {MEASUREMENTS.map((m, idx) => {
              const last = lastMeasurements[m];
              const prev = prevMeasurements[m];
              const diff = last && prev ? Math.round((last.val - prev.val) * 10) / 10 : null;
              const isSel = selected === m;
              return (
                <button key={m} onClick={() => setSelected(m)}
                  className="w-full grid grid-cols-[1fr_70px_70px_50px] px-4 py-2.5 items-center text-left transition-all"
                  style={{
                    background: isSel ? `${MEASURE_COLORS[m]}12` : idx % 2 === 0 ? 'var(--color-bg)' : 'var(--color-surface)',
                    borderTop: '1px solid var(--color-border)',
                    borderLeft: `2px solid ${isSel ? MEASURE_COLORS[m] : 'transparent'}`,
                  }}>
                  <span className="text-sm font-semibold" style={{ color: isSel ? MEASURE_COLORS[m] : 'var(--color-ink)' }}>{m}</span>
                  <span className="text-right text-sm font-bold" style={{ color: last ? 'var(--color-ink)' : 'var(--color-muted)' }}>
                    {last ? `${last.val}` : '—'}
                  </span>
                  <span className="text-right text-sm text-muted">{prev ? `${prev.val}` : '—'}</span>
                  <span className="text-right text-xs font-bold"
                    style={{ color: diff == null ? 'var(--color-muted)' : diff < 0 ? 'var(--color-green)' : diff > 0 ? 'var(--color-red)' : 'var(--color-muted)' }}>
                    {diff != null ? `${diff > 0 ? '+' : ''}${diff}` : '—'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Gráfica medida seleccionada */}
          <div className="rounded-xl p-4" style={{ background: '#0D1117', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-muted text-[10px] font-semibold uppercase tracking-widest">
                Evolución · <span style={{ color: MEASURE_COLORS[selected] }}>{selected}</span>
              </div>
              {totalDiff != null && (
                <div className="text-xs font-bold"
                  style={{ color: totalDiff < 0 ? 'var(--color-green)' : totalDiff > 0 ? 'var(--color-red)' : 'var(--color-muted)' }}>
                  Total: {totalDiff > 0 ? '+' : ''}{totalDiff} cm
                </div>
              )}
            </div>
            {serieMedida.length < 2 ? (
              <div className="flex items-center justify-center h-28 text-muted text-sm">
                {serieMedida.length === 0 ? `Sin registros de ${selected}` : 'Necesitas al menos 2 meses para ver la gráfica'}
              </div>
            ) : (
              <div className="w-full h-[180px]">
                <ResponsiveContainer>
                  <LineChart data={serieMedida} margin={{ top: 5, right: 12, left: -10, bottom: 0 }}>
                    <CartesianGrid stroke="#1C2226" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#5A6870', fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#5A6870', fontSize: 11 }} tickLine={false} axisLine={false} width={30}
                      domain={['dataMin - 1', 'dataMax + 1']} />
                    <Tooltip
                      contentStyle={{ background: '#0D1117', border: '1px solid #1C2226', borderRadius: 8, fontSize: 12 }}
                      formatter={(v) => [`${v} cm`, selected]} />
                    <Line type="monotone" dataKey="valor"
                      stroke={MEASURE_COLORS[selected]} strokeWidth={2.5}
                      dot={{ r: 4, fill: MEASURE_COLORS[selected], stroke: '#0D1117', strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Historial de mediciones */}
          <div className="space-y-2">
            <div className="text-muted text-[10px] uppercase tracking-widest">Historial de mediciones</div>
            {sortedDesc.filter((c) => c.measurements && Object.values(c.measurements).some((v) => v != null)).map((c) => (
              <div key={c.month} className="rounded-xl p-4" style={{ background: 'var(--color-surfaceAlt)', border: '1px solid var(--color-border)' }}>
                <div className="text-ink text-xs font-bold mb-2">
                  {MONTH_SHORT[Number(c.month.split('-')[1]) - 1]} {c.month.split('-')[0]}
                  {c.weight && <span className="text-cyan ml-2">{c.weight} kg</span>}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {Object.entries(c.measurements).filter(([, v]) => v != null).map(([k, v]) => (
                    <div key={k} className="text-xs">
                      <span className="text-muted">{k}: </span>
                      <span className="font-semibold" style={{ color: k === selected ? MEASURE_COLORS[k] : 'var(--color-ink)' }}>{v} cm</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── TAB PESO ── */}
      {activeTab === 'Peso' && (
        <>
          {/* Gráfica de evolución de peso */}
          {serieCheckins.length >= 2 && (
            <div className="rounded-xl p-4" style={{ background: '#0D1117', border: '1px solid var(--color-border)' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="text-muted text-[10px] font-semibold uppercase tracking-widest">Evolución de peso</div>
                {serieCheckins.length >= 2 && (
                  <div className="text-xs font-bold"
                    style={{ color: (serieCheckins[serieCheckins.length-1].peso - serieCheckins[0].peso) < 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                    Total: {((serieCheckins[serieCheckins.length-1].peso - serieCheckins[0].peso) > 0 ? '+' : '') +
                      Math.round((serieCheckins[serieCheckins.length-1].peso - serieCheckins[0].peso) * 10) / 10} kg
                  </div>
                )}
              </div>
              <div className="w-full h-[200px]">
                <ResponsiveContainer>
                  <AreaChart data={serieCheckins} margin={{ top: 5, right: 12, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="pg-weight" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#5ECCFA" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="#5ECCFA" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1C2226" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#5A6870', fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#5A6870', fontSize: 11 }} tickLine={false} axisLine={false}
                      domain={[pesoMin, pesoMax]} width={28} />
                    <Tooltip
                      contentStyle={{ background: '#0D1117', border: '1px solid #1C2226', borderRadius: 8, fontSize: 12 }}
                      formatter={(v) => [`${v} kg`, 'Peso']} />
                    <Area type="monotone" dataKey="peso" stroke="#5ECCFA" strokeWidth={2.5} fill="url(#pg-weight)"
                      dot={{ r: 4, fill: '#5ECCFA', stroke: '#0D1117', strokeWidth: 2 }}
                      activeDot={{ r: 5, fill: '#5ECCFA', stroke: '#0D1117', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Historial de pesos cronológico */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
            <div className="grid grid-cols-[1fr_80px_80px] px-4 py-2.5 text-muted text-[10px] uppercase tracking-widest"
              style={{ background: 'var(--color-surfaceAlt)' }}>
              <div>Mes</div>
              <div className="text-right">Peso</div>
              <div className="text-right">Cambio</div>
            </div>
            {sortedDesc.filter((c) => c.weight != null).map((c, idx, arr) => {
              const prev = arr[idx + 1];
              const diff = prev ? Math.round((c.weight - prev.weight) * 10) / 10 : null;
              return (
                <div key={c.month}
                  className="grid grid-cols-[1fr_80px_80px] px-4 py-3 items-center"
                  style={{ borderTop: '1px solid var(--color-border)', background: idx % 2 === 0 ? 'var(--color-bg)' : 'var(--color-surface)' }}>
                  <span className="text-sm font-semibold">{MONTH_SHORT[Number(c.month.split('-')[1]) - 1]} {c.month.split('-')[0]}</span>
                  <span className="text-right text-sm font-bold text-cyan">{c.weight} kg</span>
                  <span className="text-right text-sm font-bold"
                    style={{ color: diff == null ? 'var(--color-muted)' : diff < 0 ? 'var(--color-green)' : diff > 0 ? 'var(--color-red)' : 'var(--color-muted)' }}>
                    {diff != null ? `${diff > 0 ? '+' : ''}${diff}` : '—'}
                  </span>
                </div>
              );
            })}
            {sortedDesc.filter((c) => c.weight != null).length === 0 && (
              <div className="text-center py-8 text-muted text-sm">Sin registros de peso todavía.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
