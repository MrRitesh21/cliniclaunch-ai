import { createFileRoute, Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AppGuard } from '@/components/app/AppGuard';
import { useOrganization } from '@/hooks/useOrganization';
import { useAuthReady } from '@/hooks/useAuthReady';
import { getAttendanceDay, saveAttendance } from '@/lib/attendance.functions';
import { attendanceShifts, attendanceStatuses, type AttendanceDay, type AttendanceRow, type AttendanceWrite } from '@/lib/attendance.service';
import { attendanceCsv, attendanceTime } from '@/lib/attendance-ui';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export const Route = createFileRoute('/_authenticated/dashboard/attendance')({
  component: () => <AppGuard appKey="attendance"><AttendancePage /></AppGuard>,
});

type AttendanceDraft = { status: AttendanceRow['status']; shift: NonNullable<AttendanceRow['shift']>; notes: string };

function AttendancePage() {
  const { org, role, entitlement, authorityUserId, authorityGeneration, authorityError } = useOrganization();
  const { user } = useAuthReady();
  const read = useServerFn(getAttendanceDay);
  const save = useServerFn(saveAttendance);
  const [date, setDate] = useState('');
  // Page lifetime is caller/tenant-bound by AppGuard. Keep drafts above cards:
  // denied pending authority invalidates their day response, not user input.
  const [drafts, setDrafts] = useState<Record<string, AttendanceDraft>>({});
  const [loaded, setLoaded] = useState<{ generation: number; day: AttendanceDay } | null>(null);
  const [error, setError] = useState<{ generation: number; message: string } | null>(null);
  const [busy, setBusy] = useState<{ generation: number; subject: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const verified = !!user && authorityUserId === user.id && !!entitlement && !authorityError;
  const key = `${user?.id ?? ''}:${org?.id ?? ''}:${date}:${role ?? ''}:${authorityGeneration}:${verified}:${entitlement?.can_write}`;
  const scope = useRef({ key, generation: 0 });
  const request = useRef(0);
  const writeLock = useRef<object | null>(null);
  const mounted = useRef(true);
  // Invalidate during render; A→B→A never revives a response from the first A.
  if (scope.current.key !== key) {
    scope.current = { key, generation: scope.current.generation + 1 };
    writeLock.current = null;
  }
  const generation = scope.current.generation;
  const current = (token: number) => mounted.current && scope.current.generation === token;
  const day = loaded?.generation === generation ? loaded.day : null;
  const canManage = verified && entitlement?.can_read && day?.can_manage && (role === 'owner' || role === 'admin');
  const canWrite = verified && !!day?.can_write && !!entitlement?.can_write;
  const locked = busy?.generation === generation;

  async function reload(): Promise<AttendanceDay | null> {
    if (!org || !verified) return null;
    const token = scope.current.generation;
    const sequence = ++request.current;
    setLoading(true);
    try {
      const result = await read({ data: { organizationId: org.id, date: date || null } });
      if (!current(token) || sequence !== request.current) return null;
      setLoaded({ generation: token, day: result });
      setError(null);
      return result;
    } catch (cause) {
      if (current(token) && sequence === request.current) {
        setLoaded(null);
        setError({ generation: token, message: cause instanceof Error ? cause.message : 'Attendance could not be loaded. Check your connection and retry.' });
      }
      return null;
    } finally {
      if (current(token) && sequence === request.current) setLoading(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => { request.current++; };
    // The render-time key is the authoritative workspace/date boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => () => { mounted.current = false; }, []);

  async function record(input: Omit<AttendanceWrite, 'organizationId'>) {
    if (!org || !day || !canWrite || writeLock.current) return;
    const token = generation;
    const lock = {};
    writeLock.current = lock;
    ++request.current; // A read started before this write cannot restore an old punch.
    setBusy({ generation: token, subject: input.subject ?? day.self_id });
    setError(null);
    try {
      const saved = await save({ data: { ...input, organizationId: org.id } });
      if (!current(token)) return;
      const confirmed = await reload();
      if (!current(token)) return;
      const row = confirmed?.records.find(row => row.id === saved.id) ?? confirmed?.open_records.find(row => row.id === saved.id);
      // Overnight checkout belongs to yesterday: confirm with a fresh read of its actual date.
      const history = !row && confirmed ? await read({ data: { organizationId: org.id, date: saved.attendance_date } }) : null;
      if (!current(token)) return;
      const result = row ?? history?.records.find(row => row.id === saved.id);
      if (!result || result.updated_at !== saved.updated_at) throw new Error('Attendance save could not be confirmed. Refresh before retrying.');
      toast.success(input.action === 'set_status' ? 'Attendance status saved' : input.action === 'check_out' ? 'Checked out' : 'Checked in');
    } catch (cause) {
      if (current(token)) setError({ generation: token, message: cause instanceof Error ? cause.message : 'Attendance save failed. Check your connection and refresh before retrying.' });
    } finally {
      if (current(token) && writeLock.current === lock) { writeLock.current = null; setBusy(null); }
    }
  }
  function exportCsv() {
    if (!day) return;
    const url = URL.createObjectURL(new Blob(['\uFEFF' + attendanceCsv(day)], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `attendance-${day.date}.csv`; anchor.click();
    URL.revokeObjectURL(url);
  }
  const entries = day ? [...day.roster, ...day.records.filter(row => !day.roster.some(staff => staff.staff_id === row.staff_id))] : [];
  return <div className="space-y-5 pb-12 text-foreground">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="font-display text-2xl font-bold">Staff Attendance</h1>
        <p className="text-sm text-muted-foreground">Daily roster, shift history and reports · India time (Asia/Kolkata)</p></div>
      <Link to="/dashboard/modules" className="text-primary underline text-sm">App Store</Link>
    </header>
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-sm space-y-1">Attendance date
        <input aria-label="Attendance date" type="date" value={date || day?.date || ''} max={day?.today}
          onChange={event => setDate(event.target.value)} className="block min-h-11 rounded-lg border border-border bg-card px-3 text-foreground" /></label>
      <Button variant="outline" onClick={() => setDate('')}>Today</Button>
      <Button variant="outline" aria-label="Refresh attendance" disabled={locked} onClick={() => void reload()}>Refresh</Button>
      <Button variant="outline" disabled={!day || loading || locked} onClick={exportCsv}>Export CSV</Button>
    </div>
    {error?.generation === generation && <div role="alert" className="rounded-xl border border-destructive/40 bg-card p-4 space-y-2">
      <p>{error.message}</p><Button variant="outline" onClick={() => void reload()}>Retry / refresh</Button>
      <p className="text-xs text-muted-foreground">No offline attendance is assumed saved. Refresh to verify before retrying.</p>
    </div>}
    {loading && <p role="status" className="text-muted-foreground">Loading verified attendance…</p>}
    {day && <>
      {!canWrite && <p role="status" className="rounded-xl border border-border bg-secondary/40 p-4">Attendance is read-only. View history or export CSV; renew access to record attendance.</p>}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[['Team', entries.length], ['Clocked in', day.records.filter(row => row.check_in).length], ['Completed', day.records.filter(row => row.check_out).length], ['Not recorded', day.roster.filter(staff => !day.records.some(row => row.staff_id === staff.staff_id)).length]].map(([label, count]) =>
          <Card key={label} className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-semibold">{count}</p></Card>)}
      </div>
      <p className="text-xs text-muted-foreground">{day.date === day.today ? 'Today’s roster' : `History · ${day.date}`} · Unrecorded is not automatically absent. Punches use server time; overnight shifts retain their check-in date.</p>
      {entries.length === 0 && <Card className="p-6 text-muted-foreground">No team members or attendance records in your permitted clinic scope.</Card>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {entries.map(staff => {
          const row = day.records.find(row => row.staff_id === staff.staff_id);
          const open = day.date === day.today ? day.open_records.find(row => row.staff_id === staff.staff_id) : undefined;
          const active = open ?? row;
          const exists = day.roster.some(member => member.staff_id === staff.staff_id);
          const draftKey = `${staff.staff_id}:${day.date}:${row?.updated_at ?? ''}`;
          return <AttendanceCard key={draftKey}
            draft={drafts[draftKey]} onDraft={draft => setDrafts(previous => ({ ...previous, [draftKey]: draft }))}
            staff={staff} row={row} active={active} day={day} canManage={!!canManage && exists}
            canPunch={canWrite && !loading && exists && (canManage || staff.staff_id === day.self_id) && day.date === day.today}
            canCorrect={canWrite && !loading && !!canManage && exists} locked={locked}
            onRecord={record} />;
        })}
      </div>
    </>}
  </div>;
}

function AttendanceCard({ staff, row, active, day, canManage, canPunch, canCorrect, locked, onRecord, draft, onDraft }: {
  staff: AttendanceDay['roster'][number]; row?: AttendanceRow; active?: AttendanceRow; day: AttendanceDay;
  canManage: boolean; canPunch: boolean; canCorrect: boolean; locked: boolean;
  onRecord: (input: Omit<AttendanceWrite, 'organizationId'>) => Promise<void>;
  draft?: AttendanceDraft; onDraft: (draft: AttendanceDraft) => void;
}) {
  const values = draft ?? { status: row?.status ?? 'present', shift: row?.shift ?? 'morning', notes: row?.notes ?? '' };
  const { status, shift, notes } = values;
  const setStatus = (status: AttendanceDraft['status']) => onDraft({ ...values, status });
  const setShift = (shift: AttendanceDraft['shift']) => onDraft({ ...values, shift });
  const setNotes = (notes: string) => onDraft({ ...values, notes });
  return <Card className="p-4 space-y-3 min-w-0">
    <div className="flex flex-wrap justify-between gap-2"><div><h2 className="font-semibold break-words">{staff.staff_name}</h2><p className="text-xs text-muted-foreground capitalize">{staff.staff_role}</p></div>
      <span className="text-xs rounded-md bg-secondary px-2 py-1 self-start">{row?.status.replaceAll('_', ' ') ?? 'Not recorded'}</span></div>
    <dl className="grid grid-cols-3 gap-2 text-sm"><div><dt className="text-xs text-muted-foreground">Check in</dt><dd>{attendanceTime(active?.check_in ?? null, day.timezone)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Check out</dt><dd>{attendanceTime(active?.check_out ?? null, day.timezone)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Hours</dt><dd>{active?.working_hours ?? '—'}</dd></div></dl>
    {active && active.attendance_date !== day.date && <p className="text-xs text-muted-foreground">Open overnight shift from {active.attendance_date}</p>}
    {active?.check_out ? <p className="text-sm text-muted-foreground">Completed</p> : canPunch && <div className="flex flex-wrap items-center gap-2">
      {!active?.check_in && <label className="text-xs">Shift <select aria-label={`Shift for ${staff.staff_name}`} value={shift} onChange={event => setShift(event.target.value as typeof shift)} className="min-h-11 rounded-lg border border-border bg-card px-2">{attendanceShifts.map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>}
      <Button disabled={locked} aria-label={`${active?.check_in ? 'Check out' : 'Check in'} ${staff.staff_name}`} className="min-h-11"
        onClick={() => void onRecord({ subject: staff.staff_id, action: active?.check_in ? 'check_out' : 'check_in', shift })}>{active?.check_in ? 'Check out' : 'Check in'}</Button>
    </div>}
    {canManage && <form className="space-y-2 border-t border-border pt-3" onSubmit={event => { event.preventDefault(); if (canCorrect && !locked) void onRecord({ subject: staff.staff_id, action: 'set_status', date: day.date, status, shift, notes }); }}>
      <label className="text-xs block">Status <select aria-label={`Status for ${staff.staff_name}`} disabled={!canCorrect || locked} value={status} onChange={event => setStatus(event.target.value as typeof status)} className="block w-full min-h-11 rounded-lg border border-border bg-card px-3">{attendanceStatuses.map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>
      <label className="text-xs block">Notes <textarea aria-label={`Notes for ${staff.staff_name}`} maxLength={1000} disabled={!canCorrect || locked} value={notes} onChange={event => setNotes(event.target.value)} className="block w-full rounded-lg border border-border bg-card p-2" /></label>
      <Button type="submit" variant="outline" aria-label={`Save status for ${staff.staff_name}`} disabled={!canCorrect || locked}>Save status</Button>
    </form>}
    {!canManage && row?.notes && <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{row.notes}</p>}
  </Card>;
}
