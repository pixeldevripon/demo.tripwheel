# Deep-Dive Q&A — Island Tours Technical Decisions

---

## Q1. TanStack Query only in client components for fetching, and Server Actions only for mutations?

**Short answer: Mostly yes, but the full picture is more nuanced.**

Here is how the three tools are actually used together in a Next.js 15 App Router project:

---

### The Three Zones of a Next.js App

```
┌─────────────────────────────────────────────────────────────┐
│  ZONE 1: Server Components (rendered on server, no hooks)    │
│  - fetch() directly, or call Prisma directly                 │
│  - use cache / unstable_cache for deduplication              │
│  - No library needed. Zero JS sent to client.                │
│                                                              │
│  ZONE 2: Client Components (run in browser, have hooks)      │
│  - TanStack Query useQuery() for reading data                │
│  - TanStack Query useMutation() for mutations                │
│  - OR call Server Actions directly (simpler for forms)       │
│                                                              │
│  ZONE 3: Server Actions (server functions called from client) │
│  - Triggered by client, runs on server                       │
│  - Can be used for both reads AND mutations                   │
│  - But mostly used for mutations (forms, create/update/delete)│
└─────────────────────────────────────────────────────────────┘
```

---

### Rule: TanStack Query only runs in client components

TanStack Query uses React hooks (`useQuery`, `useMutation`, `useQueryClient`). Hooks cannot run inside Server Components — the server renders them once and sends HTML. So yes, TanStack Query is strictly a browser-side tool.

### Rule: Server Actions can do both reads and mutations, but are primarily for mutations

A Server Action is just a server function you can call from the client. You could technically call `getTrips()` as a Server Action from a client component. But you should not use Server Actions as a general-purpose fetch mechanism because:

- They always make a network request (no caching layer)
- You have to manage loading/error states yourself
- No background refetch, no stale-while-revalidate

TanStack Query wraps Server Actions (or plain `fetch`) to add all that. This is the recommended pattern.

---

### The Real Pattern — Island Tours Specific

| Page / Screen | Zone | Tool |
|---|---|---|
| Traveler homepage | Server Component | `fetch()` + `use cache` |
| Trip detail page (SEO) | Server Component | `fetch()` + `use cache` |
| Operator trip list | Client Component | TanStack `useQuery` |
| Slot picker (real-time) | Client Component | TanStack `useQuery` + SSE events |
| Create trip form | Client Component | Server Action for submit |
| Publish trip button | Client Component | TanStack `useMutation` (needs optimistic update) |
| Join waitlist button | Client Component | Server Action (simple, no optimistic needed) |
| Admin dashboard | Client Component | TanStack `useQuery` |

---

### Concrete Example: Publish Trip

The publish action needs an **optimistic update** — when the operator clicks "Publish →", you want the UI to immediately show the trip as "Live" and then roll back if the server returns 409 (race condition). This is exactly what `useMutation` is for:

```typescript
// Client Component
const mutation = useMutation({
  mutationFn: (tripId: string) => publishTrip(tripId), // publishTrip is a Server Action
  onMutate: () => {
    // immediately set trip status to LIVE in the cache (optimistic)
    queryClient.setQueryData(['trip', tripId], (old) => ({ ...old, status: 'LIVE' }))
  },
  onError: (error) => {
    if (error.code === 'SLOT_TAKEN') {
      // roll back and show race condition modal
      queryClient.invalidateQueries(['trip', tripId])
      showRaceConditionModal()
    }
  }
})
```

You cannot do this with a raw Server Action call — you would have to write the loading/error/rollback state yourself. `useMutation` gives it to you for free.

---

### Summary

- **Server Components** → `fetch()` / Prisma directly. No library.
- **Client Components reading data** → TanStack Query `useQuery`.
- **Client Components making changes** → TanStack Query `useMutation` when you need optimistic updates or complex error handling. Raw Server Action call when it is a simple fire-and-forget (join waitlist, delete draft, etc.).
- **Never use TanStack Query in Server Components** — it will throw.

---

## Q2. How Does SSE Work?

SSE stands for **Server-Sent Events**. It is a standard web technology built into every browser and every HTTP server.

### Normal HTTP vs SSE — The Key Difference

**Normal HTTP request:**

```
Client ──── GET /api/slots ──────────────────────► Server
Client ◄─── { slot1: "available", slot2: "taken" } Server
                         CONNECTION CLOSES
```

**SSE connection:**

```
Client ──── GET /api/slots/stream ───────────────► Server
Client ◄─── data: { slot2: "locked", ttl: 780 }    Server (3 seconds later)
Client ◄─── data: { slot2: "available" }            Server (15 minutes later)
Client ◄─── data: { slot1: "taken" }               Server (30 seconds later)
                         CONNECTION STAYS OPEN FOREVER
```

The HTTP connection is never closed. The server keeps the response body open and writes new chunks of text to it whenever something interesting happens.

---

### What the Wire Looks Like

When the server wants to send an event, it writes plain text in this exact format:

```
data: {"type":"slot.locked","slotId":"abc123","rank":2,"expiresAt":"2026-04-21T14:30:00Z"}

data: {"type":"slot.released","slotId":"abc123","rank":2}

```

Each event is one `data:` line followed by a **blank line**. The blank line tells the browser "this event is complete, process it." The browser fires your `onmessage` handler.

You can also name events:

```
event: slot.locked
data: {"slotId":"abc123"}

event: slot.released
data: {"slotId":"abc123"}

```

And the browser lets you listen by event name: `source.addEventListener('slot.locked', handler)`.

---

### The HTTP Headers That Make It Work

The server must set:

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

That is all. The browser sees `text/event-stream` and switches into streaming mode instead of waiting for the response to finish.

---

### The Browser API (EventSource)

```typescript
// Open the connection
const source = new EventSource('/api/slots/stream?categoryId=boat-sail-cyclades')

// Listen for all events
source.onmessage = (event) => {
  const data = JSON.parse(event.data)
  console.log('slot changed:', data)
}

// Listen for specific named events
source.addEventListener('slot.locked', (event) => {
  const { slotId, expiresAt } = JSON.parse(event.data)
  startCountdown(slotId, expiresAt)
})

// Handle connection errors (browser auto-reconnects)
source.onerror = (error) => {
  console.log('SSE connection error, browser will retry...')
}

// Close when done (e.g., component unmounts)
source.close()
```

**Auto-reconnect is built in.** If the network drops, the browser waits a few seconds and automatically re-opens the connection. You can configure the retry interval from the server: `retry: 3000\n\n` (3 seconds).

---

### How the Data Actually Flows in Island Tours

```
1. Operator A opens the slot picker
   → browser opens: EventSource('/api/slots/stream?categoryId=boat-sail-cyclades')
   → NestJS keeps the HTTP connection alive

2. Operator B (different tab, different operator) clicks "Reserve slot #2"
   → calls POST /api/slots/abc123/lock
   → SlotsService creates the SlotLock in the database
   → SlotsService publishes to Redis: PUBLISH slot-events:boat-sail-cyclades '{"type":"slot.locked",...}'

3. NestJS SSE handler is subscribed to that Redis channel
   → receives the message from Redis
   → writes it to ALL connected SSE clients watching that category

4. Operator A's browser receives the SSE event
   → onmessage fires
   → TanStack Query cache updated: slot #2 is now SOFT_LOCKED
   → Slot card UI updates: shows "🔒 soft-locked · 14:59" with countdown
   → Operator A sees this in real-time without refreshing
```

---

### Why SSE and Not WebSockets?

| Feature | SSE | WebSocket |
|---|---|---|
| Direction | Server → Client only | Both ways |
| Protocol | Plain HTTP | Separate WS protocol (upgrade required) |
| Browser support | Built in (EventSource) | Built in |
| Auto-reconnect | Built in | Must implement yourself |
| Works through proxies/CDN | Yes, easily | Sometimes tricky |
| NestJS setup | `@Sse()` decorator, 5 lines | `@WebSocketGateway()`, more setup |
| Good for slot updates | ✅ Perfect fit | Overkill |
| Good for live chat | ❌ Cannot send messages | ✅ Right tool |

For Island Tours, the operator never needs to push real-time messages to the server. All mutations (reserving a slot, publishing) are normal HTTP POST/PATCH calls. The only "real-time" need is receiving status changes from the server. SSE is the right tool.

---

## Q3. What Is the "SSE Gateway"?

The word "gateway" can be confusing because NestJS uses it for WebSocket gateways. The SSE gateway in this context is just a **NestJS service class** that sits between Redis pub/sub and the SSE HTTP connections.

Think of it as a translator:

```
Redis pub/sub message
        ↓
  SSE Gateway (service)
  "converts Redis messages into RxJS Observables"
        ↓
  NestJS @Sse() controller method
  "streams the Observable to the HTTP client"
        ↓
  Browser EventSource
```

---

### Why a Separate Service?

Because the `@Sse()` controller method must return an `Observable<MessageEvent>`. But the Redis subscription is created in a service. The gateway service:

1. Keeps a map of `categoryId → Redis subscriber`
2. When a new SSE client connects for a category, creates (or reuses) the Redis subscription for that channel
3. Returns an RxJS `Observable` that emits whenever Redis fires a message on that channel
4. When the last SSE client for a category disconnects, closes the Redis subscription for that channel

---

### Conceptual Structure (No Implementation Yet)

```typescript
// slot-events.gateway.ts — this is a plain NestJS service, not a WS gateway
@Injectable()
export class SlotEventsGateway {
  // When called with a categoryId, returns an Observable that emits
  // Redis pub/sub messages as SSE-compatible MessageEvents
  getStream(categoryId: string): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      // Subscribe to Redis channel for this category
      // On each Redis message, call subscriber.next({ data: message })
      // On cleanup (client disconnect), unsubscribe from Redis
    })
  }
}

// slots.controller.ts
@Controller('slots')
export class SlotsController {
  @Get('stream')
  @Sse()
  // @Sse() tells NestJS: keep the HTTP connection open, stream this Observable
  slotStream(@Query('categoryId') categoryId: string): Observable<MessageEvent> {
    return this.slotEventsGateway.getStream(categoryId)
  }
}
```

That is the entire SSE setup in NestJS. The `@Sse()` decorator does all the HTTP keep-alive work for you.

---

## Q4. Is BullMQ the Best Choice?

**Yes, BullMQ is the right choice for Island Tours.** You already have it installed and configured. Here is an honest comparison:

---

### BullMQ vs Alternatives

| Tool | Backed by | Best for | Issue for this project |
|---|---|---|---|
| **BullMQ** | Redis | Delayed jobs, job retries, repeatable jobs, job cancellation | None — already in stack |
| `@nestjs/schedule` | Node.js setInterval | Cron-style recurring jobs ("every night at midnight") | Cannot do "run in exactly 15 minutes", no persistence (jobs lost on restart) |
| **pg-boss** | PostgreSQL | Delayed jobs without needing Redis | You already have Redis — would add complexity for no gain |
| Temporal | Workflow orchestrator | Complex multi-step workflows with state | Overkill, major infrastructure addition |
| Agenda | MongoDB | Delayed jobs | You don't use MongoDB, adds a third database |

---

### Why BullMQ Specifically Fits

- **Delayed jobs with exact timing**: `queue.add('release-lock', data, { delay: 15 * 60 * 1000 })` — the job fires in exactly 15 minutes. `@nestjs/schedule` cannot do this.
- **Cancellable jobs**: You need to cancel the TTL job when the operator publishes before it expires. BullMQ lets you do `job.remove()` by job ID. Most alternatives don't.
- **Persistent across restarts**: Jobs are stored in Redis. If your NestJS server restarts, BullMQ re-reads the queue from Redis and processes pending jobs. `setTimeout` / `@nestjs/schedule` loses everything on restart.
- **Retry on failure**: If the worker crashes mid-job, BullMQ re-queues it automatically.
- **Already installed**: `@nestjs/bullmq`, `bullmq` are in your `package.json`.

---

### One Important BullMQ + Upstash Warning

BullMQ uses **Lua scripts** and Redis commands like `EVALSHA`, `BLPOP`, `XREAD`. Upstash has two Redis offerings:

- **Upstash Redis REST API (HTTP)** — does NOT work with BullMQ. This is Upstash's serverless HTTP wrapper. BullMQ's `ioredis` client uses TCP, not HTTP.
- **Upstash Redis with `ioredis` TCP connection** — works with BullMQ. Use the `UPSTASH_REDIS_URL` with `rediss://` protocol and standard `ioredis`.

Check your current BullMQ Redis connection in your NestJS config. As long as you are using `ioredis` with the TCP URL (starts with `redis://` or `rediss://`), BullMQ works fine with Upstash.

---

## Q5. Should I Use Upstash Redis or Locally Installed Redis?

**Short answer: Local Redis for development. Your current Upstash setup for production. Do not switch either.**

---

### What Upstash Redis Is

Upstash is a **managed, serverless Redis**. You don't install or run it. They run it, you connect. You pay per request (very cheap, has a free tier).

### What Local Redis Is

Redis installed on your machine or in a Docker container. `docker run -d -p 6379:6379 redis:alpine`. It's free, runs locally, zero latency.

---

### Development vs Production

**For local development:**

Use Docker Redis. It starts in one command, has zero latency (no network), and you can wipe it anytime without cost consequences.

```bash
docker run -d -p 6379:6379 --name redis-dev redis:alpine
```

In your `.env.development`:
```
REDIS_URL=redis://localhost:6379
```

**For production:**

You already have Upstash set up. Keep it. It's managed (no maintenance), has persistence, has TLS, and scales automatically. For the volume Island Tours will have early on, Upstash is completely sufficient.

---

### The Two Uses of Redis in This Project and Which Client to Use

| Use | Client | Upstash Compatible? |
|---|---|---|
| BullMQ job queues | `ioredis` (TCP) | Yes (use TCP URL, not REST) |
| Pub/Sub for SSE gateway | `ioredis` (TCP) | Yes (use TCP URL) |
| General cache (if any) | `@upstash/redis` (HTTP REST) | Yes |

**Rule:** Always use `ioredis` with a TCP Redis URL for BullMQ and pub/sub. Never use the `@upstash/redis` HTTP client for those — it doesn't support the commands they need.

Your `@upstash/redis` package (already in your backend) is fine for simple key-value caching. For BullMQ, check that BullMQ's Redis connection uses `ioredis` pointing to the TCP URL.

---

## Q6. Is Next.js `use cache` Enough, or Do I Need TanStack Query?

**They solve completely different problems. You need both — in different places.**

---

### What Next.js `use cache` Does

`use cache` (the new experimental directive in Next.js 15, successor to `unstable_cache`) caches the **output of a server-side function**. It runs on the **server**, before any HTML is sent to the browser.

```typescript
// This runs on the server
async function getTopTrips() {
  'use cache'
  // This result is cached for 60 seconds
  // If 1000 users load the homepage simultaneously,
  // only ONE database query happens. All 1000 get the cached result.
  const trips = await prisma.trip.findMany({ where: { status: 'LIVE' }})
  return trips
}
```

**It caches server render outputs.** It has nothing to do with the browser.

---

### What TanStack Query Does

TanStack Query maintains a **cache in the user's browser memory**. When the user navigates from the homepage to a trip detail and back, TanStack Query serves the previously fetched data instantly (no loading spinner) while re-fetching in the background.

```typescript
// This runs in the browser
function TripsList() {
  const { data, isLoading } = useQuery({
    queryKey: ['trips', filters],
    queryFn: () => fetchTrips(filters),
    staleTime: 30_000, // treat data as fresh for 30 seconds
  })
  // data is served from browser memory cache on re-visits
}
```

---

### The Crucial Difference

| | Next.js `use cache` | TanStack Query |
|---|---|---|
| Runs where? | **Server** | **Browser** |
| Caches what? | Server render output (HTML / data before it reaches browser) | Fetched data in browser memory |
| Works in Server Components? | ✅ Yes | ❌ No (needs hooks) |
| Works in Client Components? | ❌ No | ✅ Yes |
| Can integrate with SSE? | ❌ No | ✅ Yes |
| Optimistic updates? | ❌ No | ✅ Yes |
| Background refetch? | ❌ No | ✅ Yes |
| Reduces database calls | ✅ Yes (server side) | ❌ No (just re-uses browser data) |

---

### Concrete: Slot Picker Page

The slot picker is an interactive page with:
- A live countdown timer
- Slot cards that update when other operators lock/release slots
- A "Reserve" button that triggers a mutation
- An optimistic update (slot shows "soft-locked" immediately before server confirms)

`use cache` cannot help here at all. It runs before the page reaches the browser. Once in the browser, the slot state must update live via SSE events, and TanStack Query is what merges those SSE events into the UI's data layer.

### Concrete: Traveler Homepage

The traveler homepage shows featured trips. It does not need to be real-time. It's mostly static. A `use cache` with 60-second revalidation means:
- The server renders the page once
- For the next 60 seconds, all homepage requests get the cached version
- No database hit per user visit
- TanStack Query is completely unnecessary here

---

### Final Decision: Use Both, In Their Right Places

```
Next.js use cache     →  Server Components (traveler pages, SEO pages, public content)
TanStack Query        →  Client Components (operator dashboard, slot picker, admin panel)

These never compete. They operate in different environments.
```

The only grey area: operator dashboard initial data. You could:

1. **Server Component loads initial data** → passes it as props to a Client Component → TanStack Query is hydrated with that initial data via `initialData` or `dehydrate/HydrationBoundary`. This is the best pattern — fast initial load (SSR) + live updates (TanStack Query takes over after hydration).

2. **Client Component fetches everything** → loading spinner on first render, then TanStack Query manages it. Simpler but slower initial load.

For the operator dashboard and slot picker, use pattern 1: SSR the initial snapshot, then TanStack Query + SSE keep it live.
