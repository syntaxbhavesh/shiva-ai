# Shiva AI chat storage using Vercel environment variables

Shiva AI keeps BOOKStore Authentication as the identity provider. The browser sends the signed-in BOOKStore ID token to the Vercel API. The server verifies it and derives the BOOKStore UID; the browser cannot choose another user's UID.

Chats are stored in the separate `shiva-aibookstore` Realtime Database using Firebase Admin SDK on the server. No Firebase Cloud Functions deployment or second Firebase client sign-in is needed.

## Vercel environment variables

Add these to the Vercel project for Production and Preview:

- `FIREBASE_SERVICE_ACCOUNT_JSON`: full service-account JSON from BOOKStore Firebase project `bookstore-6ab08`, used to verify BOOKStore ID tokens.
- `SHIVA_FIREBASE_SERVICE_ACCOUNT_JSON`: full service-account JSON from the separate `shiva-aibookstore` Firebase project, used to write chat data.
- `SHIVA_FIREBASE_DATABASE_URL`: `https://shiva-aibookstore-default-rtdb.firebaseio.com` (confirm the exact URL in Firebase Console).

Paste each service-account file's complete JSON as the environment-variable value. Do not paste Node.js code, do not use a `VITE_` prefix, and never expose private keys in browser code. After saving variables, redeploy Vercel.

## Firebase setup

Enable Realtime Database in `shiva-aibookstore`. Keep its client rules private because the Vercel server uses Admin SDK:

```json
{
  "rules": {
    ".read": false,
    ".write": false
  }
}
```

## Data layout

```text
users/{BOOKSTORE_UID}/chats/{CHAT_ID}
  id
  title
  messages
  createdAt
  updatedAt
```

The same BOOKStore UID is used as the owner key. Guests remain local-only. Signed-in chats sync, restore and delete through `/api/chats`.
