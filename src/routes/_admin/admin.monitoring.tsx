import { createFileRoute } from '@tanstack/react-router';
import { AdminMonitoringDashboard } from '@/components/admin/AdminMonitoringDashboard';

export const Route = createFileRoute('/_admin/admin/monitoring')({
  component: AdminMonitoringRoute,
});

function AdminMonitoringRoute() {
  return (
    <div className="p-6 space-y-6">
      <AdminMonitoringDashboard />
    </div>
  );
}
