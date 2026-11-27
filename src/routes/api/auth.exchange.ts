import { createFileRoute } from "@tanstack/react-router";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function getAdminAuth() {
  const raw = process.env.SHIVA_FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("BOOKSTORE_SSO_NOT_CONFIGURED");
  const serviceAccount = JSON.parse(raw) as {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };
  if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is incomplete.");
  }
  const app = getApps().find((item) => item.name === "bookstore-sso")
    ?? initializeApp({ credential: cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key.replace(/\\n/g, "\n"),
    }) }, "bookstore-sso");
  return getAuth(app);
}

export const Route = createFileRoute("/api/auth/exchange")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json() as { idToken?: string };
          if (typeof body.idToken !== "string" || body.idToken.length < 100) {
            return Response.json({ error: "A valid BOOKStore sign-in token is required." }, { status: 400 });
          }
          const auth = getAdminAuth();
          const decoded = await auth.verifyIdToken(body.idToken, true);
          if (!decoded.uid || decoded.aud !== "bookstore-6ab08") {
            return Response.json({ error: "This token does not belong to BOOKStore." }, { status: 401 });
          }
          const customToken = await auth.createCustomToken(decoded.uid, {
            bookstoreSso: true,
            ssoSource: "Shiva-AI",
          });
          return Response.json({
            customToken,
            uid: decoded.uid,
            email: decoded.email ?? null,
            displayName: decoded.name ?? null,
            photoURL: decoded.picture ?? null,
          }, {
            headers: { "Cache-Control": "no-store" },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown SSO error";
          console.error("BOOKStore SSO exchange failed:", message);
          const notConfigured = message === "BOOKSTORE_SSO_NOT_CONFIGURED";
          return Response.json({
            error: notConfigured
              ? "Automatic BOOKStore sync is not configured yet. Add the Firebase service-account JSON to Vercel."
              : "BOOKStore account verification failed. Please try again.",
          }, { status: notConfigured ? 503 : 401 });
        }
      },
    },
  },
});
