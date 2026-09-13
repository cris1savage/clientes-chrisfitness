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

export function generateWeeks(phases, startDate, weeksCount, startWeight) {
  const weeks = [];
  let prevTarget = startWeight;
  const start = mondayOf(startDate);
  for (let i = 0; i < weeksCount; i++) {
    const week_start = addDaysISO(start, i * 7);
    const ph = phaseForDate(phases, week_start);
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
    const ph = phaseForDate(phases, next[i].week_start);
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

export function monthKeyOf(dateISO) {
  return dateISO.slice(0, 7);
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

export const PHASE_NAMES = ['Volumen','Definición','Mantenimiento','Recomposición','Otra'];
export const MEASUREMENTS = ['Cuello','Hombros','Pecho','Bíceps izq','Bíceps der','Antebrazo izq','Antebrazo der','Cintura','Cadera','Muslo izq','Muslo der','Gemelo izq','Gemelo der'];
export const WEEK_STRENGTHS = ['Fuerte','Normal','Floja'];
export const STRENGTH_COLOR = { Fuerte: '#4ADE80', Normal: '#FBBF24', Floja: '#F87171' };
export const GOAL_STATUSES = ['Cumplido','Parcial','No cumplido','Pendiente'];
export const GOAL_COLORS = { Cumplido: '#4ADE80', Parcial: '#FBBF24', 'No cumplido': '#F87171', Pendiente: '#7C878B' };

export function defaultWeeklyNotes(month) {
  return [
    { label: 'Semana 1 (1-7)',   note: '', strength: null },
    { label: 'Semana 2 (8-14)',  note: '', strength: null },
    { label: 'Semana 3 (15-21)', note: '', strength: null },
    { label: 'Semana 4 (22-28)', note: '', strength: null },
  ];
}

// Genera un token de solo lectura determinista basado en el id del cliente
// No es criptográfico — es suficiente para un enlace de lectura privado
export function readToken(clienteId) {
  // Toma los primeros 8 y los últimos 4 chars del UUID sin guiones
  const raw = clienteId.replace(/-/g, '');
  return raw.slice(0, 8) + raw.slice(-4);
}
