import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";

type ServiceAccount = { project_id?: string; client_email?: string; private_key?: string };
function parseServiceAccount(raw: string | undefined, name: string): ServiceAccount {
  if (!raw) throw new Error(`${name}_NOT_CONFIGURED`);
  let account: ServiceAccount;
  try { account = JSON.parse(raw) as ServiceAccount; }
  catch { throw new Error(`${name}_MUST_BE_VALID_SERVICE_ACCOUNT_JSON`); }
  if (!account.project_id || !account.client_email || !account.private_key) throw new Error(`${name}_INVALID_SERVICE_ACCOUNT_JSON`);
  return account;
}
function getAdminApp(name: string, envName: string, databaseURL?: string) {
  const existing = getApps().find(app => app.name === name);
  if (existing) return existing;
  const account = parseServiceAccount(process.env[envName], envName);
  return initializeApp({
    credential: cert({ projectId: account.project_id, clientEmail: account.client_email, privateKey: account.private_key.replace(/\\n/g, "\n") }),
    ...(databaseURL ? { databaseURL } : {}),
  }, name);
}
export async function verifyBookstoreIdToken(token: string) {
  const app = getAdminApp("bookstore-chat-auth", "FIREBASE_SERVICE_ACCOUNT_JSON");
  const decoded = await getAuth(app).verifyIdToken(token);
  if (decoded.aud !== "bookstore-6ab08" || decoded.iss !== "https://securetoken.google.com/bookstore-6ab08" || !decoded.uid) throw new Error("INVALID_BOOKSTORE_TOKEN");
  return decoded;
}
export function getShivaChatDatabase() {
  const url = process.env.SHIVA_FIREBASE_DATABASE_URL;
  if (!url) throw new Error("SHIVA_FIREBASE_DATABASE_URL_NOT_CONFIGURED");
  const app = getAdminApp("shiva-chat-database", "SHIVA_FIREBASE_SERVICE_ACCOUNT_JSON", url);
  return getDatabase(app);
}
