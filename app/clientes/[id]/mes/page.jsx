import { createClient } from '@/lib/supabase/server';
import MesClient from '@/components/MesClient';

export default async function MesPage({ params }) {
  const supabase = createClient();
  const [checkins, clienteData] = await Promise.all([
    supabase.from('client_checkins').select('*').eq('active_client_id', params.id).order('month', { ascending: false }),
    supabase.from('active_clients').select('phases, name').eq('id', params.id).single(),
  ]);

  return (
    <MesClient
      clienteId={params.id}
      clienteName={clienteData.data?.name || ''}
      phases={clienteData.data?.phases || []}
      initialCheckins={checkins.data || []}
    />
  );
}
