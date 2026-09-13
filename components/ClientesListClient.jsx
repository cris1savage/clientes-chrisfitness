'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Plus, LogOut, TrendingDown, TrendingUp, Minus,
  ChevronRight, AlertTriangle, Bell, Calendar, Users, CheckCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { phaseColor, todayISO, mondayOf, addDaysISO } from '@/lib/timeline';
import NuevoClienteModal from './NuevoClienteModal';

/* ─── helpers ─────────────────────────────────────────────── */
function getLatestWeight(c) {
  const ch = (c.client_checkins || []).filter((x) => x.weight != null).sort((a, b) => b.month.localeCompare(a.month));
  if (ch[0]) return ch[0].weight;
  const wk = (c.client_timeline_weeks || []).filter((x) => x.real_weight != null).sort((a, b) => b.week_start.localeCompare(a.week_start));
  return wk[0]?.real_weight ?? null;
}

function getWeightDiff(c) {
  const ch = (c.client_checkins || []).filter((x) => x.weight != null).sort((a, b) => a.month.localeCompare(b.month));
  if (ch.length >= 2) return Math.round((ch[ch.length - 1].weight - ch[0].weight) * 10) / 10;
  return null;
}

function getCurrentPhase(c) {
  const today = todayISO();
  return (c.phases || []).find((p) => today >= p.start_date && today <= p.end_date) || null;
}

function getGoalStatus(c) {
  const m = todayISO().slice(0, 7);
  return (c.client_checkins || []).find((x) => x.month === m)?.goal_status || null;
}

function daysSinceWeight(c) {
  const today = todayISO();
  // Buscar el registro más reciente con peso en checkins mensuales
  const ch = (c.client_checkins || []).filter((x) => x.weight != null).sort((a, b) => b.month.localeCompare(a.month));
  if (ch[0]) {
    // Calculamos desde el primer día del mes más reciente con peso
    const d = new Date(`${ch[0].month}-01T00:00:00`);
    const diff = (new Date(today) - d) / 86400000;
    return Math.floor(diff);
  }
  // Si no, miramos el real_weight más reciente del timeline
  const wk = (c.client_timeline_weeks || []).filter((x) => x.real_weight != null).sort((a, b) => b.week_start.localeCompare(a.week_start));
  if (wk[0]) {
    const diff = (new Date(today) - new Date(`${wk[0].week_start}T00:00:00`)) / 86400000;
    return Math.floor(diff);
  }
  return 999;
}

function nextCall(c) {
  const today = todayISO();
  const upcoming = (c.client_checkins || [])
    .filter((x) => x.call_date && x.call_date >= today && !x.call_done)
    .sort((a, b) => a.call_date.localeCompare(b.call_date));
  return upcoming[0]?.call_date || null;
}

function daysUntil(dateISO) {
  return Math.ceil((new Date(`${dateISO}T00:00:00`) - new Date()) / 86400000);
}

const GOAL_COLOR = { Cumplido: '#4ADE80', Parcial: '#FBBF24', 'No cumplido': '#F87171' };

/* ─── componente principal ───────────────────────────────── */
export default function ClientesListClient({ clientes }) {
  const router = useRouter();
  const [search,    setSearch]    = useState('');
  const [showNuevo, setShowNuevo] = useState(false);
  const [view,      setView]      = useState('lista'); // 'lista' | 'alertas' | 'semana'

  const today       = todayISO();
  const thisMonth   = today.slice(0, 7);
  const thisWeekStart = mondayOf(today);

  /* ── alertas ── */
  const alertas = useMemo(() => {
    const out = [];
    clientes.forEach((c) => {
      const dias = daysSinceWeight(c);
      if (dias > 14) out.push({ tipo: 'sin_peso', cliente: c, valor: dias });

      const call = nextCall(c);
      if (call) {
        const d = daysUntil(call);
        if (d <= 3) out.push({ tipo: 'llamada', cliente: c, valor: call, dias: d });
      }

      const gs = getGoalStatus(c);
      if (gs === 'No cumplido') out.push({ tipo: 'objetivo', cliente: c });

      const hasMonth = (c.client_checkins || []).some((x) => x.month === thisMonth);
      if (!hasMonth) out.push({ tipo: 'sin_mes', cliente: c });
    });
    return out;
  }, [clientes, thisMonth]);

  /* ── parte semanal ── */
  const semana = useMemo(() => clientes.map((c) => {
    const week = (c.client_timeline_weeks || []).find((w) => w.week_start === thisWeekStart);
    const realW = week?.real_weight;
    const targetW = week?.target_weight;
    const diff = realW != null && targetW != null ? Math.round((realW - targetW) * 10) / 10 : null;
    return { c, week, realW, targetW, diff };
  }), [clientes, thisWeekStart]);

  /* ── lista filtrada ── */
  const filtered = useMemo(() =>
    clientes.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())),
    [clientes, search]
  );

  const handleLogout = async () => {
    await createClient().auth.signOut();
    router.push('/login'); router.refresh();
  };

  return (
    <div className="min-h-screen bg-bg">
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <div className="font-display text-ink text-xl tracking-wide leading-none">CF CLIENTES</div>
            <div className="text-violet text-[10px] tracking-widest uppercase mt-0.5">Seguimiento · Chris Fitness</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowNuevo(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ background: 'var(--color-violet)', color: '#0D0A1F' }}>
              <Plus size={13} /> Añadir
            </button>
            <button onClick={handleLogout} className="p-2 text-muted hover:text-ink" title="Cerrar sesión">
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* ── Tabs de vista ── */}
        <div className="max-w-4xl mx-auto px-4 flex gap-1 pb-0 overflow-x-auto">
          {[
            { key: 'lista',   label: 'Clientes',  icon: Users    },
            { key: 'alertas', label: `Alertas${alertas.length ? ` (${alertas.length})` : ''}`, icon: Bell },
            { key: 'semana',  label: 'Esta semana', icon: Calendar },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setView(key)}
              className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors"
              style={{
                borderColor: view === key ? 'var(--color-cyan)' : 'transparent',
                color: view === key ? 'var(--color-cyan)' : 'var(--color-muted)',
              }}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">

        {/* ══════════════ VISTA LISTA ══════════════ */}
        {view === 'lista' && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Activos',           value: clientes.length },
                { label: 'Objetivo cumplido', value: clientes.filter((c) => getGoalStatus(c) === 'Cumplido').length },
                { label: 'Sin mes actual',    value: clientes.filter((c) => !(c.client_checkins || []).some((x) => x.month === thisMonth)).length },
              ].map((s) => (
                <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: 'var(--color-surfaceAlt)', border: '1px solid var(--color-border)' }}>
                  <div className="text-ink text-xl font-bold">{s.value}</div>
                  <div className="text-muted text-[10px] mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Buscador */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder={`Buscar entre ${clientes.length} clientes…`}
                className="w-full bg-surface border border-border text-ink rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-cyan" />
            </div>

            {/* Lista */}
            {filtered.length === 0
              ? <div className="text-center py-12 text-muted text-sm">No se encontraron clientes.</div>
              : (
                <div className="space-y-2">
                  {filtered.map((c) => {
                    const w    = getLatestWeight(c);
                    const diff = getWeightDiff(c);
                    const ph   = getCurrentPhase(c);
                    const gs   = getGoalStatus(c);
                    const dias = daysSinceWeight(c);
                    const col  = ph ? phaseColor([], ph.name) : 'var(--color-muted)';

                    return (
                      <button key={c.id} onClick={() => router.push(`/clientes/${c.id}`)}
                        className="w-full text-left rounded-xl p-4"
                        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                        <div className="flex items-center gap-3">
                          {/* Avatar */}
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                            style={{ background: `${col}20`, color: col, border: `1px solid ${col}` }}>
                            {c.name?.[0]?.toUpperCase()}
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-ink font-semibold text-sm">{c.name}</span>
                              {ph && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                  style={{ background: `${col}18`, color: col }}>{ph.name}</span>
                              )}
                              {gs && GOAL_COLOR[gs] && (
                                <span className="text-[10px] font-bold" style={{ color: GOAL_COLOR[gs] }}>{gs}</span>
                              )}
                              {dias > 14 && (
                                <span className="text-[10px] font-bold text-amber flex items-center gap-0.5">
                                  <AlertTriangle size={10} /> {dias}d sin peso
                                </span>
                              )}
                            </div>
                            <div className="text-muted text-xs mt-0.5">{c.program || 'Sin programa'}</div>
                          </div>
                          {/* Peso */}
                          <div className="text-right shrink-0">
                            {w != null ? (
                              <>
                                <div className="text-cyan text-base font-bold">{w} kg</div>
                                {diff != null && (
                                  <div className="flex items-center justify-end gap-0.5 text-[11px] font-semibold"
                                    style={{ color: diff < 0 ? 'var(--color-green)' : diff > 0 ? 'var(--color-red)' : 'var(--color-muted)' }}>
                                    {diff < 0 ? <TrendingDown size={11} /> : diff > 0 ? <TrendingUp size={11} /> : <Minus size={11} />}
                                    {diff > 0 ? '+' : ''}{diff} kg
                                  </div>
                                )}
                              </>
                            ) : <div className="text-muted text-xs">Sin peso</div>}
                          </div>
                          <ChevronRight size={15} className="text-muted shrink-0" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
          </>
        )}

        {/* ══════════════ VISTA ALERTAS ══════════════ */}
        {view === 'alertas' && (
          <>
            {alertas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <CheckCircle size={36} className="text-green opacity-60" />
                <div className="text-ink font-semibold">Todo en orden</div>
                <div className="text-muted text-sm text-center">No hay alertas pendientes. Todos los clientes están al día.</div>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Agrupar por tipo */}
                {[
                  {
                    tipo: 'llamada', label: 'Videollamadas próximas', color: '#5ECCFA',
                    render: (a) => `${a.dias === 0 ? 'HOY' : a.dias === 1 ? 'mañana' : `en ${a.dias} días`} — ${a.valor}`,
                  },
                  {
                    tipo: 'sin_peso', label: 'Sin registro de peso +14 días', color: '#FBBF24',
                    render: (a) => `${a.valor === 999 ? 'Nunca registrado' : `${a.valor} días sin actualizar`}`,
                  },
                  {
                    tipo: 'objetivo', label: 'Objetivo no cumplido este mes', color: '#F87171',
                    render: () => 'Objetivo marcado como no cumplido',
                  },
                  {
                    tipo: 'sin_mes', label: 'Sin seguimiento este mes', color: '#A78BFA',
                    render: () => 'Falta crear el seguimiento del mes actual',
                  },
                ].map(({ tipo, label, color, render }) => {
                  const grupo = alertas.filter((a) => a.tipo === tipo);
                  if (!grupo.length) return null;
                  // Deep link según el tipo de alerta
                  const deepLink = (a) => {
                    if (a.tipo === 'sin_peso')  return `/clientes/${a.cliente.id}/timeline`;
                    if (a.tipo === 'llamada')   return `/clientes/${a.cliente.id}/mes`;
                    if (a.tipo === 'objetivo')  return `/clientes/${a.cliente.id}/mes`;
                    if (a.tipo === 'sin_mes')   return `/clientes/${a.cliente.id}/mes`;
                    return `/clientes/${a.cliente.id}`;
                  };
                  return (
                    <div key={tipo}>
                      <div className="text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color }}>
                        <AlertTriangle size={10} /> {label} ({grupo.length})
                      </div>
                      <div className="space-y-1.5 mb-4">
                        {grupo.map((a, i) => (
                          <button key={i} onClick={() => router.push(deepLink(a))}
                            className="w-full text-left rounded-xl px-4 py-3 flex items-center gap-3"
                            style={{ background: 'var(--color-surface)', border: `1px solid ${color}28` }}>
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                              style={{ background: `${color}20`, color }}>
                              {a.cliente.name?.[0]?.toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-ink text-sm font-semibold">{a.cliente.name}</div>
                              <div className="text-muted text-xs mt-0.5">{render(a)}</div>
                            </div>
                            <ChevronRight size={14} className="text-muted shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ══════════════ VISTA SEMANA ══════════════ */}
        {view === 'semana' && (
          <>
            <div className="text-muted text-xs mb-1">
              Semana del <span className="text-ink font-semibold">{thisWeekStart}</span>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
              {/* Cabecera */}
              <div className="grid grid-cols-[1fr_80px_80px_80px_60px] px-4 py-2.5 text-muted text-[10px] uppercase tracking-widest"
                style={{ background: 'var(--color-surfaceAlt)' }}>
                <div>Cliente</div>
                <div className="text-center">Objetivo</div>
                <div className="text-center">Real</div>
                <div className="text-center">Dif.</div>
                <div className="text-center">Kcal</div>
              </div>
              {semana.map(({ c, week, realW, targetW, diff }, idx) => {
                const ph  = getCurrentPhase(c);
                const col = ph ? phaseColor([], ph.name) : 'var(--color-muted)';
                const kcal = week?.kcal_on ?? week?.kcal ?? null;
                return (
                  <button key={c.id} onClick={() => router.push(`/clientes/${c.id}/timeline`)}
                    className="w-full grid grid-cols-[1fr_80px_80px_80px_60px] px-4 py-3 items-center text-left transition-colors hover:bg-surfaceAlt"
                    style={{
                      background: idx % 2 === 0 ? 'var(--color-bg)' : 'var(--color-surface)',
                      borderTop: '1px solid var(--color-border)',
                    }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: `${col}20`, color: col }}>
                        {c.name?.[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-ink text-xs font-semibold truncate">{c.name}</div>
                        {ph && <div className="text-[10px] font-semibold" style={{ color: col }}>{ph.name}</div>}
                      </div>
                    </div>
                    <div className="text-center text-xs text-muted">{targetW != null ? `${targetW} kg` : '—'}</div>
                    <div className="text-center text-xs font-semibold" style={{ color: realW != null ? 'var(--color-cyan)' : 'var(--color-muted)' }}>
                      {realW != null ? `${realW} kg` : '—'}
                    </div>
                    <div className="text-center text-xs font-bold"
                      style={{ color: diff == null ? 'var(--color-muted)' : diff <= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                      {diff != null ? `${diff > 0 ? '+' : ''}${diff}` : '—'}
                    </div>
                    <div className="text-center text-xs text-muted">{kcal ?? '—'}</div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </main>

      {showNuevo && <NuevoClienteModal onClose={() => setShowNuevo(false)} />}
    </div>
  );
}
