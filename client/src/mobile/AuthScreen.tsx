import { DocumentStack } from "@/components/Depth";
import { ApiRequestError, ApiSession, haptic, restApi, setStatusBar, storeToken } from "@/lib/native";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, Eye, EyeOff, Loader2, LockKeyhole, Mail, UserRound } from "lucide-react";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import { useLocation } from "wouter";

type Mode = "signin" | "signup";

export default function AuthScreen({ mode, onDone }: { mode: Mode; onDone: () => void }) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const signup = mode === "signup";

  useEffect(() => { setStatusBar("dark"); setError(null); setFieldErrors({}); }, [mode]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true); setError(null); setFieldErrors({});
    try {
      const session = await restApi<ApiSession>(signup ? "/auth/signup" : "/auth/login", { method: "POST", body: JSON.stringify(signup ? { name, email, password } : { email, password }) });
      await storeToken(session.token);
      await utils.auth.me.invalidate();
      haptic("success");
      onDone();
    } catch (caught) {
      haptic("warning");
      if (caught instanceof ApiRequestError) {
        setError(caught.message);
        if (caught.details) setFieldErrors(Object.fromEntries(caught.details.map(detail => [detail.path, detail.message])));
      } else setError("Something went wrong. Please try again.");
    } finally { setPending(false); }
  };

  return (
    <div className="app-screen relative flex min-h-[100dvh] flex-col overflow-hidden bg-[#0f172a]">
      <div className="depth-grid depth-grid-dark" />
      <div className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-[#326ad8]/40 blur-[90px]" />
      <header className="app-safe-top relative z-10 flex items-center px-3 pt-2">
        <button type="button" onClick={() => window.history.length > 1 ? window.history.back() : setLocation("/welcome")} aria-label="Back" className="grid h-11 w-11 place-items-center rounded-full text-white active:bg-white/10"><ChevronLeft className="h-6 w-6" /></button>
      </header>
      <div className="relative z-0 -mb-16 -mt-10 h-[230px] shrink-0"><DocumentStack compact /></div>

      <main className="app-sheet relative z-10 flex flex-1 flex-col rounded-t-[32px] bg-[#f7f9fc] px-6 pb-6 pt-7 text-[#172033] shadow-[0_-30px_60px_-30px_rgba(0,0,0,.6)]">
        <h1 className="font-display text-[1.9rem] font-semibold leading-tight tracking-[-.05em]">{signup ? "Create your account" : "Welcome back"}</h1>
        <p className="mt-1.5 text-[15px] leading-6 text-slate-500">{signup ? "Keep your document activity in a private workspace." : "Log in to pick up where you left off."}</p>

        <div className="mt-6 grid grid-cols-2 rounded-2xl bg-slate-200/70 p-1" role="tablist">
          {(["signin", "signup"] as const).map(option => <button key={option} type="button" role="tab" aria-selected={mode === option} onClick={() => { haptic("light"); setLocation(option === "signin" ? "/signin" : "/signup", { replace: true }); }} className={`rounded-xl py-2.5 text-sm font-semibold transition ${mode === option ? "bg-white text-[#172033] shadow-[0_2px_0_rgba(23,32,51,.06),0_8px_16px_-10px_rgba(23,32,51,.4)]" : "text-slate-500"}`}>{option === "signin" ? "Log in" : "Sign up"}</button>)}
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          {signup && <AppField icon={UserRound} label="Name" error={fieldErrors.name}><input value={name} onChange={event => setName(event.target.value)} autoComplete="name" enterKeyHint="next" placeholder="Your name" required className="app-input" /></AppField>}
          <AppField icon={Mail} label="Email" error={fieldErrors.email}><input value={email} onChange={event => setEmail(event.target.value)} type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" autoComplete="email" enterKeyHint="next" placeholder="you@example.com" required className="app-input" /></AppField>
          <AppField icon={LockKeyhole} label="Password" error={fieldErrors.password} trailing={<button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} className="-mr-2 grid h-10 w-10 place-items-center rounded-xl text-slate-400 active:bg-slate-100">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>}>
            <input value={password} onChange={event => setPassword(event.target.value)} type={showPassword ? "text" : "password"} autoComplete={signup ? "new-password" : "current-password"} enterKeyHint="go" placeholder="At least 8 characters" required minLength={8} className="app-input" />
          </AppField>
          {error && !Object.keys(fieldErrors).length && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={pending} className="app-press flex w-full items-center justify-center gap-2 rounded-2xl bg-[#172033] py-4 text-[15px] font-semibold text-white shadow-[0_3px_0_#0b1120,0_18px_30px_-16px_rgba(23,32,51,.9)] disabled:opacity-70">{pending && <Loader2 className="h-4 w-4 animate-spin" />}{pending ? "Please wait…" : signup ? "Create account" : "Log in"}</button>
        </form>

        <div className="mt-auto pt-6 text-center">
          <button type="button" onClick={onDone} className="py-2 text-sm font-medium text-slate-500">Continue as guest</button>
          <p className="mt-1 text-xs leading-5 text-slate-400">Guest editing works fully offline on this device.</p>
        </div>
      </main>
    </div>
  );
}

function AppField({ icon: Icon, label, error, trailing, children }: { icon: typeof Mail; label: string; error?: string; trailing?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <span className={`flex min-h-[54px] items-center gap-3 rounded-2xl border bg-white px-4 shadow-[inset_0_1px_2px_rgba(23,32,51,.05)] transition focus-within:ring-4 ${error ? "border-red-300 focus-within:ring-red-100" : "border-slate-200 focus-within:border-[#326ad8] focus-within:ring-[#326ad8]/10"}`}>
        <Icon className="h-5 w-5 shrink-0 text-slate-400" />{children}{trailing}
      </span>
      {error && <span className="mt-1.5 block text-xs text-red-600">{error}</span>}
    </label>
  );
}
