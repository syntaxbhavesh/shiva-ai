import { useEffect, useRef, useState } from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithCustomToken,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { get, ref, serverTimestamp, set, update } from "firebase/database";
import { ChevronRight, CircleUserRound, LogOut, UserRound, X, BookOpen, Loader2 } from "lucide-react";
import { bookstoreAuth, bookstoreDatabase } from "@/lib/bookstore-firebase";

type AuthMode = "login" | "register";

export function ShivaAccount({ expanded = false }: { expanded?: boolean }) {
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ssoPopup = useRef<Window | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(bookstoreAuth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) return;
      const userRef = ref(bookstoreDatabase, `users/${currentUser.uid}`);
      try {
        const snapshot = await get(userRef);
        const device = typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 180) : "Unknown";
        if (!snapshot.exists()) {
          await set(userRef, {
            displayName: currentUser.displayName || currentUser.email?.split("@")[0] || "BOOKStore User",
            email: currentUser.email || "",
            photoURL: currentUser.photoURL || "",
            createdAt: serverTimestamp(),
            lastSeen: serverTimestamp(),
            device,
            from: "Shiva-AI",
          });
        } else {
          await update(userRef, {
            displayName: currentUser.displayName || currentUser.email?.split("@")[0] || "BOOKStore User",
            email: currentUser.email || "",
            photoURL: currentUser.photoURL || "",
            lastSeen: serverTimestamp(),
            device,
            from: "Shiva-AI",
          });
        }
      } catch (syncError) {
        console.error("BOOKStore account sync failed:", syncError);
      }
    });

    const handleBookstoreMessage = async (event: MessageEvent) => {
      if (event.origin !== "https://bookstore-nt.vercel.app") return;
      if (ssoPopup.current && event.source !== ssoPopup.current) return;
      if (event.data?.type !== "BOOKSTORE_SSO_TOKEN" || typeof event.data.idToken !== "string") return;
      setBusy(true);
      setError("");
      try {
        const response = await fetch("/api/auth/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: event.data.idToken }),
        });
        const payload = await response.json() as { customToken?: string; error?: string };
        if (!response.ok || !payload.customToken) {
          throw new Error(payload.error || "Could not verify your BOOKStore session.");
        }
        await signInWithCustomToken(bookstoreAuth, payload.customToken);
        ssoPopup.current?.close();
        ssoPopup.current = null;
        setMenuOpen(false);
        setAuthOpen(false);
      } catch (syncError) {
        setError(syncError instanceof Error ? syncError.message : "BOOKStore account sync failed.");
      } finally {
        setBusy(false);
      }
    };

    window.addEventListener("message", handleBookstoreMessage);
    return () => {
      unsubscribe();
      window.removeEventListener("message", handleBookstoreMessage);
    };
  }, []);

  function startBookstoreSync() {
    setError("");
    const popup = window.open(
      "https://bookstore-nt.vercel.app/?shiva_sso=1",
      "bookstore-sso",
      "popup=yes,width=520,height=720"
    );
    if (!popup) {
      setError("Your browser blocked the BOOKStore sync window. Allow popups and try again.");
      return;
    }
    ssoPopup.current = popup;
    setBusy(true);
  }

  async function runAuth(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      setAuthOpen(false);
      setMenuOpen(false);
      setPassword("");
    } catch (authError) {
      const code = (authError as { code?: string }).code;
      const messages: Record<string, string> = {
        "auth/invalid-credential": "Incorrect email or password.",
        "auth/email-already-in-use": "An account already exists with this email. Try logging in.",
        "auth/weak-password": "Use a password with at least 6 characters.",
        "auth/popup-closed-by-user": "Google sign-in was cancelled.",
        "auth/popup-blocked": "Your browser blocked the Google sign-in popup. Allow popups and try again.",
        "auth/invalid-email": "Please enter a valid email address.",
        "auth/unauthorized-domain": "This Shiva AI domain is not authorized in Firebase yet. Add shiva-bookstore.vercel.app and shiva-ai-git-main-syntaxbhavesh.vercel.app in Firebase Authentication → Settings → Authorized domains.",
        "auth/operation-not-allowed": "This sign-in method is disabled. Enable Email/Password and Google in Firebase Authentication → Sign-in method.",
        "auth/operation-not-supported-in-this-environment": "This sign-in method is unavailable in this browser. Try opening Shiva AI in Chrome.",
        "auth/too-many-requests": "Too many attempts. Please wait a little and try again.",
        "auth/network-request-failed": "Network error. Check your connection and try again.",
      };
      setError(messages[code || ""] || (authError instanceof Error ? authError.message : "Authentication failed."));
    } finally {
      setBusy(false);
    }
  }

  function openAuth(nextMode: AuthMode = "login") {
    setMode(nextMode);
    setError("");
    setAuthOpen(true);
    setMenuOpen(false);
  }

  async function submitEmail(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) return;
    await runAuth(async () => {
      if (mode === "register") {
        const credential = await createUserWithEmailAndPassword(bookstoreAuth, email.trim(), password);
        if (displayName.trim()) await updateProfile(credential.user, { displayName: displayName.trim() });
      } else {
        await signInWithEmailAndPassword(bookstoreAuth, email.trim(), password);
      }
    });
  }

  return (
    <>
      <div className="relative w-full">
        {menuOpen && (
          <>
            <button aria-label="Close account menu" className="fixed inset-0 z-[59] cursor-default" onClick={() => setMenuOpen(false)} />
            <section className="absolute bottom-[calc(100%+10px)] left-0 z-[61] w-[min(340px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-border bg-sidebar p-2 text-foreground shadow-2xl animate-[fade-in_.16s_ease-out]">
              <button onClick={() => { setProfileOpen(true); setMenuOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-secondary">
                {user?.photoURL ? <img src={user.photoURL} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary"><CircleUserRound className="h-5 w-5" /></span>}
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{user?.displayName || user?.email?.split("@")[0] || "Guest"}</span><span className="block truncate text-xs text-muted-foreground">{user ? user.email : "Not signed in"}</span></span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
              <div className="my-1 border-t border-border" />
              {user ? (
                <>
                  <button onClick={() => { setProfileOpen(true); setMenuOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"><UserRound className="h-[18px] w-[18px]" /> Profile</button>
                  <button onClick={() => void runAuth(() => signOut(bookstoreAuth))} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-400 transition-colors hover:bg-secondary"><LogOut className="h-[18px] w-[18px]" /> Log out</button>
                </>
              ) : (
                <>
                  <button onClick={() => openAuth("login")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"><UserRound className="h-[18px] w-[18px]" /> Login</button>
                  <button onClick={startBookstoreSync} disabled={busy} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"><BookOpen className="h-[18px] w-[18px]" /> {busy ? "Connecting to BOOKStore..." : "Sync BOOKStore Account"}</button>
                  <button onClick={() => openAuth("register")} className="mt-1 w-full rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90">Create account</button>
                </>
              )}
            </section>
          </>
        )}
        <button onClick={() => setMenuOpen((open) => !open)} title="Account" aria-label="Account menu" aria-expanded={menuOpen} className={`flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground active:scale-[.98] ${expanded ? "" : "justify-center px-0"}`}>
          {user?.photoURL ? <img src={user.photoURL} alt="" className="h-[22px] w-[22px] shrink-0 rounded-full object-cover" /> : <CircleUserRound className="h-[21px] w-[21px] shrink-0" />}
          {expanded && <span className="min-w-0 flex-1 truncate text-left">{user?.displayName || user?.email?.split("@")[0] || "Guest"}</span>}
        </button>
      </div>

      {(authOpen || profileOpen) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-3 backdrop-blur-[2px] transition-colors" onMouseDown={(event) => { if (event.target === event.currentTarget) { setAuthOpen(false); setProfileOpen(false); } }}>
          <section className="relative max-h-[92svh] w-full max-w-[440px] overflow-y-auto rounded-[28px] border border-white/15 bg-[#202124]/95 p-6 text-white shadow-[0_24px_90px_rgba(0,0,0,.65)] backdrop-blur-2xl sm:p-8">
            <button aria-label="Close" onClick={() => { setAuthOpen(false); setProfileOpen(false); }} className="absolute right-5 top-5 rounded-full p-2 text-white/65 transition hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
            <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/[.08] text-[#a99bff]"><BookOpen className="h-8 w-8" /></div>
            {profileOpen && user ? (
              <div className="pt-2 text-center">
                <h2 className="text-2xl font-semibold text-white">BOOKStore Profile</h2>
                <div className="my-5 flex flex-col items-center gap-2">{user.photoURL ? <img src={user.photoURL} alt="" className="h-16 w-16 rounded-full" /> : <CircleUserRound className="h-16 w-16 text-white/45" />}<p className="font-semibold text-white">{user.displayName || "BOOKStore User"}</p><p className="text-sm text-white/55">{user.email}</p></div>
                <p className="mb-5 text-xs text-white/55">Your Shiva AI sign-in uses the same Firebase Authentication account as BOOKStore.</p>
                <a href="https://bookstore-nt.vercel.app" target="_blank" rel="noreferrer" className="block rounded-xl bg-[#6251dc] px-4 py-3 font-semibold text-white transition hover:bg-[#7162e8]">Open BOOKStore</a>
              </div>
            ) : (
              <>
                <h2 className="mb-6 text-center text-2xl font-semibold text-white">Please Enter your Details</h2>
                <form onSubmit={submitEmail} className="space-y-3">
                  {mode === "register" && <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Full name" autoComplete="name" className="w-full rounded-xl border border-white/10 bg-[#111214] px-4 py-4 text-white placeholder:text-white/40 outline-none transition focus:border-[#8172ff] focus:ring-2 focus:ring-[#8172ff]/20" />}
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email Address" autoComplete="email" required className="w-full rounded-xl border border-white/10 bg-[#111214] px-4 py-4 text-white placeholder:text-white/40 outline-none transition focus:border-[#8172ff] focus:ring-2 focus:ring-[#8172ff]/20" />
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={6} required className="w-full rounded-xl border border-gray-200 bg-white px-4 py-4 outline-none focus:border-[#6251dc]" />
                  {error && <p role="alert" className="rounded-lg border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
                  <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6251dc] to-[#5141c9] px-4 py-4 font-semibold text-white disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{mode === "login" ? "Login" : "Create Account"}</button>
                </form>
                <button disabled={busy} onClick={() => void runAuth(() => signInWithPopup(bookstoreAuth, new GoogleAuthProvider()))} className="mt-3 flex w-full items-center justify-center gap-3 rounded-xl border border-white/15 bg-white/[.04] px-4 py-3.5 font-medium text-white transition hover:bg-white/[.09] disabled:opacity-60"><span className="text-lg font-bold text-[#4285F4]">G</span> Continue with Google</button>
                <p className="mt-5 text-sm text-white/65">{mode === "login" ? "New User?" : "Already have an account?"} <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} className="font-semibold text-[#a99bff] hover:text-white">{mode === "login" ? "Create Account" : "Login"}</button></p>
                <p className="mt-5 text-center text-xs leading-relaxed text-white/45">By continuing, you agree to BOOKStore's account terms and privacy policy.</p>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
