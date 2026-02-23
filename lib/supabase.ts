import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── Scout Intelligence helpers ───────────────────────────────────────────────

export async function loadScoutMessages(tripId: string) {
  const { data, error } = await supabase
    .from('scout_messages')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; role: string; content: string; created_at: string }>;
}

export async function saveScoutMessages(
  tripId: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
) {
  const rows = messages.map(m => ({ trip_id: tripId, role: m.role, content: m.content }));
  const { error } = await supabase.from('scout_messages').insert(rows);
  if (error) throw error;
}

export async function loadScoutContext(tripId: string) {
  const [messagesRes, actionsRes, tipsRes, removedRes] = await Promise.all([
    supabase.from('scout_messages').select('*').eq('trip_id', tripId).order('created_at', { ascending: true }),
    supabase.from('scout_actions').select('*').eq('trip_id', tripId).order('applied_at', { ascending: true }),
    supabase.from('scout_tips').select('*').eq('trip_id', tripId).eq('dismissed', false),
    supabase.from('scout_removed_items').select('*').eq('trip_id', tripId),
  ]);
  return {
    messages: (messagesRes.data ?? []) as Array<{ role: string; content: string }>,
    actions: (actionsRes.data ?? []) as Array<{ description: string; applied_at: string }>,
    tips: (tipsRes.data ?? []) as Array<{ message: string; type: string }>,
    removedItems: (removedRes.data ?? []) as Array<{ name: string; item_type: string; reason: string | null }>,
  };
}

export async function saveScoutAction(
  tripId: string,
  actionType: string,
  description: string,
  beforeSnapshot: unknown,
  afterSnapshot: unknown
) {
  const { error } = await supabase.from('scout_actions').insert({
    trip_id: tripId,
    action_type: actionType,
    description,
    before_snapshot: beforeSnapshot,
    after_snapshot: afterSnapshot,
  });
  if (error) throw error;
}

export async function logRemovedItemToDb(
  tripId: string,
  itemType: 'activity' | 'day' | 'lodging',
  name: string,
  reason?: string
) {
  const { error } = await supabase.from('scout_removed_items').insert({
    trip_id: tripId,
    item_type: itemType,
    name,
    reason: reason ?? null,
  });
  if (error) console.error('Failed to log removed item:', error);
  // Non-throwing: removal logging is fire-and-forget
}

export async function upsertScoutTips(
  tripId: string,
  tips: Array<{ id: string; message: string; type: 'warning' | 'info' | 'suggestion' }>
) {
  const rows = tips.map(t => ({
    trip_id: tripId,
    tip_key: t.id,
    message: t.message,
    type: t.type,
    dismissed: false,
  }));
  const { error } = await supabase
    .from('scout_tips')
    .upsert(rows, { onConflict: 'trip_id,tip_key', ignoreDuplicates: true });
  if (error) console.error('Failed to upsert tips:', error);
}

export async function loadScoutTips(tripId: string) {
  const { data, error } = await supabase
    .from('scout_tips')
    .select('*')
    .eq('trip_id', tripId);
  if (error) return [];
  return (data ?? []) as Array<{ id: string; tip_key: string; message: string; type: string; dismissed: boolean }>;
}

export async function dismissScoutTip(tipId: string) {
  const { error } = await supabase
    .from('scout_tips')
    .update({ dismissed: true, dismissed_at: new Date().toISOString() })
    .eq('id', tipId);
  if (error) console.error('Failed to dismiss tip:', error);
}
