import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listAdminUsers, createAdminUser, deleteAdminUser } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Shield, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/settings/users")({
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const queryClient = useQueryClient();

  const getUsersFn = useServerFn(listAdminUsers);
  const createUserFn = useServerFn(createAdminUser);
  const deleteUserFn = useServerFn(deleteAdminUser);

  const { data: users = [], isLoading } = useQuery({ queryKey: ["admin-users-list"], queryFn: () => getUsersFn() });

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"super_admin" | "support">("support");

  const createMut = useMutation({
    mutationFn: () =>
      createUserFn({
        data: {
          email,
          role,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      setEmail("");
      toast.success("Admin access granted");
    },
    onError: (err: any) => toast.error(err.message || "Failed to grant admin access"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteUserFn({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      toast.success("Admin user deleted");
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete admin user"),
  });

  if (isLoading) {
    return (
      <div className="p-10 text-center flex flex-col items-center justify-center text-muted-foreground">
        <Loader2 className="size-8 animate-spin text-primary mb-2" />
        <span>Loading admin list...</span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-display flex items-center gap-2">
          <Shield className="size-6 text-primary" />
          Admin Users
        </h1>
        <p className="text-sm text-muted-foreground">Manage platform admin accounts and permissions. Only Super Admins can add or remove users.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create form */}
        <Card className="p-4 sm:p-6 space-y-4 h-fit">
          <h3 className="text-lg font-semibold text-foreground font-display">Grant Admin Access</h3>
          <p className="text-xs text-muted-foreground -mt-2">
            The person must already have a ClinicX account. Enter their email to grant a role — they sign in with their existing password.
          </p>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="adminEmail">Account Email</Label>
              <Input id="adminEmail" type="email" value={email} placeholder="teammate@clinicos.in" onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Access Role</Label>
              <select
                className="w-full h-9 border rounded-md px-2 text-sm bg-background mt-1"
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
              >
                <option value="support">Support Agent</option>
                <option value="super_admin">Super Admin (Full Access)</option>
              </select>
            </div>
            <Button
              className="w-full bg-primary hover:bg-primary/90"
              disabled={!email || createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Plus className="size-4 mr-1.5" />}
              Grant Access
            </Button>
          </div>
        </Card>

        {/* List Admins */}
        <Card className="lg:col-span-2 overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-foreground font-display">Authorized Admins</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2.5">Name</th>
                  <th className="text-left px-4 py-2.5">Email</th>
                  <th className="text-left px-4 py-2.5">Role</th>
                  <th className="text-left px-4 py-2.5">Last Login</th>
                  <th className="text-right px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u: any) => (
                  <tr key={u.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 font-semibold text-foreground">{u.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant={u.role === "super_admin" ? "default" : "secondary"}>
                        {u.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : "Never logged in"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-rose-600 hover:text-rose-700"
                        disabled={deleteMut.isPending}
                        onClick={() => {
                          if (confirm(`Are you sure you want to revoke admin permissions for ${u.name}?`)) {
                            deleteMut.mutate(u.id);
                          }
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
