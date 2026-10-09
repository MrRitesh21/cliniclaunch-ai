import type { AttendanceDay, AttendanceRow } from './attendance.service';

export function attendanceCsv(day: AttendanceDay): string {
  const fields = ['attendance_date', 'staff_id', 'staff_name', 'staff_role', 'clinic_id', 'status', 'check_in', 'check_out', 'shift', 'working_hours', 'notes'] as const;
  // Include saved history even if the member/doctor was later removed from the roster.
  const saved = new Map(day.records.map(row => [row.staff_id, row]));
  const rows: Array<Partial<AttendanceRow>> = [...day.records, ...day.roster.filter(staff => !saved.has(staff.staff_id)).map(staff => ({ ...staff, attendance_date: day.date }))];
  const cell = (value: unknown) => {
    let text = value == null ? '' : String(value);
    if (/^[\s]*[=+@-]|^[\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return [fields.join(','), ...rows.map(row => fields.map(field => cell(row[field])).join(','))].join('\r\n');
}

export function attendanceTime(value: string | null, timezone: string): string {
  return value ? new Intl.DateTimeFormat('en-IN', { timeZone: timezone, hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';
}
