# Shiva AI cloud chat storage

Shiva AI uses BOOKStore Authentication as the identity provider and stores conversations in a separate Firebase Realtime Database project. The BOOKStore UID is the chat owner key, so the same account has the same UID in both systems.

## Required Vercel environment variables

Keep all of these server-side secrets (never use a `NEXT_PUBLIC_` prefix):

- `FIREBASE_SERVICE_ACCOUNT_JSON`: service-account JSON for the existing BOOKStore Firebase project `bookstore-6ab08`. The existing SSO exchange endpoint already uses this credential to verify BOOKStore ID tokens.
- `SHIVA_FIREBASE_SERVICE_ACCOUNT_JSON`: service-account JSON for the new, separate Shiva AI Firebase project.
- `SHIVA_FIREBASE_DATABASE_URL`: Realtime Database URL for the Shiva AI project. Copy the exact URL shown in Firebase Console.

Add them to Vercel for Production and Preview, then redeploy.

## Create the separate Firebase project

1. In Firebase Console, create a project named Shiva AI (or another project name reserved for this app).
2. Enable Realtime Database and create the database in your preferred region.
3. In Project settings → Service accounts, generate a private-key JSON for the Shiva AI project. Store the entire JSON privately as `SHIVA_FIREBASE_SERVICE_ACCOUNT_JSON`.
4. Copy the Realtime Database URL into `SHIVA_FIREBASE_DATABASE_URL`.
5. Keep database client rules closed because all chat reads and writes go through the server using Firebase Admin SDK. Suggested rules:

```json
{
  "rules": {
    ".read": false,
    ".write": false
  }
}
```

6. Ensure the BOOKStore service-account JSON is set as `FIREBASE_SERVICE_ACCOUNT_JSON`; it must belong to project `bookstore-6ab08`.

## Data layout

```text
users/
  <BOOKSTORE_UID>/
    chats/
      <CHAT_ID>/
        id
        title
        messages
        createdAt
        updatedAt
```

The API derives the UID from a verified BOOKStore ID token. It does not accept a UID supplied by the browser. Guests remain local-only; signed-in users sync their chat list and messages to the Shiva AI database and can restore them after signing in again.

## Important

The app code does not create Firebase projects or service accounts. Complete the Firebase Console and Vercel environment setup above before cloud sync can work. Existing guest/local conversations are not automatically uploaded to a newly signed-in account.
