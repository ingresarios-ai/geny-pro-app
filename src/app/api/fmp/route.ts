import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { evaluateMembershipAccess } from '@/lib/membership';
import type { Json } from '@/lib/database.types';

export async function GET(request: Request) {
  if (!process.env.FMP_API_KEY) {
    return NextResponse.json({ error: 'FMP no está configurado' }, { status: 501 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
    supabase
      .from('memberships')
      .select('status, source, expires_at, grace_until')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  if (!evaluateMembershipAccess(profile, membership).allowed) {
    return NextResponse.json({ error: 'Membresía inactiva' }, { status: 403 });
  }

  const q = new URL(request.url).searchParams;
  const base = (process.env.FMP_BASE_URL || 'https://financialmodelingprep.com/stable').replace(
    /\/$/,
    ''
  );
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const from = q.get('from_date') || '';
  const to = q.get('to_date') || '';
  if ((from && !dateRe.test(from)) || (to && !dateRe.test(to))) {
    return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 });
  }

  const p = new URLSearchParams();
  let path = '';
  let ttlSec = 3600;

  if (q.get('tool') === 'chart' && q.get('endpoint') === 'historical-price-eod-full') {
    const sym = (q.get('symbol') || '').toUpperCase();
    if (!/^[A-Z0-9.^=-]{1,12}$/.test(sym)) {
      return NextResponse.json({ error: 'Símbolo inválido' }, { status: 400 });
    }
    path = '/historical-price-eod/full';
    p.set('symbol', sym);
    ttlSec = 3600;
  } else if (q.get('tool') === 'calendar' && q.get('endpoint') === 'earnings-calendar') {
    path = '/earnings-calendar';
    ttlSec = 21600;
  } else {
    return NextResponse.json({ error: 'Consulta no permitida' }, { status: 403 });
  }

  if (from) p.set('from', from);
  if (to) p.set('to', to);

  const cacheKey = `${path}?${p.toString()}`;

  // 1. Check shared Supabase market_cache first
  const { data: cached } = await supabase
    .from('market_cache')
    .select('payload, expires_at')
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (cached?.payload) {
    return NextResponse.json(
      { payload: cached.payload },
      {
        headers: {
          'cache-control': `private, max-age=300`,
        },
      }
    );
  }

  // 2. Fetch from FMP API
  const fmpRes = await fetch(
    `${base}${path}?${p.toString()}&apikey=${encodeURIComponent(process.env.FMP_API_KEY)}`
  );

  if (!fmpRes.ok) {
    return NextResponse.json(
      { error: `FMP respondió ${fmpRes.status}` },
      { status: fmpRes.status === 429 ? 429 : 502 }
    );
  }

  const payload = (await fmpRes.json()) as Json;

  await supabase.from('market_cache').upsert(
    {
      cache_key: cacheKey,
      payload,
      expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
    },
    { onConflict: 'cache_key' }
  );

  return NextResponse.json(
    { payload },
    {
      headers: {
        'cache-control': `private, max-age=300`,
      },
    }
  );
}

