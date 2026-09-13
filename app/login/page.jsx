import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LoginClient from '@/components/LoginClient';

export default async function LoginPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/clientes');
  return <LoginClient />;
}
