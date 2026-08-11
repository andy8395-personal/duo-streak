import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { signInWithGoogle } from "@/lib/googleAuth";
import { toast } from "sonner";
import logo from "@/assets/pairup-logo.png.asset.json";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — PairUp" },
      { name: "description", content: "Sign in to PairUp to keep your shared habit streak alive." },
      { property: "og:title", content: "Sign in — PairUp" },
      { property: "og:description", content: "Sign in to PairUp to keep your shared habit streak alive." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app", replace: true });
    });
    // Catches the session set asynchronously by the native Google sign-in
    // deep link (see googleAuth.ts) — that resolves outside this component,
    // in the app-wide appUrlOpen listener, so we only find out via this event.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate({ to: "/app", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Welcome to PairUp!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/app", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      toast.error(error.message || "Google sign-in failed");
      setLoading(false);
      return;
    }
    // Web: the page is about to redirect away. Native: the system browser
    // is open; the appUrlOpen listener (registered in __root.tsx) picks up
    // the callback and completes the sign-in, after which the auth state
    // change fires and the user lands back here already signed in.
    setLoading(false);
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-6 pb-10 pt-14">
        <div className="flex items-center justify-center">
          <img src={logo.url} alt="PairUp logo" className="h-14 w-auto" />
        </div>
        <div className="mt-8 text-center">
          <h1 className="text-balance text-[30px] font-bold leading-tight tracking-tight">
            {mode === "signin" ? "Welcome back" : "Start your streak"}
          </h1>
          <p className="mx-auto mt-2 max-w-[300px] text-[15px] text-muted-foreground">
            Two people. One shared streak. Only counts when you both show up.
          </p>
        </div>

        <button
          onClick={google}
          disabled={loading}
          className="mt-8 flex items-center justify-center gap-3 rounded-full border-2 border-border bg-surface px-6 py-4 text-sm font-bold text-foreground shadow-[var(--shadow-card)] transition active:scale-[0.98] disabled:opacity-60"
        >
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> or {mode === "signin" ? "sign in" : "sign up"} with email <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          {mode === "signup" && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-2xl bg-muted px-4 py-4 text-[15px] font-semibold outline-none ring-primary/40 transition focus:ring-4"
            />
          )}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-2xl bg-muted px-4 py-4 text-[15px] font-semibold outline-none ring-primary/40 transition focus:ring-4"
          />
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 8 chars)"
            className="w-full rounded-2xl bg-muted px-4 py-4 text-[15px] font-semibold outline-none ring-primary/40 transition focus:ring-4"
          />
          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-full bg-primary px-6 py-4 text-sm font-bold text-primary-foreground shadow-[var(--shadow-primary)] transition active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? "…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-6 text-sm text-muted-foreground underline underline-offset-4"
        >
          {mode === "signin" ? "New to PairUp? Create an account" : "Have an account? Sign in"}
        </button>

        <Link to="/" className="mt-4 text-center text-xs text-muted-foreground">← Back home</Link>
      </div>
    </div>
  );
}
