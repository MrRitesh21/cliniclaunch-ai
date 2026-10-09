-- Migration: 20261009110000_clinicx_staff_attendance.sql
-- Staff attendance tracking for ClinicX

CREATE TABLE IF NOT EXISTS public.staff_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL,
    staff_id TEXT NOT NULL,
    staff_name TEXT NOT NULL,
    staff_role TEXT NOT NULL DEFAULT 'staff',
    attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL CHECK (status IN ('present', 'late', 'half_day', 'absent', 'on_leave')) DEFAULT 'present',
    check_in TIMESTAMPTZ,
    check_out TIMESTAMPTZ,
    shift TEXT DEFAULT 'morning' CHECK (shift IN ('morning', 'evening', 'night', 'full_day')),
    working_hours NUMERIC(4, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_staff_attendance_date UNIQUE (organization_id, staff_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_staff_attendance_org_date ON public.staff_attendance (organization_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_clinic_date ON public.staff_attendance (clinic_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_staff_date ON public.staff_attendance (staff_id, attendance_date);

ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_members_read_attendance" ON public.staff_attendance;
CREATE POLICY "org_members_read_attendance"
    ON public.staff_attendance
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = staff_attendance.organization_id
            AND om.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "org_members_insert_attendance" ON public.staff_attendance;
CREATE POLICY "org_members_insert_attendance"
    ON public.staff_attendance
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = staff_attendance.organization_id
            AND om.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "org_members_update_attendance" ON public.staff_attendance;
CREATE POLICY "org_members_update_attendance"
    ON public.staff_attendance
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = staff_attendance.organization_id
            AND om.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = staff_attendance.organization_id
            AND om.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "org_members_delete_attendance" ON public.staff_attendance;
CREATE POLICY "org_members_delete_attendance"
    ON public.staff_attendance
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = staff_attendance.organization_id
            AND om.user_id = auth.uid()
        )
    );

GRANT ALL ON public.staff_attendance TO authenticated;
GRANT ALL ON public.staff_attendance TO service_role;

NOTIFY pgrst, 'reload schema';
