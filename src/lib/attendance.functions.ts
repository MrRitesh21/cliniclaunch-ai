import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '../integrations/supabase/auth-middleware';
import { attendanceReadInput, attendanceWriteInput, readAttendance, recordAttendance } from './attendance.service';

export const getAttendanceDay = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => attendanceReadInput.parse(data))
  .handler(({ data, context }) => readAttendance(context.supabase, data));

export const saveAttendance = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => attendanceWriteInput.parse(data))
  .handler(({ data, context }) => recordAttendance(context.supabase, data));
