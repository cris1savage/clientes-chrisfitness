// ─── Utilidades de fecha ───────────────────────────────────────────────────

export function phaseForDate(phases, dateISO) {
  return (phases || []).find((p) => dateISO >= p.start_date && dateISO <= p.end_date) || null;
}

export function addDaysISO(dateISO, days) {
  const d = new Date(`${dateISO}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function mondayOf(dateISO) {
  const d = new Date(`${dateISO}T00:00:00`);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function monthKeyOf(dateISO) {
  return dateISO.slice(0, 7);
}

export function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function fmtDate(iso) {
  if (!iso) return '';
  const [, mm, dd] = iso.split('-');
  const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${parseInt(dd)} ${MONTHS[parseInt(mm) - 1]}`;
}

export function monthLabelFull(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return `${MONTHS[parseInt(m) - 1]} ${y}`;
}

// ─── Semanas reales del calendario ────────────────────────────────────────
// Devuelve las semanas reales (lun-dom) que tienen días dentro del mes ym
// Cada semana: { weekStart: 'YYYY-MM-DD', weekEnd: 'YYYY-MM-DD', label: '...' }
export function realWeeksOfMonth(ym) {
  const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const [y, m] = ym.split('-').map(Number);
  const mLabel = MONTHS[m - 1];
  const firstDay = new Date(y, m - 1, 1);
  const lastDay  = new Date(y, m, 0);

  // Lunes de la primera semana que toca el mes
  const firstMonday = mondayOf(`${y}-${String(m).padStart(2,'0')}-01`);
  const weeks = [];
  let cur = new Date(`${firstMonday}T00:00:00`);

  while (cur <= lastDay) {
    const wStart = cur.toISOString().slice(0, 10);
    const wEnd   = addDaysISO(wStart, 6);

    // Solo incluir semanas que tengan al menos 1 día dentro del mes
    const clampStart = wStart < `${y}-${String(m).padStart(2,'0')}-01`
      ? `${y}-${String(m).padStart(2,'0')}-01` : wStart;
    const clampEnd = wEnd > lastDay.toISOString().slice(0,10)
      ? lastDay.toISOString().slice(0,10) : wEnd;

    const startDay = parseInt(clampStart.split('-')[2]);
    const endDay   = parseInt(clampEnd.split('-')[2]);

    // Detectar si cruza de mes (días de mes distinto)
    const crossesPrev = wStart < `${y}-${String(m).padStart(2,'0')}-01`;
    const crossesNext = wEnd > lastDay.toISOString().slice(0,10);
    let label = `${startDay}-${endDay} ${mLabel}`;
    if (crossesPrev) label = `...${endDay} ${mLabel}`;
    if (crossesNext) label = `${startDay} ${mLabel}...`;

    weeks.push({
      weekStart: wStart,
      weekEnd:   wEnd,
      label:     `Semana del ${label}`,
      shortLabel: label,
      idx: weeks.length,
    });

    cur.setDate(cur.getDate() + 7);
    if (cur > lastDay) break;
  }
  return weeks;
}

// Devuelve la semana real que contiene una fecha ISO
export function weekOfDate(dateISO) {
  const wStart = mondayOf(dateISO);
  const wEnd   = addDaysISO(wStart, 6);
  return { weekStart: wStart, weekEnd: wEnd };
}

// Retrocompatibilidad: etiqueta fija para el MesClient antiguo
export function weekRangeLabel(ym, weekIdx) {
  const weeks = realWeeksOfMonth(ym);
  return weeks[weekIdx] ? `Semana del ${weeks[weekIdx].shortLabel}` : `Semana ${weekIdx + 1}`;
}

// ─── Timeline / peso ──────────────────────────────────────────────────────

export function generateWeeks(phases, startDate, weeksCount, startWeight) {
  const weeks = [];
  let prevTarget = startWeight;
  const start = mondayOf(startDate);
  for (let i = 0; i < weeksCount; i++) {
    const week_start = addDaysISO(start, i * 7);
    const ph   = phaseForDate(phases, week_start);
    const rate = ph?.rate ?? 0;
    const target = i === 0 ? prevTarget : prevTarget * (1 + rate / 100);
    weeks.push({
      week_start,
      kcal: ph?.kcal ?? null,
      kcal_on: null,
      kcal_off: null,
      target_weight: Math.round(target * 10) / 10,
      target_overridden: false,
      real_weight: null,
    });
    prevTarget = target;
  }
  return weeks;
}

export function recalcFrom(weeks, phases, editedIndex, newTarget) {
  const next = weeks.map((w) => ({ ...w }));
  next[editedIndex].target_weight = Math.round(newTarget * 10) / 10;
  next[editedIndex].target_overridden = true;
  let prev = next[editedIndex].target_weight;
  for (let i = editedIndex + 1; i < next.length; i++) {
    const ph   = phaseForDate(phases, next[i].week_start);
    const rate = ph?.rate ?? 0;
    next[i] = {
      ...next[i],
      target_weight: Math.round(prev * (1 + rate / 100) * 10) / 10,
      target_overridden: false,
    };
    prev = next[i].target_weight;
  }
  return next.slice(editedIndex);
}

// ─── Kcal media ponderada ─────────────────────────────────────────────────
// (kcal_on × dias_on + kcal_off × dias_off) / 7
export function calcKcalMedia(kcal_on, kcal_off, dias_on) {
  const on  = Number(kcal_on)  || 0;
  const off = Number(kcal_off) || 0;
  const don = Math.min(Number(dias_on) || 0, 7);
  const dof = 7 - don;
  if (!on && !off) return null;
  if (!off || !dof) return on || null;
  if (!on || !don) return off || null;
  return Math.round((on * don + off * dof) / 7);
}

// Macros → kcal: P×4 + C×4 + G×9
export function calcKcalFromMacros(protein, carbs, fat) {
  const p = Number(protein) || 0;
  const c = Number(carbs)   || 0;
  const g = Number(fat)     || 0;
  if (!p && !c && !g) return null;
  return Math.round(p * 4 + c * 4 + g * 9);
}

// ─── Medias mensuales ─────────────────────────────────────────────────────

export function avgWeeklyField(weeklyNotes, field) {
  const vals = (weeklyNotes || []).map((w) => w[field]).filter((v) => v != null && v !== '');
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + Number(b), 0) / vals.length) * 10) / 10;
}

export function avgKcalForMonth(weeks, ym) {
  const inMonth = (weeks || []).filter((w) => w.week_start && w.week_start.slice(0, 7) === ym);
  const avg = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
  const onVals  = inMonth.map((w) => w.kcal_on ?? w.kcal).filter((v) => v != null);
  const offVals = inMonth.map((w) => w.kcal_off).filter((v) => v != null);
  return { on: avg(onVals), off: avg(offVals), weeksCount: inMonth.length };
}

// ─── Notas semanales por defecto (semanas reales del mes) ─────────────────
export function defaultWeeklyNotes(month) {
  const weeks = realWeeksOfMonth(month);
  return weeks.map((w) => ({
    weekStart:  w.weekStart,
    weekEnd:    w.weekEnd,
    label:      w.label,
    note: '', strength: null,
    steps: null, steps_goal: null,
    kcal_on: null, kcal_off: null, dias_on: null,
    protein_on: null, carbs_on: null, fat_on: null,
    protein_off: null, carbs_off: null, fat_off: null,
    adherence: null,
    days: Array(7).fill(null).map(() => ({ weight: null, steps: null, trained: null, diet: null })),
    saved: false,
  }));
}

// ─── Constantes ───────────────────────────────────────────────────────────

export function phaseColor(phases, name) {
  const COLORS = {
    Volumen:       '#5ECCFA',
    Definición:    '#FBBF24',
    Mantenimiento: '#A78BFA',
    Recomposición: '#4ADE80',
    Otra:          '#7C878B',
  };
  return COLORS[name] || '#7C878B';
}

export const PHASE_NAMES    = ['Volumen','Definición','Mantenimiento','Recomposición','Otra'];
export const MEASUREMENTS   = ['Cuello','Hombros','Pecho','Bíceps izq','Bíceps der','Antebrazo izq','Antebrazo der','Cintura','Cadera','Muslo izq','Muslo der','Gemelo izq','Gemelo der'];
export const WEEK_STRENGTHS = ['Fuerte','Normal','Floja'];
export const STRENGTH_COLOR = { Fuerte: '#4ADE80', Normal: '#FBBF24', Floja: '#F87171' };
export const GOAL_STATUSES  = ['Cumplido','Parcial','No cumplido','Pendiente'];
export const GOAL_COLORS    = { Cumplido: '#4ADE80', Parcial: '#FBBF24', 'No cumplido': '#F87171', Pendiente: '#7C878B' };
export const LEVEL_OPTIONS  = ['Excelente','Buena','Regular','Mala'];
export const LEVEL_COLORS   = { Excelente: '#4ADE80', Buena: '#5ECCFA', Regular: '#FBBF24', Mala: '#F87171' };

export function readToken(clienteId) {
  const raw = clienteId.replace(/-/g, '');
  return raw.slice(0, 8) + raw.slice(-4);
}
