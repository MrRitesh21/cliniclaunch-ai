import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listAdminDoctors } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, ExternalLink, Calendar } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/admin/doctors/new")({
  component: NewSignupsPage,
});

function NewSignupsPage() {
  const fn = useServerFn(listAdminDoctors);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-doctors-new"],
    queryFn: () => fn({ data: {} }),
  });

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const rows = useMemo(() => {
    return ((data ?? []) as any[]).filter((r) => new Date(r.joined) >= sevenDaysAgo);
  }, [data]);

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-display">New Signups (7d)</h1>
        <p className="text-sm text-muted-foreground">
          Doctors who registered in the last 7 days. Total: {rows.length}
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-3 py-2">Doctor</th>
                <th className="text-left px-3 py-2">Clinic</th>
                <th className="text-left px-3 py-2">Specialty</th>
                <th className="text-left px-3 py-2">Joined</th>
                <th className="text-left px-3 py-2">Plan</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground/70">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground/70">
                    No new signups in the last 7 days.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/50">
                  <td className="px-3 py-2 font-medium text-foreground">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-semibold">
                        {r.doctorName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div>{r.doctorName}</div>
                        <div className="text-xs text-muted-foreground font-normal">{r.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-foreground/80">{r.clinicName}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.specialization}</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs flex items-center gap-1 mt-2">
                    <Calendar className="size-3" />
                    {new Date(r.joined).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={r.plan === "No Plan" ? "secondary" : "default"}>{r.plan}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-1.5">
                      <Button asChild size="sm" variant="outline">
                        <a href={`/c/${r.slug}`} target="_blank" rel="noreferrer">
                          <ExternalLink className="size-3.5" />
                        </a>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link to="/admin/doctors/$id" params={{ id: r.id }}>
                          View
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          document.cookie = `impersonating_doctor_id=${r.id}; path=/; max-age=28800`;
                          toast.success(`Impersonating ${r.doctorName}. Redirecting...`);
                          window.location.href = "/dashboard";
                        }}
                      >
                        Impersonate
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

import { useMemo } from "react";
