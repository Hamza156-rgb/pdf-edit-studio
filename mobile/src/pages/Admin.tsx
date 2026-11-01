import { IonContent, IonHeader, IonPage, IonRefresher, IonRefresherContent, useIonAlert, useIonRouter } from "@ionic/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ChevronLeft, Database, FileText, Loader2, ShieldCheck, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../lib/auth";
import { ApiRequestError, haptic, restApi } from "../lib/native";

type Overview = { totalUsers: number; activeUsers: number; totalDocuments: number; managedBytes: number };
type AdminUser = { id: number; name: string | null; email: string | null; role: "user" | "admin"; accountStatus: "active" | "disabled" };

const formatBytes = (bytes: number) => bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** Admin console for the app, on the REST admin endpoints (/api/v1/admin/*). */
export default function Admin() {
  const router = useIonRouter();
  const queryClient = useQueryClient();
  const [presentAlert] = useIonAlert();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const overview = useQuery({ queryKey: ["admin", "overview"], queryFn: async () => (await restApi<{ data: Overview }>("/admin/overview")).data, enabled: isAdmin });
  const users = useQuery({ queryKey: ["admin", "users"], queryFn: async () => (await restApi<{ data: AdminUser[] }>("/admin/users")).data, enabled: isAdmin });
  const refreshAll = () => Promise.all([overview.refetch(), users.refetch()]);
  const onError = (error: unknown) => toast.error(error instanceof ApiRequestError ? error.message : "That didn't work. Please try again.");

  const setStatus = useMutation({
    mutationFn: (input: { id: number; accountStatus: AdminUser["accountStatus"] }) => restApi(`/admin/users/${input.id}`, { method: "PATCH", body: JSON.stringify({ accountStatus: input.accountStatus }) }),
    onSuccess: () => { haptic("success"); toast.success("Account status updated."); void queryClient.invalidateQueries({ queryKey: ["admin"] }); },
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: number) => restApi(`/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => { haptic("medium"); toast.success("User account removed."); void queryClient.invalidateQueries({ queryKey: ["admin"] }); },
    onError,
  });
  const confirmDelete = (account: AdminUser) => { haptic("warning"); void presentAlert({
    header: `Delete ${account.name || "this user"}?`,
    message: "This permanently removes the account. It can't be undone.",
    buttons: [{ text: "Cancel", role: "cancel" }, { text: "Delete", role: "destructive", handler: () => remove.mutate(account.id) }],
  }); };

  const stats = [
    { label: "Total users", value: overview.data?.totalUsers, icon: Users },
    { label: "Active users", value: overview.data?.activeUsers, icon: Activity },
    { label: "Document entries", value: overview.data?.totalDocuments, icon: FileText },
    { label: "Metadata", value: overview.data ? formatBytes(overview.data.managedBytes) : undefined, icon: Database },
  ];

  return (
    <IonPage>
      <IonHeader className="app-header app-header-scrolled ion-no-border">
        <div className="app-content flex h-14 items-center gap-2">
          <button type="button" onClick={() => router.canGoBack() ? router.goBack() : router.navigateRoot("/tabs/account")} aria-label="Back" className="-ml-2 grid h-10 w-10 place-items-center rounded-full active:bg-slate-100"><ChevronLeft className="h-6 w-6" /></button>
          <span className="font-display text-[17px] font-semibold tracking-[-.03em]">Admin console</span>
        </div>
      </IonHeader>
      <IonContent className="app-tab-content">
        {isAdmin && <IonRefresher slot="fixed" onIonRefresh={event => void refreshAll().finally(() => event.detail.complete())}><IonRefresherContent /></IonRefresher>}
        <main className="app-content pb-10 pt-4">
          {!isAdmin ? (
            <div className="mt-10 rounded-[24px] bg-white p-6 text-center shadow-[0_14px_30px_-24px_rgba(23,32,51,.5)]">
              <ShieldCheck className="mx-auto h-7 w-7 text-[#326ad8]" />
              <h1 className="mt-3 font-display text-xl font-semibold tracking-[-.04em]">Administrator access required</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">This view is limited to administrators. Private document contents are never shown here.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {stats.map(stat => (
                  <div key={stat.label} className="min-w-0 rounded-2xl bg-white p-4 shadow-[0_14px_26px_-22px_rgba(23,32,51,.55)]">
                    <stat.icon className="h-5 w-5 text-[#326ad8]" />
                    <p className="mt-4 truncate text-xs text-slate-500">{stat.label}</p>
                    <p className="mt-0.5 truncate font-display text-2xl font-semibold tracking-[-.05em]">{stat.value ?? "–"}</p>
                  </div>
                ))}
              </div>
              <h2 className="mt-7 text-[13px] font-bold uppercase tracking-[.14em] text-slate-400">User management</h2>
              <div className="mt-2 rounded-[24px] bg-white px-4 shadow-[0_14px_30px_-24px_rgba(23,32,51,.5)]">
                {users.isLoading ? <div className="grid h-24 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div> : (
                  <div className="divide-y divide-slate-100">
                    {users.data?.map(account => (
                      <div key={account.id} className="flex items-center gap-3 py-3.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-semibold">{account.name || "Unnamed user"}</p>
                          <p className="truncate text-[13px] text-slate-500">{account.email || "No email"} · {account.role}</p>
                          <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${account.accountStatus === "active" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{account.accountStatus}</span>
                        </div>
                        <button type="button" disabled={account.id === user?.id || setStatus.isPending} onClick={() => setStatus.mutate({ id: account.id, accountStatus: account.accountStatus === "active" ? "disabled" : "active" })} className="app-press h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold disabled:opacity-40">{account.accountStatus === "active" ? "Disable" : "Enable"}</button>
                        <button type="button" aria-label={`Delete ${account.name || "user"}`} disabled={account.id === user?.id || remove.isPending} onClick={() => confirmDelete(account)} className="app-press grid h-10 w-10 place-items-center rounded-xl border border-red-100 text-red-600 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </IonContent>
    </IonPage>
  );
}
