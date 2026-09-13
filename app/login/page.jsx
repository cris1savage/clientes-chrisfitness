'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router  = useRouter();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [code,     setCode]     = useState('');
  const [needsMfa, setNeedsMfa] = useState(false);
  const [err,      setErr]      = useState('');
  const [loading,  setLoading]  = useState(false);

  const submitPassword = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    const sb = createClient();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { setLoading(false); setErr('Email o contraseña incorrectos.'); return; }
    const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    setLoading(false);
    if (aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') { setNeedsMfa(true); return; }
    router.push('/clientes');
    router.refresh();
  };

  const submitCode = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    const sb = createClient();
    const { data: factors } = await sb.auth.mfa.listFactors();
    const factor = factors?.totp?.find((f) => f.status === 'verified');
    if (!factor) { setLoading(false); setErr('No se encontró verificación en dos pasos.'); return; }
    const { data: challenge, error: challengeErr } = await sb.auth.mfa.challenge({ factorId: factor.id });
    if (challengeErr) { setLoading(false); setErr('Error al verificar. Inténtalo de nuevo.'); return; }
    const { error: verifyErr } = await sb.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code: code.trim() });
    setLoading(false);
    if (verifyErr) { setErr('Código incorrecto. Revisa la app autenticadora.'); return; }
    router.push('/clientes');
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center mb-2">
          <div className="font-display text-ink text-[32px] tracking-wide">CHRIS FITNESS</div>
          <div className="text-violet text-xs tracking-[2px] uppercase">Seguimiento de Clientes</div>
        </div>

        {!needsMfa ? (
          <form onSubmit={submitPassword} className="space-y-3 bg-surface border border-border rounded-xl p-5">
            <input
              type="email" required placeholder="Email"
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="bg-surfaceAlt border border-border text-ink rounded-lg px-3 py-2.5 w-full text-sm outline-none focus:border-cyan"
            />
            <input
              type="password" required placeholder="Contraseña"
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="bg-surfaceAlt border border-border text-ink rounded-lg px-3 py-2.5 w-full text-sm outline-none focus:border-cyan"
            />
            {err && <div className="text-red text-xs">{err}</div>}
            <button
              type="submit" disabled={loading}
              className="w-full rounded-lg py-2.5 font-bold text-sm disabled:opacity-60"
              style={{ background: 'var(--color-violet)', color: '#0D0A1F' }}
            >
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitCode} className="space-y-3 bg-surface border border-border rounded-xl p-5">
            <div className="text-ink text-sm font-semibold">Código de verificación</div>
            <div className="text-muted text-xs">Abre tu app autenticadora e introduce el código de 6 dígitos.</div>
            <input
              autoFocus value={code} onChange={(e) => setCode(e.target.value)}
              placeholder="000000" maxLength={6}
              className="bg-surfaceAlt border border-border text-ink rounded-lg px-3 py-2.5 w-full text-lg tracking-[0.3em] text-center outline-none focus:border-cyan"
            />
            {err && <div className="text-red text-xs">{err}</div>}
            <button
              type="submit" disabled={loading}
              className="w-full rounded-lg py-2.5 font-bold text-sm disabled:opacity-60"
              style={{ background: 'var(--color-violet)', color: '#0D0A1F' }}
            >
              {loading ? 'Verificando…' : 'Verificar y entrar'}
            </button>
          </form>
        )}

        <div className="text-muted text-[11px] text-center">
          Acceso privado — solo Chris Fitness
        </div>
      </div>
    </div>
  );
}
