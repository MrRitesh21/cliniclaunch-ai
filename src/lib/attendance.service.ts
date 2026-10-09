import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

export const attendanceStatuses = ['present', 'late', 'half_day', 'absent', 'on_leave'] as const;
export const attendanceShifts = ['morning', 'evening', 'night', 'full_day'] as const;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(value + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Choose a valid calendar date');
const subject = z.string().regex(/^(user|doctor):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
export const attendanceReadInput = z.object({ organizationId: z.string().uuid(), date: date.nullable().optional(), clinicId: z.string().uuid().nullable().optional() }).strict();
export const attendanceWriteInput = z.object({
  organizationId: z.string().uuid(), subject: subject.optional(), action: z.enum(['check_in', 'check_out', 'set_status']),
  date: date.optional(), status: z.enum(attendanceStatuses).optional(), shift: z.enum(attendanceShifts).default('morning'),
  notes: z.string().max(1000).optional(),
}).strict().superRefine((input, ctx) => {
  if (input.action === 'set_status' ? !input.date || !input.status : input.date !== undefined || input.status !== undefined || input.notes !== undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Status corrections need a date and status. Check-in/out uses server time only.' });
  }
});
const rosterSchema = z.object({ staff_id: subject, staff_name: z.string(), staff_role: z.string(), clinic_id: z.string().uuid().nullable() });
const rowSchema = rosterSchema.extend({
  // Preserve imported/applied historical IDs for read-only history; new subjects remain canonical.
  staff_id: z.string().min(1),
  id: z.string().uuid(), organization_id: z.string().uuid(), attendance_date: date, status: z.enum(attendanceStatuses),
  check_in: z.string().datetime({ offset: true }).nullable(), check_out: z.string().datetime({ offset: true }).nullable(),
  shift: z.enum(attendanceShifts).nullable(), working_hours: z.number().nullable(), notes: z.string().nullable(),
  created_at: z.string(), updated_at: z.string(),
});
const daySchema = z.object({
  organization_id: z.string().uuid(), date, today: date, server_now: z.string(), timezone: z.literal('Asia/Kolkata'),
  can_manage: z.boolean(), can_write: z.boolean(), self_id: subject,
  roster: z.array(rosterSchema), records: z.array(rowSchema), open_records: z.array(rowSchema),
});
export type AttendanceRow = z.infer<typeof rowSchema>;
export type AttendanceDay = z.infer<typeof daySchema>;
export type AttendanceRead = z.input<typeof attendanceReadInput>;
export type AttendanceWrite = z.input<typeof attendanceWriteInput>;
type Client = Pick<SupabaseClient<Database>, 'rpc'>;
function rpcError(error: { message: string; code?: string }) {
  if (error.code === '42883' || error.code === 'PGRST202') return new Error('Attendance is not configured yet. Ask your administrator to apply the attendance migration.');
  return new Error(error.message || 'Attendance could not be saved. Check your connection and retry.');
}
export async function readAttendance(client: Client, input: AttendanceRead): Promise<AttendanceDay> {
  const request = attendanceReadInput.parse(input);
  const { data, error } = await client.rpc('clinicx_attendance_day', { p_org: request.organizationId, p_date: request.date ?? null, p_clinic: request.clinicId ?? null });
  if (error) throw rpcError(error);
  const result = daySchema.parse(data);
  if (result.organization_id !== request.organizationId || [...result.records, ...result.open_records].some(row => row.organization_id !== request.organizationId)) throw new Error('Attendance tenant response mismatch. Refresh and retry.');
  if (request.date && result.date !== request.date) throw new Error('Attendance date response mismatch. Refresh and retry.');
  return result;
}
export async function recordAttendance(client: Client, input: AttendanceWrite): Promise<AttendanceRow> {
  const request = attendanceWriteInput.parse(input);
  const { data, error } = await client.rpc('clinicx_attendance_record', {
    p_org: request.organizationId, p_subject: request.subject ?? null, p_action: request.action,
    p_date: request.date ?? null, p_status: request.status ?? null, p_shift: request.shift, p_notes: request.notes ?? null,
  });
  if (error) throw rpcError(error);
  const result = rowSchema.parse(data);
  if (result.organization_id !== request.organizationId || (request.subject && result.staff_id !== request.subject)) throw new Error('Attendance tenant/subject response mismatch. Refresh and retry.');
  if (request.action === 'set_status' && (result.attendance_date !== request.date || result.status !== request.status)) throw new Error('Attendance correction was not confirmed. Refresh and retry.');
  return result;
}
