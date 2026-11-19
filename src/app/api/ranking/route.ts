import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { evaluateMembershipAccess } from '@/lib/membership';

const toFiniteNumber = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const [{ data: profile }, { data: membership }, { data: rows }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
    supabase.from('memberships').select('status, source, expires_at, grace_until').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('ranking_entries')
      .select('user_id, alias, r_total, pnl, wr, dis, dias, n')
      .order('r_total', { ascending: false })
      .limit(300),
  ]);

  if (!evaluateMembershipAccess(profile, membership).allowed) {
    return NextResponse.json({ error: 'Membresía inactiva' }, { status: 403 });
  }

  const docs = (rows || []).map((r) => ({
    id: r.user_id,
    data: {
      alias: r.alias,
      R: Number(r.r_total),
      pnl: Number(r.pnl),
      wr: r.wr,
      dis: r.dis != null ? Number(r.dis) : null,
      dias: r.dias,
      n: r.n,
    },
  }));

  return NextResponse.json({ docs });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const row = {
    user_id: user.id,
    alias: String(body.alias || 'Trader anónimo').slice(0, 40),
    r_total: toFiniteNumber(body.R),
    pnl: toFiniteNumber(body.pnl),
    wr: Math.round(toFiniteNumber(body.wr)),
    dis: body.dis == null ? null : toFiniteNumber(body.dis),
    dias: Math.round(toFiniteNumber(body.dias)),
    n: Math.round(toFiniteNumber(body.n)),
  };

  const { error } = await supabase
    .from('ranking_entries')
    .upsert(row, { onConflict: 'user_id' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  await supabase.from('ranking_entries').delete().eq('user_id', user.id);
  return NextResponse.json({ ok: true });
}

