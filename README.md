# ClipYard

ClipYard is a realtime clipboard sharing app built with Next.js App Router, Firebase Realtime Database, and Firebase custom authentication.

It allows one user to create a temporary room, share the room code or link, and instantly share encrypted clipboard text and presence updates across connected devices.

## Features

- Create or join a temporary room with an 8-character code
- Realtime presence and participant list updates via Firebase Realtime Database
- Realtime clipboard sync across devices
- Server-side clipboard text encryption using AES-GCM
- Firebase custom auth tokens to restrict database access to one room
- Host/participant role handling with room ownership reclaim support
- Client-side room connection and heartbeat logic

## Tech Stack

- Next.js 16 (App Router)
- React 19
- Firebase Realtime Database
- Firebase Auth custom tokens
- Firebase Admin SDK for server-side token minting and database writes
- TypeScript
- Tailwind CSS / inline styles for UI

## Getting Started

### Prerequisites

- Node.js 20+ / pnpm 11+
- Firebase project with Realtime Database enabled
- Firebase service account credentials

### Install dependencies

```bash
pnpm install
```

### Environment variables

Create a `.env.local` file at the repository root with the following values:

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

> Note: `FIREBASE_PRIVATE_KEY` must preserve newlines as `\n` when stored in `.env.local`.

### Run locally

```bash
pnpm dev
```

Open `http://localhost:3000` in your browser.

## Firebase Setup

1. Create a Firebase project.
2. Enable Realtime Database in test or locked mode.
3. Create a service account and download the JSON credentials.
4. Set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` from the service account.
5. Ensure the Realtime Database URL is set in `NEXT_PUBLIC_FIREBASE_DATABASE_URL` and `NEXT_PUBLIC_FIREBASE_PROJECT_ID`.

## Database Rules

The app uses room-level auth via custom Firebase tokens. Realtime Database rules should allow reads only when the client is authenticated and the token contains the correct room claim:

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

## Project Structure

- `app/` - Next.js App Router pages and API routes
- `services/room.ts` - client room API, realtime subscriptions, token caching, presence logic
- `lib/firebase-client.ts` - Firebase client initialization and custom sign-in
- `lib/firebase-admin.ts` - Firebase admin initialization and custom token minting
- `lib/room-token.ts` - JWT room token issuance and verification
- `lib/room-data.ts` - clipboard text encryption/decryption helpers
- `lib/presence.ts` - shared presence heartbeat configuration
- `database.rules.json` - recommended Realtime Database security rules

## Usage

- Create a room from the landing page.
- Enter your display name when prompted.
- Share the room link or room code with another device.
- Text updates are saved to the room and synced using realtime listeners.
- Presence is maintained by a heartbeat POST endpoint and cleaned up on disconnect.

## Useful Scripts

- `pnpm dev` - start development server
- `pnpm build` - build production app
- `pnpm start` - run production server
- `pnpm lint` - run ESLint

## Notes

- The app stores temporary room tokens in `sessionStorage` and host fingerprint state in `localStorage`.
- Encrypted clipboard text is decrypted server-side and never exposed in plaintext outside the room snapshot API.
- Presence entries use a short lifespan and are refreshed every few seconds.

## Troubleshooting

- If the app cannot connect to Firebase, verify all `NEXT_PUBLIC_FIREBASE_*` and server-side Firebase env vars.
- If realtime updates fail, confirm the Realtime Database rules are deployed and the auth token includes `roomId`.
- For host reclaim and room ownership, ensure the same browser fingerprint value is available.

## License

This project has no license specified.
