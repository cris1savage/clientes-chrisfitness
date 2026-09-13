import { createClient } from '@/lib/supabase/server';
import ClientesListClient from '@/components/ClientesListClient';

export const revalidate = 0;

export default async function ClientesPage() {
  const supabase = createClient();

  const { data: clientes } = await supabase
    .from('active_clients')
    .select(`
      id, name, program, start_date, status, phases, long_term_goal, duration, read_token,
      client_checkins ( id, month, weight, phase, goal_status, call_date, call_done ),
      client_timeline_weeks ( week_start, real_weight, target_weight, kcal, kcal_on, kcal_off )
    `)
    .eq('status', 'Activo')
    .order('name', { ascending: true });

  return <ClientesListClient clientes={clientes || []} />;
}
