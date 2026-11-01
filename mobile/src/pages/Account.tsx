import { App as CapacitorApp } from "@capacitor/app";
import { BrandMark, TiltCard } from "@/components/Depth";
import { useQuery } from "@tanstack/react-query";
import { useIonRouter, useIonViewWillEnter } from "@ionic/react";
import { ChevronRight, FileText, Info, Loader2, LogIn, LogOut, RotateCcw, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TabPage } from "../components/TabPage";
import { DOCUMENTS_QUERY_KEY, useAuth } from "../lib/auth";
import { formatBytes, useLibrary } from "../lib/documents";
import { haptic, isNative, restApi, setFlag } from "../lib/native";

type AccountDocument = { id: number; name: string; pageCount: number; byteSize: number; updatedAt: string };

export default function Account() {
  const router = useIonRouter();
  const { user, loading, logout, refresh: refreshUser } = useAuth();
  const activity = useQuery({ queryKey: DOCUMENTS_QUERY_KEY, queryFn: async () => (await restApi<{ data: AccountDocument[] }>("/documents?limit=100")).data, enabled: Boolean(user) });
  useIonViewWillEnter(() => { if (user) void activity.refetch(); });
  const { documents } = useLibrary();
  const [version, setVersion] = useState("Web preview");
  const [showPrivacy, setShowPrivacy] = useState(false);
  useEffect(() => { if (isNative()) void CapacitorApp.getInfo().then(info => setVersion(`Version ${info.version} (${info.build})`)).catch(() => undefined); }, []);

  const signOut = async () => { haptic("medium"); await logout(); toast.success("Signed out."); router.navigateRoot("/tabs/home"); };
  const replayIntro = async () => { await setFlag("onboarded", null); router.navigateRoot("/welcome"); };

  return (
    <TabPage onRefresh={() => Promise.all([refreshUser(), user ? activity.refetch() : Promise.resolve()])} title="Account" subtitle={user ? "Signed in" : "Guest mode"} showAccountButton={false}>
      {loading ? <div className="grid h-40 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div> : user ? (
        <TiltCard max={6} className="relative overflow-hidden rounded-[28px] bg-[#172033] p-5 text-white shadow-[0_30px_50px_-28px_rgba(23,32,51,.8)]">
          <div className="depth-grid depth-grid-dark" />
          <div className="relative flex items-center gap-4">
            <span className="depth-pop grid h-16 w-16 shrink-0 place-items-center rounded-[22px] bg-[linear-gradient(145deg,#4c84ee,#2457c0)] font-display text-2xl font-semibold shadow-[0_4px_0_#173f94,0_16px_26px_-12px_rgba(50,106,216,.9)]">{user.name?.slice(0, 1).toUpperCase() ?? "U"}</span>
            <div className="min-w-0"><p className="truncate font-display text-xl font-semibold tracking-[-.03em]">{user.name || "Your account"}</p><p className="truncate text-sm text-slate-300">{user.email}</p>{user.role === "admin" && <span className="mt-1.5 inline-block rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#cfe0ff]">ADMIN</span>}</div>
          </div>
          <div className="relative mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4"><Stat value={documents?.length ?? "–"} label="On this device" /><Stat value={activity.data?.length ?? "–"} label="Account saves" /></div>
        </TiltCard>
      ) : (
        <div className="relative overflow-hidden rounded-[28px] bg-[#172033] p-6 text-white">
          <div className="depth-grid depth-grid-dark" />
          <div className="relative"><h2 className="font-display text-2xl font-semibold tracking-[-.04em]">Make Editly yours</h2><p className="mt-2 text-sm leading-6 text-slate-300">Sign in to keep a private record of your document activity. Editing stays available as a guest.</p>
            <div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={() => router.push("/signup")} className="app-press rounded-2xl bg-white py-3.5 text-sm font-semibold text-[#172033] shadow-[0_3px_0_#c7d4ea]">Create account</button><button type="button" onClick={() => router.push("/signin")} className="app-press rounded-2xl border border-white/15 bg-white/[.07] py-3.5 text-sm font-semibold"><LogIn className="mr-1.5 inline h-4 w-4" />Log in</button></div>
          </div>
        </div>
      )}

      {user && (
        <section className="mt-6">
          <h2 className="text-[13px] font-bold uppercase tracking-[.14em] text-slate-400">Account activity</h2>
          <div className="mt-2 rounded-[24px] bg-white px-4 shadow-[0_14px_30px_-24px_rgba(23,32,51,.5)]">
            {activity.isLoading ? <div className="grid h-20 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
              : activity.data?.length ? <div className="divide-y divide-slate-100">{activity.data.slice(0, 5).map(item => <div key={item.id} className="flex items-center gap-3 py-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eef4ff] text-[#326ad8]"><FileText className="h-5 w-5" /></span><div className="min-w-0"><p className="truncate text-[15px] font-semibold">{item.name}</p><p className="text-[13px] text-slate-500">{item.pageCount} page{item.pageCount === 1 ? "" : "s"} · {formatBytes(item.byteSize)} · {new Date(item.updatedAt).toLocaleDateString()}</p></div></div>)}</div>
                : <p className="py-6 text-center text-sm text-slate-500">Saves from the editor are listed here.</p>}
          </div>
        </section>
      )}

      <section className="mt-6 overflow-hidden rounded-[24px] bg-white shadow-[0_14px_30px_-24px_rgba(23,32,51,.5)]">
        {user?.role === "admin" && <SettingRow icon={ShieldCheck} label="Admin console" onClick={() => router.push("/admin")} />}
        <SettingRow icon={Info} label="How your data is handled" onClick={() => setShowPrivacy(value => !value)} expanded={showPrivacy} />
        {showPrivacy && <p className="border-t border-slate-100 px-5 py-4 text-sm leading-6 text-slate-600">PDFs are opened, edited, and exported on this device. Your account stores document names, page counts, sizes, and dates — never the file contents.</p>}
        <SettingRow icon={RotateCcw} label="Replay the intro" onClick={() => void replayIntro()} />
        {user && <SettingRow icon={LogOut} label="Sign out" tone="danger" onClick={() => void signOut()} />}
      </section>

      <div className="mt-8 flex flex-col items-center gap-2 text-center text-xs text-slate-400"><BrandMark size="sm" /><span>Editly · {version}</span></div>
    </TabPage>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return <div><p className="font-display text-2xl font-semibold tracking-[-.04em]">{value}</p><p className="text-xs text-slate-300">{label}</p></div>;
}

function SettingRow({ icon: Icon, label, onClick, tone = "default", expanded }: { icon: typeof Info; label: string; onClick: () => void; tone?: "default" | "danger"; expanded?: boolean }) {
  return (
    <button type="button" onClick={() => { haptic("light"); onClick(); }} aria-expanded={expanded} className={`flex w-full items-center gap-3 border-t border-slate-100 px-5 py-4 text-left text-[15px] font-medium first:border-t-0 active:bg-slate-50 ${tone === "danger" ? "text-red-600" : "text-[#172033]"}`}>
      <span className={`grid h-9 w-9 place-items-center rounded-xl ${tone === "danger" ? "bg-red-50" : "bg-slate-100 text-slate-600"}`}><Icon className="h-[18px] w-[18px]" /></span>
      <span className="flex-1">{label}</span>
      {tone !== "danger" && <ChevronRight className={`h-5 w-5 text-slate-300 transition ${expanded ? "rotate-90" : ""}`} />}
    </button>
  );
}
