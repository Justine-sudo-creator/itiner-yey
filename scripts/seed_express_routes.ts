/**
 * scripts/seed_express_routes.ts
 *
 * Injects key arterial express routes (like Quezon Ave to SM Fairview UV,
 * Ayala to Alabang Express Bus, Cubao to Divisoria Jeep) into the
 * offline snapshot (data/offline/snapshot.json.gz).
 *
 * Run: npx tsx scripts/seed_express_routes.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const SNAPSHOT_PATH = path.resolve('data/offline/snapshot.json.gz');

interface Snapshot {
  version: 1;
  generatedAt: string;
  source: string;
  routes: [id: string, origin: string, destination: string, totalFare: number][];
  segments: [
    routeIndex: number,
    transportType: string,
    signboard: string | null,
    fare: number,
    boardingName: string | null,
    boardingLat: number,
    boardingLng: number,
    dropOffName: string | null,
    dropOffLat: number,
    dropOffLng: number,
    estimatedDuration: string | null,
  ][];
}

interface ExpressRouteDef {
  id: string;
  name: string;
  origin: string;
  destination: string;
  transportType: string;
  signboard: string;
  fare: number;
  durationMins: number;
  stops: { name: string; lat: number; lng: number }[];
}

const EXPRESS_ROUTES: ExpressRouteDef[] = [
  {
    id: 'exp-qave-fairview-uv',
    name: 'MRT Quezon Ave to SM Fairview UV Express',
    origin: 'MRT-3 Quezon Avenue Station EDSA, Quezon City, Manila',
    destination: 'SM Fairview, Quirino Highway, Novaliches, Quezon City',
    transportType: 'uv express',
    signboard: 'SM FAIRVIEW',
    fare: 45,
    durationMins: 40,
    stops: [
      { name: 'MRT-3 Quezon Avenue Station EDSA, Quezon City, Manila', lat: 14.6425, lng: 121.0384 },
      { name: 'Philippine Coconut Authority, Commonwealth Avenue, Quezon City', lat: 14.6545, lng: 121.0560 },
      { name: 'Tandang Sora / Commonwealth Avenue Intersection, Quezon City', lat: 14.6750, lng: 121.0760 },
      { name: 'Batasan / Commonwealth Avenue, Quezon City', lat: 14.6950, lng: 121.0960 },
      { name: 'Fairview Terraces / Quirino Highway, Quezon City', lat: 14.7335, lng: 121.0585 },
      { name: 'SM Fairview, Quirino Highway, Novaliches, Quezon City', lat: 14.7350, lng: 121.0570 },
    ],
  },
  {
    id: 'exp-ayala-alabang-bus',
    name: 'Ayala Makati to Alabang Starmall Express Bus',
    origin: 'Ayala MRT Station, EDSA, Makati City',
    destination: 'Starmall Alabang, Muntinlupa City',
    transportType: 'bus',
    signboard: 'ALABANG EXPRESS',
    fare: 45,
    durationMins: 35,
    stops: [
      { name: 'Ayala MRT Station, EDSA, Makati City', lat: 14.5492, lng: 121.0280 },
      { name: 'Magallanes Interchange, Makati City', lat: 14.5385, lng: 121.0180 },
      { name: 'Bicutan SLEX Exit, Parañaque City', lat: 14.4880, lng: 121.0450 },
      { name: 'Sucat SLEX Exit, Muntinlupa City', lat: 14.4480, lng: 121.0490 },
      { name: 'Starmall Alabang, Muntinlupa City', lat: 14.4170, lng: 121.0440 },
    ],
  },
  {
    id: 'exp-cubao-divisoria-jeep',
    name: 'Cubao to Divisoria via Magsaysay Jeepney',
    origin: 'Araneta Center-Cubao MRT, Quezon City',
    destination: 'Tutuban PNR Station, Divisoria, Manila',
    transportType: 'jeep',
    signboard: 'CUBAO - DIVISORIA',
    fare: 25,
    durationMins: 45,
    stops: [
      { name: 'Araneta Center-Cubao MRT, Quezon City', lat: 14.6195, lng: 121.0512 },
      { name: 'V. Mapa LRT Station, Santa Mesa, Manila', lat: 14.6040, lng: 121.0180 },
      { name: 'Pureza LRT Station, Santa Mesa, Manila', lat: 14.6015, lng: 121.0050 },
      { name: 'Legarda LRT Station, Sampaloc, Manila', lat: 14.5995, lng: 120.9930 },
      { name: 'Recto LRT Station, Santa Cruz, Manila', lat: 14.6035, lng: 120.9830 },
      { name: 'Tutuban PNR Station, Divisoria, Manila', lat: 14.6075, lng: 120.9715 },
    ],
  },
];

async function run() {
  console.log('⚡ Loading existing snapshot from:', SNAPSHOT_PATH);
  if (!fs.existsSync(SNAPSHOT_PATH)) {
    console.error('❌ Snapshot file not found at:', SNAPSHOT_PATH);
    process.exit(1);
  }

  const buf = fs.readFileSync(SNAPSHOT_PATH);
  const jsonStr = zlib.gunzipSync(buf).toString('utf-8');
  const snapshot: Snapshot = JSON.parse(jsonStr);

  console.log(`📊 Current snapshot has ${snapshot.routes.length} routes, ${snapshot.segments.length} segments`);

  for (const exp of EXPRESS_ROUTES) {
    // Check if route already exists
    const existingIdx = snapshot.routes.findIndex(r => r[0] === exp.id);
    const routeIndex = existingIdx >= 0 ? existingIdx : snapshot.routes.length;

    if (existingIdx >= 0) {
      console.log(`🔄 Updating express route: ${exp.name}`);
      snapshot.routes[existingIdx] = [exp.id, exp.origin, exp.destination, exp.fare];
    } else {
      console.log(`➕ Adding express route: ${exp.name}`);
      snapshot.routes.push([exp.id, exp.origin, exp.destination, exp.fare]);
    }

    // Generate consecutive segments between stops
    for (let i = 0; i < exp.stops.length - 1; i++) {
      const from = exp.stops[i];
      const to = exp.stops[i + 1];
      const segTime = Math.round(exp.durationMins / (exp.stops.length - 1));

      snapshot.segments.push([
        routeIndex,
        exp.transportType,
        exp.signboard,
        exp.fare,
        from.name,
        from.lat,
        from.lng,
        to.name,
        to.lat,
        to.lng,
        `${segTime} mins`,
      ]);
    }
  }

  snapshot.generatedAt = new Date().toISOString();
  snapshot.source = 'gtfs+community';

  console.log(`💾 Writing updated snapshot (${snapshot.routes.length} routes, ${snapshot.segments.length} segments)...`);
  const outJson = JSON.stringify(snapshot);
  const outGz = zlib.gzipSync(Buffer.from(outJson, 'utf-8'));
  fs.writeFileSync(SNAPSHOT_PATH, outGz);

  console.log('✅ Successfully seeded express routes into offline snapshot!');

  // Also push to Supabase if credentials are present
  if (SUPABASE_URL && SERVICE_KEY) {
    console.log('📡 Pushing express routes to Supabase...');
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    for (const exp of EXPRESS_ROUTES) {
      const firstStop = exp.stops[0];
      const lastStop = exp.stops[exp.stops.length - 1];

      // 1. Insert route
      const { data: routeRow, error: rErr } = await sb
        .from('routes')
        .insert({
          origin: exp.origin,
          destination: exp.destination,
          origin_lat: firstStop.lat,
          origin_lng: firstStop.lng,
          destination_lat: lastStop.lat,
          destination_lng: lastStop.lng,
          total_fare: exp.fare,
          estimated_duration: `~${exp.durationMins} mins`,
          confidence_score: 95,
        })
        .select('id')
        .single();

      if (rErr || !routeRow) {
        console.warn(`  ⚠️ Route insert warning for ${exp.name}: ${rErr?.message}`);
        continue;
      }

      const dbRouteId = routeRow.id;

      // 2. Insert new segments
      const segRows = [];
      for (let i = 0; i < exp.stops.length - 1; i++) {
        const from = exp.stops[i];
        const to = exp.stops[i + 1];
        const segTime = Math.round(exp.durationMins / (exp.stops.length - 1));

        segRows.push({
          route_id: dbRouteId,
          transport_type: exp.transportType,
          signboard: exp.signboard,
          fare: Math.round(exp.fare / (exp.stops.length - 1)),
          boarding_name: from.name,
          boarding_lat: from.lat,
          boarding_lng: from.lng,
          drop_off_name: to.name,
          drop_off_lat: to.lat,
          drop_off_lng: to.lng,
          estimated_duration: `~${segTime} mins`,
          display_order: i + 1,
        });
      }

      const { error: sErr } = await sb.from('route_segments').insert(segRows);
      if (sErr) {
        console.warn(`  ⚠️ Segments insert warning for ${exp.name}: ${sErr.message}`);
      } else {
        console.log(`  ✅ Supabase: Successfully seeded ${exp.name} (${segRows.length} segments, id: ${dbRouteId})`);
      }
    }
  }
}

run().catch(err => {
  console.error('❌ Seed error:', err);
  process.exit(1);
});
