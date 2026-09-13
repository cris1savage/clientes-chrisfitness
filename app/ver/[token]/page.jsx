import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import VistaPublicaClient from '@/components/VistaPublicaClient';

export default async function VerPage({ params }) {
  const supabase = createClient();

  // Buscar cliente por token — sin auth
  const { data: cliente } = await supabase
    .from('active_clients')
    .select(`
      id, name, program, phases, long_term_goal,
      client_checkins ( month, weight, phase, goal_status, goals, training_notes, nutrition_notes, weekly_notes ),
      client_timeline_weeks ( week_start, real_weight, target_weight )
    `)
    .eq('read_token', params.token)
    .single();

  if (!cliente) notFound();

  return <VistaPublicaClient cliente={cliente} />;
}
