# يوصل — لوحة المالك (Usil Owner Dashboard)

Standalone owner/admin console for Usil. React 19 + Vite + Tailwind 4, Arabic-first
and RTL, talking to the existing Express API in `../usil backend`. It adds nothing
to the backend — every screen is built on admin routes that already ship.

## Running

The backend must be running first (`npm run dev` in `../usil backend`, port 43147).

```bash
npm install
npm run dev       # http://127.0.0.1:5180
```

Sign in with an account whose role is `admin` or `accounts_manager` — those are the
two roles `requireRole(['admin'])` accepts on the server. Anything else is shown a
"no permission" screen rather than an empty dashboard.

Point it at a different backend with `USIL_API=http://host:port npm run dev`.

```bash
npm run build     # tsc --noEmit && vite build
npm run lint      # tsc --noEmit
npm run preview   # serve the build on 5180
```

## Why a Vite proxy

The session is an HttpOnly `midyaf_sid` cookie with `SameSite=Lax`. Dev proxies
`/api` and `/uploads` to the backend so the browser treats everything as one
origin and the cookie is sent without any CORS or cookie-domain work. In
production, serve this build behind the same hostname as the API.

## Layout

```
src/
  api/          client.ts (fetch + error envelope), endpoints.ts (typed calls), types.ts
  state/        session, toasts, pending-counts (the sidebar badges)
  components/
    ui/         Button, Card, Badge, Table, Modal, StatTile, form controls
    charts/     AreaChart, BarChart, SplitBar, Sparkline — hand-rolled SVG/CSS
    layout/     Shell (sidebar + topbar), nav definition
  screens/      one file per section
  lib/          format (Arabic + SAR), router (hash), theme, useResource, usePoll
```

### Screens → endpoints

| Screen | Endpoints |
|---|---|
| نظرة عامة | `/api/bookings`, `/api/admin/{users,listings,vendor-applications,couriers,moyasar}`, `/api/health` |
| الحجوزات | `GET/PATCH/DELETE /api/bookings` |
| طلبات المورّدين | `/api/admin/vendor-applications` + `/:id/approve`, `/:id/reject` |
| ملفات المورّدين | `/api/admin/vendor-hubs` |
| المنتجات | `GET /api/admin/listings`, `PATCH /api/admin/listings/:id` |
| طلبات المناديب | `/api/admin/couriers` + approve/reject |
| الحسابات | `/api/admin/users` (list/create/patch/delete) |
| طلبات المدن | `/api/admin/city-requests` (+ PATCH status) |
| رسائل الدعم | `GET /api/admin/support-messages` (read-only — no write route exists) |
| المحادثات | `GET/POST /api/chats`, `GET /api/chats/unread` (sidebar badge), `GET /api/chats/:id` (+ `?after=` for polling), `POST /api/chats/:id/{messages,read}`; vendor picker from `/api/admin/users` + `/api/admin/vendor-hubs` |
| المدفوعات | `GET/PUT /api/admin/moyasar` |
| الذكاء الاصطناعي | `GET/PUT /api/admin/integrations`, `POST /api/admin/integrations/test` |
| الظهور والفهرسة | `GET/PUT /api/admin/seo` |

## Two API shapes worth knowing

Both cost real debugging time, so they are commented at the call site too:

- **Login sends `identifier`, not `email`.** `loginHandler` rejects a body with no
  phone unless `identifier` contains an `@`, so `{email, password}` alone is a 400.
- **`PUT /api/admin/integrations` takes a FLAT body** (`{defaultProvider, anthropic:
  {...}}`), while the response nests providers under `providers`. Posting the
  response shape back is accepted and silently saves nothing.

## Colour

Chart colours are the validated categorical slots 1–3 (blue/orange/aqua) from the
data-viz palette, and all UI colour is CSS custom properties in `src/index.css` —
light and dark are each defined explicitly, never an automatic flip. The palette
clears the CVD, normal-vision and lightness gates in both modes as an all-pairs
set. Adding a fourth series colour means re-running the validator; on the light
surface aqua sits below 3:1 contrast, which is why every chart mark carries a
visible label rather than relying on fill alone.

Numbers use `ar-SA-u-nu-latn` — Arabic formatting with Latin digits, so template
literals and `Intl` output never end up side by side in two numeral systems.
