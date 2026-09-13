import { createClient } from '@/lib/supabase/server';
import MedidasClient from '@/components/MedidasClient';

export default async function MedidasPage({ params }) {
  const supabase = createClient();
  const { data: checkins } = await supabase
    .from('client_checkins')
    .select('month, measurements, weight')
    .eq('active_client_id', params.id)
    .order('month', { ascending: true });

  return <MedidasClient checkins={checkins || []} />;
}
