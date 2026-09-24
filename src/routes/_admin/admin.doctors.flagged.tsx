import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listAdminDoctors } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ExternalLink, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useMemo } from "react";

export const Route = createFileRoute("/_admin/admin/doctors/flagged")({
  component: FlaggedDoctorsPage,
});

function FlaggedDoctorsPage() {
  const fn = useServerFn(listAdminDoctors);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-doctors-flagged"],
    queryFn: () => fn({ data: { status: "suspended" } }),
  });

  const rows = useMemo(() => {
    return (data ?? []) as any[];
  }, [data]);

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-display flex items-center gap-2">
          <AlertTriangle className="size-6 text-red-500" />
          Flagged / Suspended Doctors
        </h1>
        <p className="text-sm text-muted-foreground">
          Doctors whose access has been temporarily suspended. Total: {rows.length}
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
                <th className="text-left px-3 py-2">Reason</th>
                <th className="text-left px-3 py-2">Status</th>
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
                    No suspended doctors. All clear!
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/50">
                  <td className="px-3 py-2 font-medium text-foreground">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center text-xs font-semibold">
                        <ShieldAlert className="size-4" />
                      </div>
                      <div>
                        <div>{r.doctorName}</div>
                        <div className="text-xs text-muted-foreground font-normal">{r.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-foreground/80">{r.clinicName}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.specialization}</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs italic">
                    Suspended by Admin (Verify in detail page)
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="destructive">Suspended</Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-1.5">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/admin/doctors/$id" params={{ id: r.id }}>
                          View Details
                        </Link>
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
