import { NextRequest, NextResponse } from 'next/server';
import { dismissScoutTip } from '@/lib/supabase';

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dismissScoutTip(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Failed to dismiss tip:', err);
    return NextResponse.json({ error: 'Failed to dismiss' }, { status: 500 });
  }
}