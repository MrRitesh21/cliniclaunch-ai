import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { listAllPlatformUsers, toggleUserSuspension } from "@/lib/admin.functions";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2,
  Users,
  Search,
  Shield,
  ShieldAlert,
  UserCheck,
  UserX,
  Building2,
  Copy,
  ExternalLink,
  RefreshCw,
  Mail,
  Phone,
} from "lucide-react";

export const Route = createFileRoute("/_admin/admin/users")({
  head: () => ({ meta: [{ title: "User Management — ClinicX Admin" }] }),
  component: AdminUserManagementPage,
});

function AdminUserManagementPage() {
  const queryClient = useQueryClient();

  const getUsersFn = useServerFn(listAllPlatformUsers);
  const toggleSuspensionFn = useServerFn(toggleUserSuspension);

  const { data: users = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-platform-users"],
    queryFn: () => getUsersFn(),
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [suspensionDialogUser, setSuspensionDialogUser] = useState<any | null>(null);
  const [suspensionReason, setSuspensionReason] = useState("");

  const suspensionMut = useMutation({
    mutationFn: (args: { userId: string; suspended: boolean; reason?: string }) =>
      toggleSuspensionFn({ data: args }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-platform-users"] });
      setSuspensionDialogUser(null);
      setSuspensionReason("");
      toast.success(variables.suspended ? "User suspended" : "User access restored");
    },
    onError: (err: any) => toast.error(err.message || "Failed to update suspension status"),
  });

  const filteredUsers = useMemo(() => {
    return users.filter((u: any) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !search.trim() ||
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.clinicName?.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q) ||
        u.id?.toLowerCase().includes(q);

      const matchesRole =
        roleFilter === "all" ||
        (roleFilter === "doctor" && (u.role === "doctor" || u.clinicId)) ||
        (roleFilter === "admin" && (u.role === "super_admin" || u.role === "support" || u.isAdmin)) ||
        u.role === roleFilter;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && !u.suspended) ||
        (statusFilter === "suspended" && u.suspended);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const counts = useMemo(() => {
    const total = users.length;
    const doctors = users.filter((u: any) => u.clinicId || u.role === "doctor").length;
    const admins = users.filter((u: any) => u.isAdmin || u.role === "super_admin" || u.role === "support").length;
    const suspended = users.filter((u: any) => u.suspended).length;
    return { total, doctors, admins, suspended };
  }, [users]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label}`);
  };

  if (isLoading && users.length === 0) {
    return (
      <div className="p-10 text-center flex flex-col items-center justify-center text-muted-foreground min-h-[350px]">
        <Loader2 className="size-8 animate-spin text-primary mb-2" />
        <span className="text-sm font-medium">Loading platform user directory...</span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-display flex items-center gap-2">
            <Users className="size-6 text-primary" />
            User Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Complete platform directory across Clinic Owners, Doctors, Staff, and Administrators.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFetching && <Loader2 className="size-4 animate-spin text-primary" />}
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8 text-xs">
            <RefreshCw className="size-3.5 mr-1" />
            Refresh
          </Button>
          <Button asChild size="sm" className="h-8 text-xs bg-primary hover:bg-primary/90">
            <Link to="/admin/settings/users">
              <Shield className="size-3.5 mr-1" /> Admin Access
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
              Total Accounts
            </span>
            <div className="text-2xl font-extrabold text-foreground mt-1">{counts.total}</div>
          </div>
          <Users className="size-5 text-muted-foreground/60" />
        </Card>

        <Card className="p-4 flex items-center justify-between border-l-4 border-l-primary">
          <div>
            <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
              Doctors & Clinics
            </span>
            <div className="text-2xl font-extrabold text-primary mt-1">{counts.doctors}</div>
          </div>
          <Building2 className="size-5 text-primary" />
        </Card>

        <Card className="p-4 flex items-center justify-between border-l-4 border-l-indigo-500">
          <div>
            <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
              Platform Admins
            </span>
            <div className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">
              {counts.admins}
            </div>
          </div>
          <Shield className="size-5 text-indigo-500" />
        </Card>

        <Card className="p-4 flex items-center justify-between border-l-4 border-l-rose-500">
          <div>
            <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
              Suspended
            </span>
            <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">
              {counts.suspended}
            </div>
          </div>
          <UserX className="size-5 text-rose-500" />
        </Card>
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-lg border">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, clinic or user ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs bg-background"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[140px] h-9 text-xs bg-background">
              <SelectValue placeholder="Filter Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="doctor">Doctors / Clinics</SelectItem>
              <SelectItem value="admin">Platform Admins</SelectItem>
              <SelectItem value="super_admin">Super Admins</SelectItem>
              <SelectItem value="support">Support Staff</SelectItem>
              <SelectItem value="user">Standard Users</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px] h-9 text-xs bg-background">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active Only</SelectItem>
              <SelectItem value="suspended">Suspended Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Users Directory */}
      <Card className="overflow-hidden">
        {/* Mobile View (< md) */}
        <div className="block md:hidden divide-y">
          {filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No users match your criteria.
            </div>
          ) : (
            filteredUsers.map((u: any) => (
              <div key={u.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                      {u.name?.charAt(0) || "U"}
                    </div>
                    <div>
                      <div className="font-semibold text-foreground text-sm">{u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.email || "No email"}</div>
                    </div>
                  </div>
                  <Badge
                    variant={u.suspended ? "destructive" : "default"}
                    className="text-[10px] py-0 shrink-0"
                  >
                    {u.suspended ? "Suspended" : "Active"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-muted/30 p-2.5 rounded">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">Role</span>
                    <span className="font-medium capitalize">{u.role?.replace(/_/g, " ")}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">Associated Clinic</span>
                    <span className="font-medium truncate block">{u.clinicName || "—"}</span>
                  </div>
                  {u.phone && (
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase">Phone</span>
                      <span>{u.phone}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">Joined</span>
                    <span>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  {u.clinicId && (
                    <Button asChild size="sm" variant="outline" className="h-8 text-xs flex-1">
                      <Link to="/admin/doctors/$id" params={{ id: u.clinicId }}>
                        <Building2 className="size-3.5 mr-1" /> Clinic Profile
                      </Link>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => copyToClipboard(u.id, "User ID")}
                  >
                    <Copy className="size-3.5" />
                  </Button>
                  {!u.isSuperAdmin && (
                    <Button
                      size="sm"
                      variant="outline"
                      className={`h-8 text-xs ${
                        u.suspended
                          ? "text-emerald-600 border-emerald-200"
                          : "text-rose-600 border-rose-200"
                      }`}
                      onClick={() => {
                        if (u.suspended) {
                          suspensionMut.mutate({ userId: u.id, suspended: false });
                        } else {
                          setSuspensionDialogUser(u);
                        }
                      }}
                    >
                      {u.suspended ? "Reactivate" : "Suspend"}
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View (md+) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">User & Contact</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-4 py-3">Clinic Link</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Activity</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground text-sm">
                    No users match your criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u: any) => (
                  <tr key={u.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                          {u.name?.charAt(0) || "U"}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground truncate">{u.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <span className="truncate">{u.email || "No email recorded"}</span>
                            {u.email && (
                              <button
                                onClick={() => copyToClipboard(u.email, "Email")}
                                className="text-muted-foreground hover:text-foreground"
                                title="Copy Email"
                              >
                                <Copy className="size-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          u.isSuperAdmin
                            ? "default"
                            : u.isAdmin
                              ? "secondary"
                              : u.clinicId
                                ? "outline"
                                : "outline"
                        }
                        className="capitalize text-[11px]"
                      >
                        {u.role?.replace(/_/g, " ")}
                      </Badge>
                    </td>

                    <td className="px-4 py-3">
                      {u.clinicId ? (
                        <Link
                          to="/admin/doctors/$id"
                          params={{ id: u.clinicId }}
                          className="font-medium text-primary hover:underline text-xs flex items-center gap-1"
                        >
                          <Building2 className="size-3" />
                          <span className="truncate max-w-[160px]">{u.clinicName || "View Clinic"}</span>
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground/60">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <Badge
                        variant={u.suspended ? "destructive" : "default"}
                        className="text-[10px] py-0"
                      >
                        {u.suspended ? "Suspended" : "Active"}
                      </Badge>
                      {u.suspended && u.suspendedReason && (
                        <div className="text-[10px] text-muted-foreground truncate max-w-[140px] mt-0.5">
                          {u.suspendedReason}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <div>Joined: {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</div>
                      {u.lastLoginAt && (
                        <div className="text-[11px] text-muted-foreground/70">
                          Last seen: {new Date(u.lastLoginAt).toLocaleDateString()}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => copyToClipboard(u.id, "User ID")}
                          title="Copy User UUID"
                        >
                          <Copy className="size-3.5" />
                        </Button>

                        {u.clinicId && (
                          <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                            <Link to="/admin/doctors/$id" params={{ id: u.clinicId }}>
                              Inspect
                            </Link>
                          </Button>
                        )}

                        {!u.isSuperAdmin && (
                          <Button
                            size="sm"
                            variant="outline"
                            className={`h-7 text-xs ${
                              u.suspended
                                ? "text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                                : "text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950"
                            }`}
                            onClick={() => {
                              if (u.suspended) {
                                suspensionMut.mutate({ userId: u.id, suspended: false });
                              } else {
                                setSuspensionDialogUser(u);
                              }
                            }}
                          >
                            {u.suspended ? "Reactivate" : "Suspend"}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Suspension Reason Dialog */}
      {suspensionDialogUser && (
        <Dialog open onOpenChange={(open) => !open && setSuspensionDialogUser(null)}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-rose-600">
                <ShieldAlert className="size-5" />
                Suspend Account: {suspensionDialogUser.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-xs text-muted-foreground">
                Suspending this user will immediately revoke their access and deactivate associated clinic workspaces.
              </p>
              <div className="space-y-1">
                <Label htmlFor="suspendReason" className="text-xs">Reason for suspension</Label>
                <Input
                  id="suspendReason"
                  placeholder="e.g. Terms of Service violation, payment dispute"
                  value={suspensionReason}
                  onChange={(e) => setSuspensionReason(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSuspensionDialogUser(null)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="h-8 text-xs"
                disabled={suspensionMut.isPending}
                onClick={() =>
                  suspensionMut.mutate({
                    userId: suspensionDialogUser.id,
                    suspended: true,
                    reason: suspensionReason,
                  })
                }
              >
                {suspensionMut.isPending && <Loader2 className="size-3.5 animate-spin mr-1" />}
                Confirm Suspension
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
