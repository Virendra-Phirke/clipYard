# ClipYard

ClipYard is a realtime clipboard-sharing app built with Next.js App Router and Firebase Realtime Database. It is designed to create temporary rooms, share short room codes, and securely sync encrypted clipboard text and presence data across connected devices.

## Features

- Create or join a temporary room with an 8-character code
- Realtime participant presence, device list, and clipboard updates
- Server-side encrypted clipboard storage using AES-GCM
- Firebase custom auth tokens scoped to a single room
- Host/participant role model with reclaim and room close logic
- Realtime Database read-only client access; all writes go through trusted server APIs
- Room heartbeat, disconnect cleanup, and client-side reconnect handling

## Architecture

### Client

- Next.js App Router pages render the landing page and room UI.
- `app/room/[roomId]/page.tsx` handles room join flow, Firebase sign-in, presence heartbeat, and realtime subscriptions.
- `services/room.ts` contains client-side APIs and Firebase RTDB listener helpers.
- `lib/firebase-client.ts` initializes Firebase and signs in with a custom token.

### Server

- `app/api/rooms/join/route.ts` creates room join responses and returns:
  - a server JWT for room API access
  - a Firebase custom auth token for realtime DB reads
- `app/api/rooms/[roomId]/route.ts` handles:
  - room snapshot fetches
  - presence heartbeats
  - clipboard writes
  - leave / host close actions
- `lib/firebase-admin.ts` initializes Firebase Admin and mints custom auth tokens.
- `lib/room-token.ts` signs and verifies server JWTs used for internal API authorization.
- `lib/room-data.ts` encrypts and decrypts clipboard text using AES-GCM and a server-side secret.

## Security Model

ClipYard is built with a defense-in-depth approach. The main protections are:

### 1. Firebase custom auth tokens scoped by room

- Every client joins a room by requesting a server endpoint.
- The server returns a Firebase custom token containing `roomId` in the token claims.
- The client signs into Firebase Auth with that custom token.
- Realtime Database rules allow reads only when `auth.token.roomId === $roomId`.

This enforces that a client can only observe realtime data for the room it was granted access to.

### 2. Read-only RTDB client access

- Client-side realtime listeners only read from the database.
- Clients never write directly to Firebase RTDB.
- All database writes are performed by server API routes behind JWT validation.

This means the realtime DB rules can safely deny write access at the root room path.

### 3. Server API authorization with JWT room tokens

- The server uses a separate signed JWT for internal API access (`lib/room-token.ts`).
- API routes verify this token for every request.
- Each token includes:
  - `roomId`
  - `role` (`host` or `participant`)
  - `sid` (session identifier)
- The token is valid for a limited window (24h) and is used for presence, saving text, leaving, and closing the room.

### 4. Encrypted clipboard storage

- Clipboard text is encrypted server-side using AES-GCM before it is written to Firebase.
- The encryption key is never sent to the client.
- Decryption is performed only by the trusted server snapshot endpoint.

This prevents plaintext clipboard data from being stored directly in the database.

### 5. Environment secrets and key handling

- Keep `FIREBASE_PRIVATE_KEY`, `JWT_SECRET`, and `ROOM_DATA_SECRET` out of source control.
- Use `.env.local` for local development and secure environment variables in deployment.
- `ROOM_DATA_SECRET` is the key used for clipboard encryption.
- `JWT_SECRET` is the key used to sign room-auth JWTs.

### 6. Realtime Database rules

Use the following rule set to limit access to the allowed room and read-only children:

```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        ".read": "auth != null && auth.token.roomId === $roomId",
        ".write": false,
        "meta": {
          ".read": "auth != null && auth.token.roomId === $roomId"
        },
        "presence": {
          ".read": "auth != null && auth.token.roomId === $roomId"
        },
        "clip": {
          ".read": "auth != null && auth.token.roomId === $roomId",
          "updatedAt": {
            ".read": "auth != null && auth.token.roomId === $roomId"
          }
        }
      }
    }
  }
}
```

#### Why this rule set?

- `auth != null && auth.token.roomId === $roomId` ensures only authenticated clients with the correct room claim can read.
- `.write: false` prevents any client-side writes to the room subtree.
- Explicit child rules keep the security model clear and narrow.

### 7. Presence and disconnect handling

- Clients send presence updates through a server endpoint.
- The Firebase RTDB `presence` node is readable by clients but not writable.
- The app registers an RTDB `onDisconnect.remove()` entry for each client to clean up stale presence.
- Presence is treated as active only when `lastSeen` is within the configured lifespan.

### 8. Host reclaim and room closing

- The host is initially created with a trusted `hostUid` and room token.
- If the host reconnects from the same fingerprint, the app can reclaim host ownership.
- Only the host can close the room, and the close action is protected by server-side role validation.

## Setup

### Required environment variables

Create `.env.local` with:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your_project.firebaseio.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
JWT_SECRET=your_jwt_secret
ROOM_DATA_SECRET=your_room_data_secret
```

### Important security notes

- Do not commit `.env.local` to version control.
- Use a secure, random value for `JWT_SECRET` and `ROOM_DATA_SECRET`.
- The `FIREBASE_PRIVATE_KEY` value must preserve literal `\n` sequences so the key parses correctly.
- In production, secure environment variables with your deployment platform.

### Firebase setup

1. Create a Firebase project.
2. Enable Realtime Database.
3. Create a service account and download the JSON credentials.
4. Set the service account values in `.env.local`.
5. Deploy Realtime Database rules from `database.rules.json` or paste them into the Firebase console.

## Running locally

Install dependencies:

```bash
pnpm install
```

Start the dev server:

```bash
pnpm dev
```

Open `http://localhost:3000`.

## Deployment

For production deployment:

- Build with `pnpm build`
- Start with `pnpm start`
- Ensure server-side env vars are configured securely
- Ensure Firebase rules are deployed before the app goes live

## Project Structure

- `app/` — Next.js App Router user-facing pages and API endpoints
  - `app/page.tsx` — landing page and room creation/join UI
  - `app/room/[roomId]/page.tsx` — room UI, auth flow, realtime listeners, and presence logic
  - `app/api/rooms/join/route.ts` — room join endpoint returning auth tokens
  - `app/api/rooms/[roomId]/route.ts` — room snapshot, presence, clipboard, and leave endpoints
- `services/room.ts` — browser-side room client helper library
- `lib/firebase-client.ts` — Firebase client initialization and custom token sign-in
- `lib/firebase-admin.ts` — Firebase Admin initialization and custom token minting
- `lib/room-token.ts` — JWT room token creation and verification
- `lib/room-data.ts` — encrypted clipboard text helpers
- `lib/presence.ts` — presence TTL configuration values
- `database.rules.json` — recommended RTDB security rules

## API Behavior

### `POST /api/rooms/join`

- Input: `{ roomId, fingerprint, name, deviceLabel, visitorId }`
- Output: `{ roomId, token, firebaseToken, role }`
- Returns a server JWT and Firebase custom auth token.
- Only valid when the room exists and is open.

### `GET /api/rooms/:roomId`

- Auth: bearer JWT or `token` query parameter
- Returns decrypted clipboard text, room status, active people count, and devices.
- The server verifies the room JWT before responding.

### `POST /api/rooms/:roomId`

- Auth: bearer JWT or `token` query parameter
- Records presence with `lastSeen`, `role`, `name`, `deviceLabel`, and `fingerprint`.
- Uses server-side Firebase Admin SDK to update RTDB.

### `PATCH /api/rooms/:roomId`

- Auth: bearer JWT or `token` query parameter
- Encrypts clipboard text and updates `rooms/:roomId/clip` with `text`, `updatedAt`, and `updatedBy`.

### `DELETE /api/rooms/:roomId`

- Auth: bearer JWT or `token` query parameter
- Without `x-close-room`: deletes only the caller presence entry.
- With `x-close-room: 1`: host-only room closure removes the entire room.

## Security Checklist

- [x] Custom Firebase auth tokens scoped by `roomId`
- [x] RTDB read-only access from client side
- [x] All writes mediated by server API with JWT auth
- [x] Encrypted clipboard storage server-side
- [x] Presence cleanup via `onDisconnect`
- [x] Room close protected by host role
- [x] Environment secrets kept outside source control

## Troubleshooting

### Firebase auth fails

- Confirm `NEXT_PUBLIC_FIREBASE_*` values are correct.
- Confirm `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` are set.
- Confirm the service account has Realtime Database access.

### Realtime listeners do not receive updates

- Confirm the Firebase DB rules have been deployed.
- Confirm the client signed in with a custom token containing `roomId`.
- Confirm `database.rules.json` matches the production rules.

### Room snapshot API returns unauthorized

- Confirm the room JWT is included in the request via `Authorization: Bearer <token>` or `?token=<token>`.
- Confirm the token has the correct `roomId` claim.

## Notes

- `sessionStorage` holds temporary room join tokens for the browser session.
- `localStorage` is used only for host fingerprint persistence and local display info.
- The clipboard text encryption key is derived server-side from `ROOM_DATA_SECRET`.
- The app is intentionally designed to avoid exposing decrypted text in the database.

## License

This project has no license specified.
