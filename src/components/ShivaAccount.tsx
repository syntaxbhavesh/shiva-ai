import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type AuthMode = "login" | "register";

export function ShivaAccount({ expanded = false }: { expanded?: boolean }) {
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
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
                  <button onClick={() => { setMenuOpen(false); setLogoutConfirmOpen(true); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-400 transition-colors hover:bg-secondary"><LogOut className="h-[18px] w-[18px]" /> Log out</button>
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


      <AlertDialog open={logoutConfirmOpen} onOpenChange={setLogoutConfirmOpen}>
        <AlertDialogContent className="w-[calc(100%-32px)] max-w-[400px] rounded-2xl border-white/10 bg-[#202123] text-white shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-semibold">Log out of Shiva AI?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed text-white/60">
              Are you sure you want to log out? You can log back in anytime with your BOOKStore account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2 gap-2 sm:gap-2">
            <AlertDialogCancel className="mt-0 rounded-xl border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => void runAuth(() => signOut(bookstoreAuth))} className="rounded-xl bg-white px-4 text-[#202123] hover:bg-white/90">
              Log out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {(authOpen || profileOpen) && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/65 p-4 backdrop-blur-md animate-[fade-in_.18s_ease-out]"
          onMouseDown={(event) => { if (event.target === event.currentTarget) { setAuthOpen(false); setProfileOpen(false); } }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="account-dialog-title" className="relative my-auto w-full max-w-[420px] overflow-hidden rounded-3xl border border-white/10 bg-[#202123] p-6 text-white shadow-[0_28px_100px_rgba(0,0,0,.7)] sm:p-8">
            <button aria-label="Close" onClick={() => { setAuthOpen(false); setProfileOpen(false); }} className="absolute right-4 top-4 rounded-full p-2 text-white/55 transition hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
            <div className="mb-7 flex flex-col items-center text-center">
              <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[.06] text-white"><BookOpen className="h-6 w-6" /></div>
              <h2 id="account-dialog-title" className="text-2xl font-semibold tracking-tight">{profileOpen ? "Your account" : mode === "login" ? "Welcome back" : "Create your account"}</h2>
              <p className="mt-2 text-sm text-white/55">{profileOpen ? "Your BOOKStore account is connected to Shiva AI." : mode === "login" ? "Log in to continue to Shiva AI." : "Sign up to get started with Shiva AI."}</p>
            </div>
            {profileOpen && user ? (
              <div className="text-center">
                <div className="mb-5 flex flex-col items-center gap-2">{user.photoURL ? <img src={user.photoURL} alt="" className="h-16 w-16 rounded-full object-cover" /> : <CircleUserRound className="h-16 w-16 text-white/45" />}<p className="font-semibold">{user.displayName || "BOOKStore User"}</p><p className="text-sm text-white/55">{user.email}</p></div>
                <a href="https://bookstore-nt.vercel.app" target="_blank" rel="noreferrer" className="block rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#202123] transition hover:bg-white/90">Open BOOKStore</a>
              </div>
            ) : (
              <>
                <form onSubmit={submitEmail} className="space-y-4">
                  {mode === "register" && <label className="block space-y-2 text-sm font-medium text-white/80">Full name<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" autoComplete="name" className="w-full rounded-xl border border-white/15 bg-[#2f3033] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/40 focus:ring-2 focus:ring-white/10" /></label>}
                  <label className="block space-y-2 text-sm font-medium text-white/80">Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" required className="w-full rounded-xl border border-white/15 bg-[#2f3033] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/40 focus:ring-2 focus:ring-white/10" /></label>
                  <label className="block space-y-2 text-sm font-medium text-white/80">Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={6} required className="w-full rounded-xl border border-white/15 bg-[#2f3033] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/40 focus:ring-2 focus:ring-white/10" /></label>
                  {error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
                  <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#202123] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{mode === "login" ? "Continue" : "Create account"}</button>
                </form>
                <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-white/35"><span className="h-px flex-1 bg-white/10" />or<span className="h-px flex-1 bg-white/10" /></div>
                <button disabled={busy} onClick={() => void runAuth(() => signInWithPopup(bookstoreAuth, new GoogleAuthProvider()))} className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/15 bg-transparent px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[.06] disabled:opacity-60"><span className="grid h-5 w-5 place-items-center rounded-full bg-white text-sm font-bold text-[#4285F4]">G</span>Continue with Google</button>
                <p className="mt-6 text-center text-sm text-white/55">{mode === "login" ? "Don't have an account?" : "Already have an account?"} <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} className="font-semibold text-white underline-offset-4 hover:underline">{mode === "login" ? "Sign up" : "Log in"}</button></p>
                <p className="mt-5 text-center text-[11px] leading-relaxed text-white/35">By continuing, you agree to BOOKStore's account terms and privacy policy.</p>
              </>
            )}
          </section>
        </div>,
        document.body
      )}
    </>
  );
}
