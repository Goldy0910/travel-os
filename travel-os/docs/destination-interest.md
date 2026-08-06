# Traveler Interest Indicator

Monthly analytics for top-level destinations. The database still tracks unique travelers and per-event counters.

**UI (temporary):** badges show **`total_interest`** (every search / AI rec / detail view / trip add / favorite this month), not unique travelers. Switch display back to `unique_travelers` later.

UI copy (compact chip, never “planning to visit”):

> Manali · **4** travelers explored this month

## What is tracked

Only **top-level travel destinations**: cities, towns, regions, countries, islands.

Tracked examples: Manali, Goa, Bali, Japan, Switzerland.

**Not tracked:** attractions, restaurants, hotels, activities, landmarks, POIs  
(Rohtang Pass, Solang Valley, Hadimba Temple, Cafe 1947, Marriott Goa, river rafting).

Canonical ids are catalog / `travel_places` slugs (`manali-india`, `goa-india`, `japan`, …).

## Database schema

Migration: `supabase/migrations/20260805_destination_interest.sql`

### `destination_interest_monthly`

| Column | Notes |
| --- | --- |
| `id` | uuid pk |
| `destination_id` | text slug |
| `year`, `month` | UTC calendar period |
| `unique_travelers` | distinct actors with ≥1 event this month |
| `search_count` | SEARCH events |
| `ai_recommendation_count` | AI_RECOMMENDED events |
| `detail_view_count` | DETAIL_VIEW events |
| `trip_add_count` | TRIP_ADD events |
| `favorite_count` | FAVORITE events |
| `total_interest` | all events |
| `created_at`, `updated_at` | timestamptz |

Unique constraint: `(destination_id, year, month)`.

### `destination_interest_events`

| Column | Notes |
| --- | --- |
| `id` | uuid pk |
| `user_id` | auth uuid **or** `guest:<uuid>` |
| `destination_id` | text slug |
| `event_type` | enum-like text |
| `year`, `month` | copied from event time (UTC) |
| `created_at` | timestamptz |

Index on `(user_id, destination_id, year, month)` supports unique-traveler checks.

Writes go through `track_destination_interest(p_destination_id, p_event_type, p_actor_id)`  
(`SECURITY DEFINER`, advisory lock per actor+destination+month, atomic upsert).

## Event flow

```
User / AI interaction
        │
        ▼
Resolve top-level destination id (ignore POIs)
        │
        ▼
POST /api/analytics/destination-interest
  or DestinationInterestService.track*()
        │
        ▼
RPC track_destination_interest
        │
        ├─ insert destination_interest_events
        ├─ if first event this month for actor+dest → unique_travelers += 1
        └─ always increment the matching event counter + total_interest
```

A single traveler searching Manali 10×, opening details 5×, and adding a trip still counts as **1 unique traveler**. Event counters still increment.

New UTC month → new aggregate row. Previous months remain.

## Event types

Constants: `lib/destination-interest/constants.ts`

- `SEARCH`
- `AI_RECOMMENDED`
- `DETAIL_VIEW`
- `TRIP_ADD`
- `FAVORITE`

Add a new type by:

1. Extending the TS union / array.
2. Extending the SQL `event_type` check + RPC counter branch.
3. Adding a `trackX()` wrapper on `DestinationInterestService`.

## API endpoints

### `POST /api/analytics/destination-interest`

```json
{ "destinationId": "manali-india", "eventType": "SEARCH" }
```

```json
{ "success": true }
```

Auth: logged-in `user.id`, or guest cookie `tt99_dest_interest_sid`.  
Invalid destinations / analytics errors still return `{ success: true }` when possible so product flows never break. Validation errors on malformed payloads return `400`. Rate-limited per actor.

### `GET /api/destinations/{id}/interest`

```json
{
  "destinationId": "manali-india",
  "uniqueTravelers": 124,
  "totalInterest": 310,
  "searchCount": 80,
  "recommendationCount": 90,
  "detailViewCount": 70,
  "tripAddCount": 40,
  "favoriteCount": 30,
  "month": 8,
  "year": 2026
}
```

### `GET /api/destinations/interest?ids=manali-india,goa-india,bali-indonesia`

Batch read for destination cards (never N+1). Response: `{ "items": [ ...snapshots ] }`.

Reads are cached in-process (~60s) and in the browser helper (~45s).

## Reusable service

`lib/destination-interest/service.ts` → `DestinationInterestService`

- `trackSearch` / `trackRecommendation` / `trackView` / `trackTripAdd` / `trackFavorite`
- `track(destinationId, eventType, actorId)` shared implementation
- `getInterest` / `getInterestBatch`

Server factory: `createDestinationInterestService()` (`lib/destination-interest/server.ts`).

UI:

- `DestinationInterestBadge` — hides `0`, singularizes `1`
- `ChatDestinationInterestStrip` — chat replies (entities, prose, or conversation destination)
- `useDestinationInterest(ids)` — one batch fetch
- `trackDestinationInterestClient(id, type)` — fire-and-forget POST

## Where the count appears

The badge is shown only for **top-level destinations**, never on attraction / cafe / hotel cards by themselves.

| Surface | Example |
| --- | --- |
| Chat assistant reply | Sky strip under the reply when Manali is mentioned or is the conversation destination |
| Chat place drawer | On Manali itself, or labeled “Manali” when you open a place inside it |
| Expert destination cards | Only in discovery narrowing / shortlist |
| Find destination | `/find-destination/manali-india` and quiz result cards |
| Homepage | Recommendation cards + destination-check card |
| Place page | `/app/place/[id]` when the place resolves to a top-level destination |

Normal chat about Manali usually shows Google place cards (Hadimba, Old Manali, cafes) and **no** destination recommendation card. The chat interest strip is the primary place to see Manali’s monthly count in that flow.

Apply `supabase/migrations/20260805_destination_interest.sql` or counts stay at `0` and the badge stays hidden.

## Integration points

| Surface | Event | Notes |
| --- | --- | --- |
| Create-trip search select | `SEARCH` | client track |
| Create-trip submit / chat create-trip | `TRIP_ADD` | server, non-blocking |
| Homepage continue-planning / master-trip link | `TRIP_ADD` | `createLinkedTrip` |
| AI chat recommended destinations | `AI_RECOMMENDED` | `after()` — never blocks stream |
| Find-destination quiz results | `AI_RECOMMENDED` | `after()` |
| Homepage recommendation | `AI_RECOMMENDED` | `after()` on `/api/homepage-decision` |
| Homepage destination check | `SEARCH` | user-entered destination |
| Find-destination / place details | `DETAIL_VIEW` | client or `after()` |
| Save / favorite | `FAVORITE` | client |

AI responses and search continue even if analytics tables/RPC are missing.

## Extension points

- New event types: constants + SQL check + RPC branch + service method.
- New destinations: add to `DESTINATION_CATALOG` or `travel_places` / `lib/destination-interest/registry.ts`.
- New surfaces: call `track*` / client helper; display `DestinationInterestBadge`.
- Alternate stores: implement `DestinationInterestStore` (see `InMemoryDestinationInterestStore` for tests).

## Tests

```bash
cd travel-os
npm run test:destination-interest
```

Covers unique travelers, duplicate events, monthly reset, counters, API validation, badge copy, batching, and destination filtering.
