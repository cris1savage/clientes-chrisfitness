import { createClient } from '@/lib/supabase/server';
import ResumenClient from '@/components/ResumenClient';

export default async function ResumenPage({ params }) {
  const supabase = createClient();
  const [checkins, weeks, clienteData] = await Promise.all([
    supabase.from('client_checkins').select('*').eq('active_client_id', params.id).order('month', { ascending: true }),
    supabase.from('client_timeline_weeks').select('*').eq('active_client_id', params.id).order('week_start', { ascending: true }),
    supabase.from('active_clients').select('*').eq('id', params.id).single(),
  ]);

  return (
    <ResumenClient
      clienteId={params.id}
      cliente={clienteData.data}
      initialCheckins={checkins.data || []}
      initialWeeks={weeks.data || []}
    />
  );
}
