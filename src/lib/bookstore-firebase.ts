import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCcpG-oEqkDprgTwWXKt5CFsttjAQAZFNg",
  authDomain: "bookstore-6ab08.firebaseapp.com",
  databaseURL: "https://bookstore-6ab08-default-rtdb.firebaseio.com",
  projectId: "bookstore-6ab08",
  storageBucket: "bookstore-6ab08.firebasestorage.app",
  messagingSenderId: "102226032749",
  appId: "1:226032749:web:f7090175d2e53c2f522764",
};

const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
export const bookstoreAuth = getAuth(app);
export const bookstoreDatabase = getDatabase(app);
