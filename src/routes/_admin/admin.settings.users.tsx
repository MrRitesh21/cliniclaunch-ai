import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { listAdminUsers, createAdminUser, deleteAdminUser } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Shield, Plus, Trash2, Users, Search, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/settings/users")({
  head: () => ({ meta: [{ title: "Admin Access — ClinicX Admin" }] }),
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const queryClient = useQueryClient();

  const getUsersFn = useServerFn(listAdminUsers);
  const createUserFn = useServerFn(createAdminUser);
  const deleteUserFn = useServerFn(deleteAdminUser);

  const { data: users = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-users-list"],
    queryFn: () => getUsersFn(),
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"super_admin" | "support">("support");
  const [search, setSearch] = useState("");

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
      queryClient.invalidateQueries({ queryKey: ["admin-platform-users"] });
      setEmail("");
      toast.success("Admin access granted");
    },
    onError: (err: any) => toast.error(err.message || "Failed to grant admin access"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteUserFn({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      queryClient.invalidateQueries({ queryKey: ["admin-platform-users"] });
      toast.success("Admin user deleted");
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete admin user"),
  });

  const filteredAdmins = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u: any) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q)
    );
  }, [users, search]);

  if (isLoading && users.length === 0) {
    return (
      <div className="p-10 text-center flex flex-col items-center justify-center text-muted-foreground min-h-[350px]">
        <Loader2 className="size-8 animate-spin text-primary mb-2" />
        <span className="text-sm font-medium">Loading admin list...</span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-display flex items-center gap-2">
            <Shield className="size-6 text-primary" />
            Platform Admin Access
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage platform admin accounts and permissions. Only Super Admins can add or remove users.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFetching && <Loader2 className="size-4 animate-spin text-primary" />}
          <Button asChild variant="outline" size="sm" className="h-8 text-xs">
            <Link to="/admin/users">
              <Users className="size-3.5 mr-1" /> All Users Directory
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8 text-xs">
            <RefreshCw className="size-3.5 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create form */}
        <Card className="p-4 sm:p-6 space-y-4 h-fit">
          <h3 className="text-base font-semibold text-foreground font-display">Grant Admin Access</h3>
          <p className="text-xs text-muted-foreground -mt-2">
            The person must already have a ClinicX account. Enter their email to grant a role — they
            sign in with their existing password.
          </p>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="adminEmail" className="text-xs">Account Email</Label>
              <Input
                id="adminEmail"
                type="email"
                value={email}
                placeholder="teammate@clinicx.in"
                onChange={(e) => setEmail(e.target.value)}
                className="h-9 text-xs bg-background"
              />
            </div>
            <div>
              <Label className="text-xs">Access Role</Label>
              <Select value={role} onValueChange={(val) => setRole(val as any)}>
                <SelectTrigger className="w-full h-9 text-xs bg-background mt-1">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="support">Support Agent</SelectItem>
                  <SelectItem value="super_admin">Super Admin (Full Access)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full bg-primary hover:bg-primary/90 h-9 text-xs"
              disabled={!email.trim() || createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? (
                <Loader2 className="size-3.5 animate-spin mr-1.5" />
              ) : (
                <Plus className="size-3.5 mr-1.5" />
              )}
              Grant Access
            </Button>
          </div>
        </Card>

        {/* List Admins */}
        <Card className="lg:col-span-2 overflow-hidden">
          <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="font-semibold text-foreground font-display text-sm sm:text-base">
              Authorized Admins ({filteredAdmins.length})
            </h3>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search admin..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background"
              />
            </div>
          </div>

          {/* Mobile View (< md) */}
          <div className="block md:hidden divide-y">
            {filteredAdmins.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-xs">
                No admin accounts found.
              </div>
            ) : (
              filteredAdmins.map((u: any) => (
                <div key={u.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                        {u.name?.charAt(0) || "A"}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground text-xs sm:text-sm">{u.name}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </div>
                    </div>
                    <Badge variant={u.role === "super_admin" ? "default" : "secondary"} className="text-[10px] py-0">
                      {u.role}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                    <span>
                      {u.last_login_at
                        ? `Last: ${new Date(u.last_login_at).toLocaleDateString()}`
                        : "Never logged in"}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950 px-2"
                      disabled={deleteMut.isPending}
                      onClick={() => {
                        if (confirm(`Revoke admin access for ${u.name}?`)) {
                          deleteMut.mutate(u.id);
                        }
                      }}
                    >
                      <Trash2 className="size-3.5 mr-1" /> Revoke
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table (md+) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3">Administrator</th>
                  <th className="text-left px-4 py-3">Email Address</th>
                  <th className="text-left px-4 py-3">Role</th>
                  <th className="text-left px-4 py-3">Last Active</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredAdmins.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground text-xs">
                      No admin accounts found.
                    </td>
                  </tr>
                ) : (
                  filteredAdmins.map((u: any) => (
                    <tr key={u.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-foreground">
                        <div className="flex items-center gap-2.5">
                          <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                            {u.name?.charAt(0) || "A"}
                          </div>
                          <span>{u.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{u.email}</td>
                      <td className="px-4 py-3">
                        <Badge variant={u.role === "super_admin" ? "default" : "secondary"} className="text-[10px] py-0">
                          {u.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {u.last_login_at
                          ? new Date(u.last_login_at).toLocaleString()
                          : "Never logged in"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-muted-foreground hover:text-rose-600 transition-colors"
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
