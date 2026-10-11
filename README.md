# Dental Hospital Login — Node.js + Express + MongoDB

A responsive dental hospital login page with an automatic healthcare image carousel and a real backend authentication flow.

## Stack

- HTML, CSS and vanilla JavaScript frontend
- Node.js
- Express.js
- MongoDB + Mongoose
- bcryptjs for password hashing
- JWT stored in an HttpOnly cookie
- Helmet security headers
- Login rate limiting

## 1. Install

```bash
npm install
```

## 2. Configure MongoDB and environment variables

Copy `.env.example` to `.env` and update the values.

For local MongoDB:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/dental_hospital
JWT_SECRET=use-a-long-random-secret-at-least-32-characters
ADMIN_EMAIL=admin@dentalhospital.com
ADMIN_PASSWORD=ChangeMe123!
```

For MongoDB Atlas, replace `MONGODB_URI` with your Atlas connection string.

## 3. Create the first admin account

```bash
npm run seed-admin
```

The command creates or updates the admin account using `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `ADMIN_NAME` from `.env`.

## 4. Start the application

```bash
npm start
```

Open:

`http://localhost:5000`

The Express server serves the frontend and API from the same origin, so the browser login form does not need a separate CORS setup.

## API

### POST `/api/auth/login`

Request:

```json
{
  "email": "admin@dentalhospital.com",
  "password": "ChangeMe123!",
  "remember": true
}
```

A successful login sets an HttpOnly `dental_session` cookie.

### GET `/api/auth/me`

Returns the currently authenticated user.

### POST `/api/auth/logout`

Clears the authentication cookie.

### GET `/api/health`

Checks server and MongoDB connection status.

## Admin panel (added)

After login, a user with no `clinicId` is sent to `/admin/onboarding.html` to create their clinic
and subdomain slug. Everyone else goes to `/admin/dashboard.html`. Pages: Dashboard, Registration,
Slots, Doctors, Patients, Settings — matching the earlier tree structure exactly.

## New API (added)

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /api/onboarding/check-slug?name=` | staff JWT | Suggests an available subdomain slug |
| `POST /api/onboarding/clinic` | staff JWT | Creates the clinic + subdomain, generates its n8n API key |
| `GET /api/slots/rules` | staff JWT | Read the recurring pattern |
| `PUT /api/slots/rules` | staff JWT | Replace the recurring pattern |
| `POST /api/slots` | staff JWT | Add a one-off override (block or add time) |
| `PUT /api/slots/:id` | staff JWT | Edit an override |
| `DELETE /api/slots/:id` | staff JWT | Delete an override |
| `GET /api/slots/available?date=` | staff JWT **or** `x-api-key` header | Computed real availability for that date |
| `POST /api/bookings` | staff JWT **or** `x-api-key` header | Book a slot (re-checks availability first) |
| `GET /api/bookings/today` | staff JWT | Today's list, feeds the dashboard and slot grid |
| `PUT /api/bookings/:id` | staff JWT | Reschedule / change status |
| `DELETE /api/bookings/:id` | staff JWT | Cancel (soft delete, never removed) |
| `GET /api/doctors`, `POST`, `PUT /:id`, `DELETE /:id` | staff JWT | Doctor CRUD |
| `GET /api/patients`, `GET /api/patients/:id/bookings` | staff JWT | Patient list and history |
| `GET /api/dashboard/summary` | staff JWT | Today's count, active patients, doctor count |

Only `GET /api/slots/available` and `POST /api/bookings` are meant to be called from n8n, using the
clinic's own API key in the `x-api-key` header. Everything else is admin-only.

| `GET /api/settings/api-key` | staff JWT | Reveals the clinic's n8n API key (Settings page) |
| `POST /api/settings/api-key/regenerate` | staff JWT | Regenerates it (breaks old n8n workflows using it) |

**Not yet built:** real Google OAuth (`POST /api/auth/google` is not implemented; the login page's
"Continue with Google" button has nowhere to send its token yet). Straightforward to add when
you're ready — ask and I'll build it into this same structure.

## Demo mode (for a quick walkthrough, not production use)

`npm run seed-admin` now also creates a demo clinic so the admin panel isn't empty on first login:

- Clinic: "Demo Dental Clinic" at slug `demo-clinic` (edit via `DEMO_CLINIC_NAME` / `DEMO_CLINIC_SLUG` in `.env`)
- One demo doctor
- A recurring slot pattern of exactly two windows, every day: **10:00–12:00** and **14:00–16:00**
  (each treated as one 120-minute slot, so the Slots page grid shows just these two)
- A generated n8n API key, printed to the console when you run the seed command, and viewable
  any time on the Settings page

Set `SEED_DEMO_CLINIC=false` in `.env` if you'd rather create your own clinic through the
onboarding screen instead of using the seeded demo one.

**What "demo" means here — the booking edge is not wired to real WhatsApp yet.** The backend is
fully functional: `POST /api/bookings` already accepts the `x-api-key` header and marks the source
as `whatsapp`, exactly as an n8n workflow would call it. To demo that edge without a live WhatsApp
Business account, call it directly, e.g. with curl:

```bash
curl -X POST http://localhost:5000/api/bookings \
  -H "Content-Type: application/json" \
  -H "x-api-key: <the key from Settings or the seed output>" \
  -d '{"date":"2026-09-27","startTime":"10:00","endTime":"12:00","patientName":"Demo Patient","patientPhone":"+919999999999"}'
```

Then open the admin panel's Dashboard or Slots page — the booking appears live, with its source
shown as WhatsApp, exactly as a real n8n pipeline would produce it. Point an actual n8n HTTP
Request node at the same URL and header once you're ready to wire the real WhatsApp channel.

## Important production notes

- Never commit `.env` to GitHub.
- Replace the example JWT secret with a long random secret.
- Use a strong admin password and change the example password immediately.
- Use HTTPS in production so the authentication cookie is sent with the `Secure` flag.
- The Google Workspace button in this UI is intentionally not wired to OAuth because Google OAuth requires your own Google Cloud OAuth client ID, redirect URI and allowed domain configuration.
- This project intentionally contains only the login page and authentication backend; no dashboard or appointment system is included.
