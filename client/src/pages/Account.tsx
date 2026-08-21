import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Eye, EyeOff, FilePenLine, LockKeyhole, Mail, UserRound } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type Mode = "signup" | "login";

export default function Account() {
  const [, setLocation] = useLocation();
  const { user, loading, refresh } = useAuth();
  const initialMode = new URLSearchParams(window.location.search).get("mode") === "login" ? "login" : "signup";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const signup = trpc.auth.nativeSignup.useMutation();
  const login = trpc.auth.nativeLogin.useMutation();
  const pending = signup.isPending || login.isPending;

  useEffect(() => { if (!loading && user) setLocation("/dashboard"); }, [loading, setLocation, user]);
  if (!loading && user) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      if (mode === "signup") await signup.mutateAsync({ name, email, password });
      else await login.mutateAsync({ email, password });
      await refresh();
      toast.success(mode === "signup" ? "Account created. Welcome to your workspace." : "Welcome back.");
      setLocation("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not continue with that account.");
    }
  };

  return <div className="grid min-h-screen place-items-center bg-[#f7f9fc] p-5 text-[#172033]"><main className="w-full max-w-[430px] rounded-[28px] border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60 sm:p-9"><button onClick={() => setLocation("/")} className="flex items-center gap-2 text-sm font-semibold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-[#172033] text-white"><FilePenLine className="h-4 w-4" /></span>Editly</button><p className="eyebrow mt-8">Your private workspace</p><h1 className="mt-3 font-display text-3xl font-semibold tracking-[-.055em]">{mode === "signup" ? "Create your account." : "Welcome back."}</h1><p className="mt-3 leading-6 text-slate-600">{mode === "signup" ? "Save document activity to your own workspace and pick up the next steps from your dashboard." : "Log in to see your private document activity and continue editing."}</p><div className="mt-7 grid grid-cols-2 rounded-xl bg-slate-100 p-1"><button onClick={() => setMode("signup")} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === "signup" ? "bg-white text-[#172033] shadow-sm" : "text-slate-500"}`}>Sign up</button><button onClick={() => setMode("login")} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === "login" ? "bg-white text-[#172033] shadow-sm" : "text-slate-500"}`}>Log in</button></div><form onSubmit={submit} className="mt-6 space-y-4">{mode === "signup" && <Field label="Name" icon={UserRound}><input autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder="Your name" required className="w-full bg-transparent outline-none" /></Field>}<Field label="Email" icon={Mail}><input autoComplete="email" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" required className="w-full bg-transparent outline-none" /></Field><Field label="Password" icon={LockKeyhole}><span className="flex min-w-0 flex-1 items-center"><input autoComplete={mode === "signup" ? "new-password" : "current-password"} type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters" minLength={8} required className="min-w-0 flex-1 bg-transparent outline-none" /><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} className="ml-2 grid h-7 w-7 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-[#172033] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#326ad8]">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span></Field><Button type="submit" disabled={pending} className="mt-2 w-full bg-[#172033] text-white hover:bg-[#26334d]">{pending ? "Please wait…" : mode === "signup" ? "Create account" : "Log in"}</Button></form><p className="mt-5 text-center text-xs leading-5 text-slate-500">Guest editing is still available. Account document activity is private to your signed-in workspace.</p></main></div>;
}

function Field({ label, icon: Icon, children }: { label: string; icon: typeof Mail; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span><span className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm transition focus-within:border-[#326ad8] focus-within:ring-2 focus-within:ring-[#326ad8]/10"><Icon className="h-4 w-4 shrink-0 text-slate-400" />{children}</span></label>; }
