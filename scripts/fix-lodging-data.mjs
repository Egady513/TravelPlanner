// Data cleanup for Charlie's Western Adventure lodging.
// Run with --apply to actually write. Otherwise dry-run.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const APPLY = process.argv.includes('--apply');
const __dirname = dirname(fileURLToPath(import.meta.url));
const envFile = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
const env = Object.fromEntries(
  envFile.split('\n').filter(l => l && !l.startsWith('#') && l.includes('=')).map(l => {
    const i = l.indexOf('=');
    return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
  })
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const TRIP_ID = '7af25421-ad36-482f-a25d-8859dabeabd8'; // Charlie's Western Adventure
const { data: trip, error } = await supabase
  .from('trips').select('*').eq('id', TRIP_ID).single();
if (error) { console.error('Load error:', error); process.exit(1); }

const days = JSON.parse(JSON.stringify(trip.days)); // deep clone
const changes = [];

// --- FIX 1: South Mount Elbert Trailhead (Day 13) → mark as backup ---
{
  const day = days.find(d => d.dayNumber === 13);
  const target = day?.activities.find(a => a.type === 'camping' && /south mount elbert/i.test(a.name));
  if (target) {
    const before = target.isPrimary;
    target.isPrimary = false;
    changes.push(`Day 13 "${target.name}": isPrimary ${before} → false (backup)`);
  } else {
    changes.push(`Day 13: South Mount Elbert not found (already fixed?)`);
  }
}

// --- FIX 2: Day 10 Virginian Lodge anchor → remove (3-night stay starts Day 9) ---
{
  const day9 = days.find(d => d.dayNumber === 9);
  const day9Virginian = day9?.activities.find(a => a.type === 'hotel' && /virginian/i.test(a.name));
  const day10 = days.find(d => d.dayNumber === 10);
  const day10VirginianIdx = day10?.activities.findIndex(a => a.type === 'hotel' && /virginian/i.test(a.name) && !a.isContinuingStay);

  if (!day9Virginian) {
    changes.push(`Day 9 Virginian anchor not found — aborting Fix 2`);
  } else if (day10VirginianIdx >= 0) {
    const removed = day10.activities.splice(day10VirginianIdx, 1)[0];
    changes.push(`Day 10 "${removed.name}" anchor (nights=${removed.nights}) REMOVED — was overlap with Day 9 anchor`);
  } else {
    changes.push(`Day 10: Virginian anchor already gone`);
  }
}

// --- FIX 3: Ensure Day 10 + Day 11 have Virginian continuing stays ---
{
  const day9 = days.find(d => d.dayNumber === 9);
  const day9Virginian = day9?.activities.find(a => a.type === 'hotel' && /virginian/i.test(a.name) && !a.isContinuingStay);

  if (day9Virginian) {
    // Make sure Day 9 nights = 3
    if (day9Virginian.nights !== 3) {
      const before = day9Virginian.nights;
      day9Virginian.nights = 3;
      changes.push(`Day 9 "${day9Virginian.name}": nights ${before} → 3`);
    }

    for (const targetDay of [10, 11]) {
      const day = days.find(d => d.dayNumber === targetDay);
      if (!day) continue;
      const hasCont = day.activities.some(a =>
        a.type === 'hotel' && a.isContinuingStay && (a.sourceActivityId === day9Virginian.id || /virginian/i.test(a.name))
      );
      if (!hasCont) {
        day.activities.push({
          ...day9Virginian,
          id: crypto.randomUUID(),
          dayNumber: targetDay,
          isContinuingStay: true,
          sourceActivityId: day9Virginian.id,
          parentDayNumber: 9,
        });
        changes.push(`Day ${targetDay}: added Virginian continuing-stay copy`);
      } else {
        changes.push(`Day ${targetDay}: continuing-stay already present`);
      }
    }
  }
}

console.log(`\n=== Planned changes (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===`);
for (const c of changes) console.log(`  • ${c}`);

if (!APPLY) {
  console.log(`\nDry-run complete. Re-run with --apply to write.`);
  process.exit(0);
}

const { error: updateErr } = await supabase
  .from('trips')
  .update({ days, updated_at: new Date().toISOString() })
  .eq('id', TRIP_ID);
if (updateErr) { console.error('Write error:', updateErr); process.exit(1); }
console.log(`\n✓ Trip updated.`);
