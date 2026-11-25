import { onRequest } from "firebase-functions/v2/https";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { logger } from "firebase-functions";

const shivaApp = getApps().find(app => app.name === "shiva-admin") ?? initializeApp({ projectId: "shiva-aibookstore" }, "shiva-admin");
const bookstoreApp = getApps().find(app => app.name === "bookstore-token-verifier") ?? initializeApp({ projectId: "bookstore-6ab08" }, "bookstore-token-verifier");

export const issueShivaChatToken = onRequest({ region: "asia-south1", cors: ["https://shiva-bookstore.vercel.app"] }, async (req, res) => {
  if (req.method !== "POST") { res.set("Allow", "POST").status(405).json({ error: "Method not allowed." }); return; }
  try {
    const header = req.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) { res.status(401).json({ error: "BOOKStore sign-in required." }); return; }
    const decoded = await getAuth(bookstoreApp).verifyIdToken(token);
    if (decoded.aud !== "bookstore-6ab08" || decoded.iss !== "https://securetoken.google.com/bookstore-6ab08" || !decoded.uid) {
      res.status(401).json({ error: "Invalid BOOKStore identity." }); return;
    }
    const customToken = await getAuth(shivaApp).createCustomToken(decoded.uid, { bookstoreUid: decoded.uid });
    res.set("Cache-Control", "no-store").status(200).json({ customToken });
  } catch (error) {
    logger.error("Shiva custom-token exchange failed", error);
    res.status(401).json({ error: "Could not verify BOOKStore session." });
  }
});
