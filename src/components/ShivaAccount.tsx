import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { get, ref, serverTimestamp, set, update } from "firebase/database";
import { ChevronRight, CircleUserRound, LogOut, UserRound, X, BookOpen, Loader2 } from "lucide-react";
import { bookstoreAuth, bookstoreDatabase } from "@/lib/bookstore-firebase";

type AuthMode = "login" | "register";

export function ShivaAccount() {
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

  useEffect(() => onAuthStateChanged(bookstoreAuth, async (currentUser) => {
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
        // Preserve all existing BOOKStore fields (XP, subscription, goals, block status, etc.).
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
  }), []);

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
      <div className="fixed bottom-4 left-2 z-[60]">
        {menuOpen && (
          <>
            <button aria-label="Close account menu" className="fixed inset-0 z-[-1] cursor-default" onClick={() => setMenuOpen(false)} />
            <section className="absolute bottom-[calc(100%+10px)] left-0 w-[min(340px,calc(100vw-24px))] overflow-hidden rounded-[24px] border border-white/10 bg-[#252525] p-3 text-white shadow-[0_18px_70px_rgba(0,0,0,.65)] animate-[fade-in_.16s_ease-out]">
              <button onClick={() => { setProfileOpen(true); setMenuOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-white/[.07]">
                {user?.photoURL ? <img src={user.photoURL} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10"><CircleUserRound className="h-6 w-6" /></span>}
                <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-semibold">{user?.displayName || user?.email?.split("@")[0] || "Guest"}</span><span className="block truncate text-sm text-white/55">{user ? user.email : "Not signed in"}</span></span>
                <ChevronRight className="h-5 w-5 text-white/50" />
              </button>
              <div className="my-2 border-t border-white/10" />
              {user ? (
                <>
                  <button onClick={() => { setProfileOpen(true); setMenuOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] hover:bg-white/[.07]"><UserRound className="h-5 w-5 text-white/75" /> Profile</button>
                  <button onClick={() => void runAuth(() => signOut(bookstoreAuth))} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] text-red-300 hover:bg-white/[.07]"><LogOut className="h-5 w-5" /> Log out</button>
                </>
              ) : (
                <>
                  <button onClick={() => openAuth("login")} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] hover:bg-white/[.07]"><UserRound className="h-5 w-5 text-white/75" /> Login</button>
                  <button onClick={() => openAuth("login")} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] hover:bg-white/[.07]"><BookOpen className="h-5 w-5 text-white/75" /> Sync BOOKStore Account</button>
                  <button onClick={() => openAuth("register")} className="mt-2 w-full rounded-xl bg-white px-3 py-3 text-sm font-semibold text-black hover:bg-white/90">Create account</button>
                </>
              )}
            </section>
          </>
        )}
        <button onClick={() => setMenuOpen((open) => !open)} aria-label="Account menu" aria-expanded={menuOpen} className="flex items-center gap-2 rounded-full border border-white/10 bg-[#171717] p-2.5 pr-3 text-white shadow-lg transition hover:bg-[#262626]">
          {user?.photoURL ? <img src={user.photoURL} alt="" className="h-7 w-7 rounded-full object-cover" /> : <CircleUserRound className="h-7 w-7 text-white/80" />}
          <span className="hidden max-w-28 truncate text-xs font-medium sm:block">{user?.displayName || user?.email?.split("@")[0] || "Guest"}</span>
        </button>
      </div>

      {(authOpen || profileOpen) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3 backdrop-blur-md" onMouseDown={(event) => { if (event.target === event.currentTarget) { setAuthOpen(false); setProfileOpen(false); } }}>
          <section className="relative max-h-[92svh] w-full max-w-[440px] overflow-y-auto rounded-[28px] border border-white/10 bg-[#fdfdfd] p-6 text-[#171717] shadow-2xl sm:p-8">
            <button aria-label="Close" onClick={() => { setAuthOpen(false); setProfileOpen(false); }} className="absolute right-5 top-5 rounded-full p-2 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-[#eeeaff] text-[#6251dc]"><BookOpen className="h-8 w-8" /></div>
            {profileOpen && user ? (
              <div className="pt-2 text-center">
                <h2 className="text-2xl font-semibold">BOOKStore Profile</h2>
                <div className="my-5 flex flex-col items-center gap-2">{user.photoURL ? <img src={user.photoURL} alt="" className="h-16 w-16 rounded-full" /> : <CircleUserRound className="h-16 w-16 text-gray-400" />}<p className="font-semibold">{user.displayName || "BOOKStore User"}</p><p className="text-sm text-gray-500">{user.email}</p></div>
                <p className="mb-5 text-xs text-gray-500">Your Shiva AI sign-in uses the same Firebase Authentication account as BOOKStore.</p>
                <a href="https://bookstore-nt.vercel.app" target="_blank" rel="noreferrer" className="block rounded-xl bg-[#6251dc] px-4 py-3 font-semibold text-white">Open BOOKStore</a>
              </div>
            ) : (
              <>
                <h2 className="mb-6 text-center text-2xl font-semibold">Please Enter your Details</h2>
                <form onSubmit={submitEmail} className="space-y-3">
                  {mode === "register" && <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Full name" autoComplete="name" className="w-full rounded-xl border border-gray-200 bg-white px-4 py-4 outline-none focus:border-[#6251dc]" />}
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email Address" autoComplete="email" required className="w-full rounded-xl border border-gray-200 bg-white px-4 py-4 outline-none focus:border-[#6251dc]" />
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={6} required className="w-full rounded-xl border border-gray-200 bg-white px-4 py-4 outline-none focus:border-[#6251dc]" />
                  {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
                  <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6251dc] to-[#5141c9] px-4 py-4 font-semibold text-white disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{mode === "login" ? "Login" : "Create Account"}</button>
                </form>
                <button disabled={busy} onClick={() => void runAuth(() => signInWithPopup(bookstoreAuth, new GoogleAuthProvider()))} className="mt-3 flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 px-4 py-3.5 font-medium hover:bg-gray-50 disabled:opacity-60"><span className="text-lg font-bold text-[#4285F4]">G</span> Continue with Google</button>
                <p className="mt-5 text-sm text-gray-600">{mode === "login" ? "New User?" : "Already have an account?"} <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} className="font-semibold text-[#6251dc]">{mode === "login" ? "Create Account" : "Login"}</button></p>
                <p className="mt-5 text-center text-xs leading-relaxed text-gray-500">By continuing, you agree to BOOKStore's account terms and privacy policy.</p>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
