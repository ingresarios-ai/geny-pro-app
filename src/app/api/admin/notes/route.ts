import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: author } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', user.id)
    .maybeSingle();

  if (!author || !['admin', 'mentor'].includes(author.role)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  let body: { studentId?: string; note?: string; tag?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const note = String(body.note || '').trim();
  const studentId = String(body.studentId || '').trim();
  const tag = ['seguimiento', 'riesgo', 'logro', 'soporte'].includes(String(body.tag))
    ? String(body.tag)
    : 'seguimiento';

  if (!studentId || !note) {
    return NextResponse.json({ error: 'Falta nota o alumno' }, { status: 400 });
  }

  const { data: created, error } = await supabase
    .from('mentor_notes')
    .insert({
      student_id: studentId,
      author_id: author.id,
      author_name: author.full_name || 'Mentor',
      note: note.slice(0, 2000),
      tag,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, note: created });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: author } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!author || !['admin', 'mentor'].includes(author.role)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

  const { error } = await supabase.from('mentor_notes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

