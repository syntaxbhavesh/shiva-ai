import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const shivaConfig = {
  apiKey: "AIzaSyBFkurNM1y0ZzGOTltVHG5dnm8AOm8n_Ow",
  authDomain: "shiva-aibookstore.firebaseapp.com",
  databaseURL: "https://shiva-aibookstore-default-rtdb.firebaseio.com",
  projectId: "shiva-aibookstore",
  storageBucket: "shiva-aibookstore.firebasestorage.app",
  messagingSenderId: "122584720238",
  appId: "1:122584720238:web:c17c95f3ffa01dee3c977f",
  measurementId: "G-GJCCSZPDV5",
};

const shivaApp = getApps().find((app) => app.name === "shiva-chat") ?? initializeApp(shivaConfig, "shiva-chat");
export const shivaChatAuth = getAuth(shivaApp);
export const shivaChatDatabase = getDatabase(shivaApp);
