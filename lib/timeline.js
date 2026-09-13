// ─── Utilidades de fecha ───────────────────────────────────────────────────
// IMPORTANTE: todas las funciones de cálculo de fechas usan UTC internamente
// para evitar bugs de zona horaria (si se usa Date + toISOString con horario
// local distinto de UTC, ej. Madrid en verano, las fechas se desplazan un día).

function ymdParts(dateISO) {
  const [y, m, d] = dateISO.split('-').map(Number);
  return { y, m, d };
}
function pad2(n) { return String(n).padStart(2, '0'); }
function toISO(y, m, d) { return `${y}-${pad2(m)}-${pad2(d)}`; }
function utcDateOf(dateISO) {
  const { y, m, d } = ymdParts(dateISO);
  return new Date(Date.UTC(y, m - 1, d));
}
function fromUtcDate(dt) {
  return toISO(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function phaseForDate(phases, dateISO) {
  return (phases || []).find((p) => dateISO >= p.start_date && dateISO <= p.end_date) || null;
}

export function addDaysISO(dateISO, days) {
  const dt = utcDateOf(dateISO);
  dt.setUTCDate(dt.getUTCDate() + days);
  return fromUtcDate(dt);
}

export function mondayOf(dateISO) {
  const dt = utcDateOf(dateISO);
  const day = (dt.getUTCDay() + 6) % 7; // 0=lunes ... 6=domingo
  dt.setUTCDate(dt.getUTCDate() - day);
  return fromUtcDate(dt);
}

// Fecha de HOY en horario LOCAL del navegador (no UTC) — así "hoy" es siempre
// el día real que ve la persona, sin desfases cerca de medianoche.
export function todayISO() {
  const d = new Date();
  return toISO(d.getFullYear(), d.getMonth() + 1, d.getDate());
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
  const firstOfMonth = toISO(y, m, 1);
  const lastOfMonth  = toISO(y, m, daysInMonth(ym));

  // Lunes de la primera semana que toca el mes
  const firstMonday = mondayOf(firstOfMonth);
  const weeks = [];
  let wStart = firstMonday;

  while (wStart <= lastOfMonth) {
    const wEnd = addDaysISO(wStart, 6);

    // Solo incluir semanas que tengan al menos 1 día dentro del mes
    const clampStart = wStart < firstOfMonth ? firstOfMonth : wStart;
    const clampEnd   = wEnd > lastOfMonth ? lastOfMonth : wEnd;

    const startDay = parseInt(clampStart.split('-')[2], 10);
    const endDay   = parseInt(clampEnd.split('-')[2], 10);

    // Detectar si cruza de mes (días de mes distinto)
    const crossesPrev = wStart < firstOfMonth;
    const crossesNext = wEnd > lastOfMonth;
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

    wStart = addDaysISO(wStart, 7);
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
  const on  = kcal_on  !== null && kcal_on  !== '' && kcal_on  !== undefined ? Number(kcal_on)  : null;
  const off = kcal_off !== null && kcal_off !== '' && kcal_off !== undefined ? Number(kcal_off) : null;
  const don = dias_on  !== null && dias_on  !== '' && dias_on  !== undefined ? Math.min(Math.max(Number(dias_on), 0), 7) : null;

  if (on == null && off == null) return null;

  // Sin días ON definidos: si solo hay un valor de kcal, se asume que aplica todos los días.
  // Si hay AMBOS (on y off) pero no sabemos cuántos días de cada, no se puede calcular la media real.
  if (don == null) {
    if (on != null && off == null) return Math.round(on);
    if (off != null && on == null) return Math.round(off);
    return null;
  }

  const dof = 7 - don;
  const onPart  = on  != null ? on  * don : 0;
  const offPart = off != null ? off * dof : 0;
  return Math.round((onPart + offPart) / 7);
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
