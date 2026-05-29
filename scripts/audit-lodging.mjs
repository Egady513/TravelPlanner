// One-off audit: count lodging nights per day to find the dashboard inflation bug.
// Reads .env.local manually (no dotenv dep).
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envFile = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const { data: trips, error } = await supabase
  .from('trips')
  .select('id, name, start_date, end_date, days, updated_at')
  .order('updated_at', { ascending: false });

if (error) { console.error('Query error:', error); process.exit(1); }

console.log(`\nFound ${trips.length} trip(s). Most recent first:\n`);
for (const t of trips) {
  console.log(`  - ${t.name} (${t.start_date} → ${t.end_date})  id=${t.id}`);
}

// Find Charlie's Western Adventure
const trip = trips.find(t => /charlie|western/i.test(t.name)) ?? trips[0];
console.log(`\n=== Auditing: ${trip.name} ===`);
console.log(`Date range: ${trip.start_date} → ${trip.end_date}`);

const days = trip.days ?? [];
console.log(`Total days in array: ${days.length}\n`);

// Replicate the dashboard counter logic
let hotelNights = 0;
let campingNights = 0;
const hotelDetail = [];
const campingDetail = [];

for (const day of days) {
  const acts = day.activities ?? [];
  for (const a of acts) {
    if (a.type === 'hotel' && !a.isContinuingStay) {
      const n = a.nights ?? 1;
      hotelNights += n;
      hotelDetail.push({
        day: day.dayNumber,
        date: day.date,
        name: a.name,
        nights: n,
        isPrimary: a.isPrimary,
        isContinuingStay: a.isContinuingStay,
        sourceActivityId: a.sourceActivityId,
      });
    }
    if (a.type === 'camping' && !a.isContinuingStay) {
      const n = a.nights ?? 1;
      campingNights += n;
      campingDetail.push({
        day: day.dayNumber,
        date: day.date,
        name: a.name,
        nights: n,
        isPrimary: a.isPrimary,
        isContinuingStay: a.isContinuingStay,
        sourceActivityId: a.sourceActivityId,
      });
    }
  }
}

console.log(`Dashboard math:`);
console.log(`  Hotel nights:   ${hotelNights}`);
console.log(`  Camping nights: ${campingNights}`);
console.log(`  TOTAL:          ${hotelNights + campingNights}\n`);

console.log(`--- Hotel activities counted (${hotelDetail.length}) ---`);
for (const h of hotelDetail) {
  console.log(`  Day ${String(h.day).padStart(2)} (${h.date?.slice(0,10) ?? '?'})  nights=${h.nights}  ${h.isPrimary === false ? '⚠ BACKUP  ' : ''}${h.name}`);
}

console.log(`\n--- Camping activities counted (${campingDetail.length}) ---`);
for (const c of campingDetail) {
  console.log(`  Day ${String(c.day).padStart(2)} (${c.date?.slice(0,10) ?? '?'})  nights=${c.nights}  ${c.isPrimary === false ? '⚠ BACKUP  ' : ''}${c.name}`);
}

// Find days with multiple lodging entries (likely double-count source)
console.log(`\n--- Days with multiple lodging entries (suspect) ---`);
for (const day of days) {
  const lodging = (day.activities ?? []).filter(a => (a.type === 'hotel' || a.type === 'camping') && !a.isContinuingStay);
  if (lodging.length > 1) {
    console.log(`  Day ${day.dayNumber} (${day.date?.slice(0,10) ?? '?'}): ${lodging.length} entries`);
    for (const a of lodging) {
      console.log(`     - [${a.type}] nights=${a.nights ?? 1} isPrimary=${a.isPrimary} "${a.name}"`);
    }
  }
}

// Find continuing stays vs real anchors
console.log(`\n--- Continuing-stay flags ---`);
let realLodging = 0, contLodging = 0;
for (const day of days) {
  for (const a of (day.activities ?? [])) {
    if (a.type === 'hotel' || a.type === 'camping') {
      if (a.isContinuingStay) contLodging++; else realLodging++;
    }
  }
}
console.log(`  Real (counted) lodging entries:   ${realLodging}`);
console.log(`  Continuing-stay (skipped) copies: ${contLodging}`);
