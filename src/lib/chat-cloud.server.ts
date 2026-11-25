import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";

type ServiceAccount = { project_id?: string; client_email?: string; private_key?: string };

function parseServiceAccount(raw: string | undefined, label: string): ServiceAccount {
  if (!raw) throw new Error(`${label}_NOT_CONFIGURED`);
  const value = JSON.parse(raw) as ServiceAccount;
  if (!value.project_id || !value.client_email || !value.private_key) {
    throw new Error(`${label}_INVALID`);
  }
  return value;
}

function adminApp(name: string, raw: string | undefined, databaseURL?: string) {
  const existing = getApps().find((app) => app.name === name);
  if (existing) return existing;
  const account = parseServiceAccount(raw, name.toUpperCase().replace(/-/g, "_"));
  return initializeApp({
    credential: cert({
      projectId: account.project_id,
      clientEmail: account.client_email,
      privateKey: account.private_key!.replace(/\\n/g, "\n"),
    }),
    ...(databaseURL ? { databaseURL } : {}),
  }, name);
}

export async function verifyBookstoreIdToken(idToken: string) {
  const app = adminApp("bookstore-chat-auth", process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  const decoded = await getAuth(app).verifyIdToken(idToken, true);
  if (decoded.aud !== "bookstore-6ab08" || !decoded.uid) {
    throw new Error("INVALID_BOOKSTORE_TOKEN");
  }
  return decoded;
}

export function getShivaChatDatabase() {
  const databaseURL = process.env.SHIVA_FIREBASE_DATABASE_URL;
  if (!databaseURL) throw new Error("SHIVA_FIREBASE_DATABASE_URL_NOT_CONFIGURED");
  const app = adminApp(
    "shiva-chat-database",
    process.env.SHIVA_FIREBASE_SERVICE_ACCOUNT_JSON,
    databaseURL,
  );
  return getDatabase(app);
}
