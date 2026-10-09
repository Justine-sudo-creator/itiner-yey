# ItinerYey — offline commute assistant

ItinerYey is a crowd-sourced guide to Philippine public transport (jeepney, bus, UV Express, LRT/MRT). Commuters post the routes they ride, other commuters verify them, and an A* planner combines legs from different posts into one trip.

**Hackathon build: it keeps working when the cloud is gone.** Signal drops in MRT tunnels, on provincial roads and when prepaid data runs out, so the app does all of the following on the laptop itself:

| Feature | Runs on | Cloud needed? |
|---|---|---|
| Taglish/English question → origin & destination | `qwen2.5:3b` via Ollama | No |
| Place lookup (SM North → North Avenue MRT, …) | Local stop index + aliases | No (replaces Nominatim) |
| Multi-vehicle route, fare, time | Existing A* engine on `data/offline/snapshot.json.gz` | No (Supabase optional) |
| Signboard photo → matching routes, fare, "dadaan ba sa …?" | `qwen2.5vl:3b` via Ollama | No |

The model only *understands* the question and *reads* signboards. Fares, stops and transfers always come from the planner, so the assistant cannot invent routes.

---

## 🎯 Why Local AI? (Cloud-Only vs. On-Device)

A cloud-only commute assistant fails exactly when commuters need it most. Running AI on-device transforms this into an experience that would otherwise be:

| Dimension | Cloud-Only Approach | **ItinerYey (100% On-Device AI)** |
|:---|:---|:---|
| **Impossible / Difficult** | Cellular connections drop in underground MRT tunnels, dense underpasses, provincial highways, or whenever prepaid data runs out. Cloud AI simply stops working. | **Zero signal required.** The entire A* pathfinding graph (47,200+ segments) and Ollama models reside locally in device memory. It keeps routing even with airplane mode on. |
| **Expensive** | Uploading high-res signboard photos to cloud vision APIs (GPT-4o / Claude Vision) incurs recurring API token fees (\$0.01–\$0.03/request) plus cellular data costs for commuters. | **Zero marginal cost.** 100% free for commuters, zero API bills for operators, and zero mobile load consumed. |
| **Private** | Centralized transit apps harvest exact home-to-work routines, commute times, and continuous location history sent to remote servers. | **Absolute privacy.** Origins, destinations, and daily commute patterns never leave the user's local hardware. 0 bytes sent to the cloud. |
| **Slow & Fragile** | Streaming multi-megabyte camera photos over congested 3G/4G networks introduces latency spikes, upload stalls, and network timeouts on the road. | **Instant local inference.** Photos and queries are processed directly on local hardware without network round-trips. |

---

## Run the offline demo

```bash
# 1. Local models (one-time download, ~5 GB)
ollama serve &
ollama pull qwen2.5:3b
ollama pull qwen2.5vl:3b

# 2. Run the app (no Supabase keys or .env needed!)
npm install
npm run dev
```

Or simply `npm run demo` — builds once, serves on the local network and prints the URL for phones.

**On a phone:** turn on the laptop's hotspot (or join the same Wi-Fi), open the printed `http://<laptop-ip>:3000/ask`, and use *Take / upload photo* to scan a real signboard. Nothing leaves the laptop–phone link. *(Windows: allow Node.js through the firewall on "Private" networks when prompted.)*

Open http://localhost:3000/ask, then turn Wi-Fi off and try:

- `Paano pumunta sa SM North galing Cubao?`
- `Galing Recto papuntang Katipunan, magkano?`
- **Scan signboard** → *Try sample signboard* (or upload/take a photo of a real jeepney sign)

Environment overrides: `OLLAMA_HOST`, `OLLAMA_MODEL`, `OLLAMA_VISION_MODEL`, `ASSISTANT_REPHRASE=1` (let the LLM re-word directions; best with a 7B+ model).

## Offline route snapshot

`data/offline/snapshot.json.gz` ships with routes built from the [Sakay.ph GTFS feed](https://github.com/sakayph/gtfs) (1,717 routes). Rebuild it from your own Supabase data or a GTFS folder:

```bash
npx tsx scripts/build_offline_snapshot.ts               # from Supabase (needs SUPABASE_SERVICE_ROLE_KEY)
npx tsx scripts/build_offline_snapshot.ts --gtfs ./gtfs  # from a GTFS feed
```

With Supabase configured, the planner uses live data and falls back to the snapshot automatically if Supabase can't be reached.

## Full (online) app

Create `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` and `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`, then `npm run dev`.
