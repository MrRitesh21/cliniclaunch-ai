export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json | null
          target_id: string | null
          target_type: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_login_failures: {
        Row: {
          failed_attempts: number | null
          id: string
          ip_address: string
          locked_until: string | null
          updated_at: string | null
        }
        Insert: {
          failed_attempts?: number | null
          id?: string
          ip_address: string
          locked_until?: string | null
          updated_at?: string | null
        }
        Update: {
          failed_attempts?: number | null
          id?: string
          ip_address?: string
          locked_until?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      admin_sessions: {
        Row: {
          admin_id: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          ip_address: string | null
          token: string
          user_agent: string | null
        }
        Insert: {
          admin_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          token: string
          user_agent?: string | null
        }
        Update: {
          admin_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          token?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_sessions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          created_at: string | null
          email: string
          id: string
          last_login_at: string | null
          name: string | null
          password_hash: string
          role: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          last_login_at?: string | null
          name?: string | null
          password_hash: string
          role?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          last_login_at?: string | null
          name?: string | null
          password_hash?: string
          role?: string | null
        }
        Relationships: []
      }
      announcements: {
        Row: {
          body: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          show_from: string | null
          show_until: string | null
          target_plans: Json | null
          title: string
          type: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          show_from?: string | null
          show_until?: string | null
          target_plans?: Json | null
          title: string
          type?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          show_from?: string | null
          show_until?: string | null
          target_plans?: Json | null
          title?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          appointment_date: string | null
          appointment_time: string | null
          appointment_type: string | null
          clinic_id: string | null
          consultation_fee: number
          created_at: string
          doctor_id: string | null
          doctor_name: string | null
          duration_minutes: number
          id: string
          notes: string | null
          organization_id: string | null
          patient_age: number | null
          patient_email: string | null
          patient_gender: string | null
          patient_id: string | null
          patient_name: string
          patient_phone: string | null
          problem: string | null
          scheduled_at: string | null
          source: string | null
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          appointment_date?: string | null
          appointment_time?: string | null
          appointment_type?: string | null
          clinic_id?: string | null
          consultation_fee?: number
          created_at?: string
          doctor_id?: string | null
          doctor_name?: string | null
          duration_minutes?: number
          id?: string
          notes?: string | null
          organization_id?: string | null
          patient_age?: number | null
          patient_email?: string | null
          patient_gender?: string | null
          patient_id?: string | null
          patient_name: string
          patient_phone?: string | null
          problem?: string | null
          scheduled_at?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          appointment_date?: string | null
          appointment_time?: string | null
          appointment_type?: string | null
          clinic_id?: string | null
          consultation_fee?: number
          created_at?: string
          doctor_id?: string | null
          doctor_name?: string | null
          duration_minutes?: number
          id?: string
          notes?: string | null
          organization_id?: string | null
          patient_age?: number | null
          patient_email?: string | null
          patient_gender?: string | null
          patient_id?: string | null
          patient_name?: string
          patient_phone?: string | null
          problem?: string | null
          scheduled_at?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          organization_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string
          created_at: string | null
          id: string
          ip_hash: string
          metadata: Json | null
          target_id: string | null
          tenant_id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string | null
          id?: string
          ip_hash: string
          metadata?: Json | null
          target_id?: string | null
          tenant_id?: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string | null
          id?: string
          ip_hash?: string
          metadata?: Json | null
          target_id?: string | null
          tenant_id?: string
        }
        Relationships: []
      }
      automation_runs: {
        Row: {
          appointment_id: string | null
          automation_id: string
          created_at: string
          error: string | null
          executed_at: string | null
          id: string
          lead_id: string | null
          organization_id: string
          recipient_phone: string | null
          scheduled_for: string
          status: string
        }
        Insert: {
          appointment_id?: string | null
          automation_id: string
          created_at?: string
          error?: string | null
          executed_at?: string | null
          id?: string
          lead_id?: string | null
          organization_id: string
          recipient_phone?: string | null
          scheduled_for?: string
          status?: string
        }
        Update: {
          appointment_id?: string | null
          automation_id?: string
          created_at?: string
          error?: string | null
          executed_at?: string | null
          id?: string
          lead_id?: string | null
          organization_id?: string
          recipient_phone?: string | null
          scheduled_for?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "marketing_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_link_clicks: {
        Row: {
          country: string | null
          created_at: string
          id: string
          link_id: string
          organization_id: string
          referrer: string | null
          user_agent: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: string
          link_id: string
          organization_id: string
          referrer?: string | null
          user_agent?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: string
          link_id?: string
          organization_id?: string
          referrer?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_link_clicks_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "campaign_links"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_links: {
        Row: {
          campaign_id: string | null
          click_count: number
          clinic_id: string | null
          created_at: string
          id: string
          label: string | null
          lead_count: number
          organization_id: string
          slug: string
          target_path: string
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          campaign_id?: string | null
          click_count?: number
          clinic_id?: string | null
          created_at?: string
          id?: string
          label?: string | null
          lead_count?: number
          organization_id: string
          slug: string
          target_path?: string
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          campaign_id?: string | null
          click_count?: number
          clinic_id?: string | null
          created_at?: string
          id?: string
          label?: string | null
          lead_count?: number
          organization_id?: string
          slug?: string
          target_path?: string
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_links_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_links_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_book: {
        Row: {
          actual_cash: number
          book_date: string
          cash_expenses: number
          clinic_id: string | null
          closed_at: string
          closed_by: string | null
          created_at: string
          difference: number
          expected_cash: number
          id: string
          notes: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          actual_cash?: number
          book_date: string
          cash_expenses?: number
          clinic_id?: string | null
          closed_at?: string
          closed_by?: string | null
          created_at?: string
          difference?: number
          expected_cash?: number
          id?: string
          notes?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          actual_cash?: number
          book_date?: string
          cash_expenses?: number
          clinic_id?: string | null
          closed_at?: string
          closed_by?: string | null
          created_at?: string
          difference?: number
          expected_cash?: number
          id?: string
          notes?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_book_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_book_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_domain_secrets: {
        Row: {
          clinic_id: string
          created_at: string
          domain_verification_token: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          domain_verification_token?: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          domain_verification_token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_domain_secrets_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_template_assignments: {
        Row: {
          assigned_by: string | null
          clinic_id: string
          created_at: string
          id: string
          note: string | null
          template_id: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          clinic_id: string
          created_at?: string
          id?: string
          note?: string | null
          template_id: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          clinic_id?: string
          created_at?: string
          id?: string
          note?: string | null
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_template_assignments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_template_assignments_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "site_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          about_text: string | null
          address: string | null
          avatar_url: string | null
          bio: string | null
          blog_enabled: boolean
          branch_code: string | null
          branch_name: string | null
          clinic_name: string
          consultation_fee: number
          created_at: string
          custom_domain: string | null
          doctor_name: string
          domain_last_check_at: string | null
          domain_last_error: string | null
          domain_status: string | null
          domain_verified_at: string | null
          email: string | null
          experience_years: number
          faqs: Json
          gallery: Json
          google_place_id: string | null
          google_rating: number | null
          google_rating_count: number | null
          google_reviews: Json
          google_reviews_synced_at: string | null
          gsc_site_url: string | null
          gsc_verified: boolean
          hero_headline: string | null
          hero_subheadline: string | null
          id: string
          is_active: boolean
          is_primary_branch: boolean
          is_published: boolean
          lead_popup: Json | null
          logo_url: string | null
          medical_registration_no: string | null
          organization_id: string
          owner_id: string | null
          personal_email: string | null
          personal_phone: string | null
          phone: string | null
          public_address: string | null
          public_email: string | null
          public_phone: string | null
          published_at: string | null
          qualification: string
          section_content: Json | null
          section_hidden: Json | null
          section_order: Json | null
          section_variants: Json | null
          seo_autopilot: Json
          seo_autopilot_last_run: string | null
          seo_config: Json | null
          seo_description: string | null
          seo_report_email: string | null
          seo_score: number | null
          seo_title: string | null
          services: Json
          site_template_id: string | null
          slug: string
          specialization: string
          suspended_at: string | null
          suspended_reason: string | null
          team: Json
          template: string | null
          testimonials: Json
          theme_color: string | null
          updated_at: string
          wa_connected_at: string | null
          wa_linked_by: string | null
          wa_phone: string | null
          wa_session_id: string | null
          wa_status: string
          walkin_end_time: string
          walkin_max_per_slot: number
          walkin_slot_minutes: number
          walkin_start_time: string
          walkin_weekends_enabled: boolean
          working_hours: Json
        }
        Insert: {
          about_text?: string | null
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          blog_enabled?: boolean
          branch_code?: string | null
          branch_name?: string | null
          clinic_name?: string
          consultation_fee?: number
          created_at?: string
          custom_domain?: string | null
          doctor_name?: string
          domain_last_check_at?: string | null
          domain_last_error?: string | null
          domain_status?: string | null
          domain_verified_at?: string | null
          email?: string | null
          experience_years?: number
          faqs?: Json
          gallery?: Json
          google_place_id?: string | null
          google_rating?: number | null
          google_rating_count?: number | null
          google_reviews?: Json
          google_reviews_synced_at?: string | null
          gsc_site_url?: string | null
          gsc_verified?: boolean
          hero_headline?: string | null
          hero_subheadline?: string | null
          id?: string
          is_active?: boolean
          is_primary_branch?: boolean
          is_published?: boolean
          lead_popup?: Json | null
          logo_url?: string | null
          medical_registration_no?: string | null
          organization_id: string
          owner_id?: string | null
          personal_email?: string | null
          personal_phone?: string | null
          phone?: string | null
          public_address?: string | null
          public_email?: string | null
          public_phone?: string | null
          published_at?: string | null
          qualification?: string
          section_content?: Json | null
          section_hidden?: Json | null
          section_order?: Json | null
          section_variants?: Json | null
          seo_autopilot?: Json
          seo_autopilot_last_run?: string | null
          seo_config?: Json | null
          seo_description?: string | null
          seo_report_email?: string | null
          seo_score?: number | null
          seo_title?: string | null
          services?: Json
          site_template_id?: string | null
          slug: string
          specialization?: string
          suspended_at?: string | null
          suspended_reason?: string | null
          team?: Json
          template?: string | null
          testimonials?: Json
          theme_color?: string | null
          updated_at?: string
          wa_connected_at?: string | null
          wa_linked_by?: string | null
          wa_phone?: string | null
          wa_session_id?: string | null
          wa_status?: string
          walkin_end_time?: string
          walkin_max_per_slot?: number
          walkin_slot_minutes?: number
          walkin_start_time?: string
          walkin_weekends_enabled?: boolean
          working_hours?: Json
        }
        Update: {
          about_text?: string | null
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          blog_enabled?: boolean
          branch_code?: string | null
          branch_name?: string | null
          clinic_name?: string
          consultation_fee?: number
          created_at?: string
          custom_domain?: string | null
          doctor_name?: string
          domain_last_check_at?: string | null
          domain_last_error?: string | null
          domain_status?: string | null
          domain_verified_at?: string | null
          email?: string | null
          experience_years?: number
          faqs?: Json
          gallery?: Json
          google_place_id?: string | null
          google_rating?: number | null
          google_rating_count?: number | null
          google_reviews?: Json
          google_reviews_synced_at?: string | null
          gsc_site_url?: string | null
          gsc_verified?: boolean
          hero_headline?: string | null
          hero_subheadline?: string | null
          id?: string
          is_active?: boolean
          is_primary_branch?: boolean
          is_published?: boolean
          lead_popup?: Json | null
          logo_url?: string | null
          medical_registration_no?: string | null
          organization_id?: string
          owner_id?: string | null
          personal_email?: string | null
          personal_phone?: string | null
          phone?: string | null
          public_address?: string | null
          public_email?: string | null
          public_phone?: string | null
          published_at?: string | null
          qualification?: string
          section_content?: Json | null
          section_hidden?: Json | null
          section_order?: Json | null
          section_variants?: Json | null
          seo_autopilot?: Json
          seo_autopilot_last_run?: string | null
          seo_config?: Json | null
          seo_description?: string | null
          seo_report_email?: string | null
          seo_score?: number | null
          seo_title?: string | null
          services?: Json
          site_template_id?: string | null
          slug?: string
          specialization?: string
          suspended_at?: string | null
          suspended_reason?: string | null
          team?: Json
          template?: string | null
          testimonials?: Json
          theme_color?: string | null
          updated_at?: string
          wa_connected_at?: string | null
          wa_linked_by?: string | null
          wa_phone?: string | null
          wa_session_id?: string | null
          wa_status?: string
          walkin_end_time?: string
          walkin_max_per_slot?: number
          walkin_slot_minutes?: number
          walkin_start_time?: string
          walkin_weekends_enabled?: boolean
          working_hours?: Json
        }
        Relationships: [
          {
            foreignKeyName: "clinics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinics_site_template_id_fkey"
            columns: ["site_template_id"]
            isOneToOne: false
            referencedRelation: "site_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      consultations: {
        Row: {
          appointment_id: string | null
          bp: string | null
          chief_complaint: string | null
          clinic_id: string | null
          created_at: string
          created_by: string | null
          diagnosis: string | null
          examination: string | null
          follow_up_date: string | null
          height: string | null
          history: string | null
          id: string
          organization_id: string
          patient_id: string | null
          patient_name: string
          pulse: string | null
          temperature: string | null
          treatment_plan: string | null
          updated_at: string
          weight: string | null
        }
        Insert: {
          appointment_id?: string | null
          bp?: string | null
          chief_complaint?: string | null
          clinic_id?: string | null
          created_at?: string
          created_by?: string | null
          diagnosis?: string | null
          examination?: string | null
          follow_up_date?: string | null
          height?: string | null
          history?: string | null
          id?: string
          organization_id: string
          patient_id?: string | null
          patient_name: string
          pulse?: string | null
          temperature?: string | null
          treatment_plan?: string | null
          updated_at?: string
          weight?: string | null
        }
        Update: {
          appointment_id?: string | null
          bp?: string | null
          chief_complaint?: string | null
          clinic_id?: string | null
          created_at?: string
          created_by?: string | null
          diagnosis?: string | null
          examination?: string | null
          follow_up_date?: string | null
          height?: string | null
          history?: string | null
          id?: string
          organization_id?: string
          patient_id?: string | null
          patient_name?: string
          pulse?: string | null
          temperature?: string | null
          treatment_plan?: string | null
          updated_at?: string
          weight?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultations_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_codes: {
        Row: {
          applicable_plan: string | null
          code: string
          created_at: string | null
          created_by: string | null
          discount_type: string | null
          discount_value: number | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          razorpay_offer_id: string | null
          uses_count: number | null
        }
        Insert: {
          applicable_plan?: string | null
          code: string
          created_at?: string | null
          created_by?: string | null
          discount_type?: string | null
          discount_value?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          razorpay_offer_id?: string | null
          uses_count?: number | null
        }
        Update: {
          applicable_plan?: string | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          discount_type?: string | null
          discount_value?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          razorpay_offer_id?: string | null
          uses_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          description: string | null
          discount_amount: number | null
          discount_percent: number | null
          is_active: boolean | null
          max_redemptions: number | null
          redemption_count: number | null
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          is_active?: boolean | null
          max_redemptions?: number | null
          redemption_count?: number | null
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          is_active?: boolean | null
          max_redemptions?: number | null
          redemption_count?: number | null
          valid_until?: string | null
        }
        Relationships: []
      }
      demo_bookings: {
        Row: {
          address: string | null
          clinic_name: string
          created_at: string
          demo_date: string | null
          demo_time: string | null
          gmeet_link: string | null
          id: string
          mode: string
          name: string
          notes: string | null
          phone: string
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          clinic_name: string
          created_at?: string
          demo_date?: string | null
          demo_time?: string | null
          gmeet_link?: string | null
          id?: string
          mode?: string
          name: string
          notes?: string | null
          phone: string
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          clinic_name?: string
          created_at?: string
          demo_date?: string | null
          demo_time?: string | null
          gmeet_link?: string | null
          id?: string
          mode?: string
          name?: string
          notes?: string | null
          phone?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      device_events: {
        Row: {
          created_at: string | null
          device_id: string
          event_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          created_at?: string | null
          device_id: string
          event_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          created_at?: string | null
          device_id?: string
          event_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "device_events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          browser: string | null
          browser_version: string | null
          created_at: string | null
          device_confidence: number | null
          device_hash: string
          device_memory: number | null
          device_type: string | null
          fingerprint_version: string | null
          first_seen: string | null
          hardware_concurrency: number | null
          id: string
          language: string | null
          last_seen: string | null
          os: string | null
          os_version: string | null
          platform: string | null
          screen_resolution: string | null
          timezone: string | null
          updated_at: string | null
          visitor_id: string
        }
        Insert: {
          browser?: string | null
          browser_version?: string | null
          created_at?: string | null
          device_confidence?: number | null
          device_hash: string
          device_memory?: number | null
          device_type?: string | null
          fingerprint_version?: string | null
          first_seen?: string | null
          hardware_concurrency?: number | null
          id?: string
          language?: string | null
          last_seen?: string | null
          os?: string | null
          os_version?: string | null
          platform?: string | null
          screen_resolution?: string | null
          timezone?: string | null
          updated_at?: string | null
          visitor_id: string
        }
        Update: {
          browser?: string | null
          browser_version?: string | null
          created_at?: string | null
          device_confidence?: number | null
          device_hash?: string
          device_memory?: number | null
          device_type?: string | null
          fingerprint_version?: string | null
          first_seen?: string | null
          hardware_concurrency?: number | null
          id?: string
          language?: string | null
          last_seen?: string | null
          os?: string | null
          os_version?: string | null
          platform?: string | null
          screen_resolution?: string | null
          timezone?: string | null
          updated_at?: string | null
          visitor_id?: string
        }
        Relationships: []
      }
      doctors: {
        Row: {
          avatar_url: string | null
          bio: string | null
          clinic_id: string | null
          consultation_fee: number | null
          created_at: string
          experience_years: number | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          qualification: string | null
          sort_order: number
          specialization: string | null
          updated_at: string
          user_id: string | null
          working_hours: Json
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          clinic_id?: string | null
          consultation_fee?: number | null
          created_at?: string
          experience_years?: number | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          qualification?: string | null
          sort_order?: number
          specialization?: string | null
          updated_at?: string
          user_id?: string | null
          working_hours?: Json
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          clinic_id?: string | null
          consultation_fee?: number | null
          created_at?: string
          experience_years?: number | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          qualification?: string | null
          sort_order?: number
          specialization?: string | null
          updated_at?: string
          user_id?: string | null
          working_hours?: Json
        }
        Relationships: [
          {
            foreignKeyName: "doctors_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          body_html: string
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          open_count: number | null
          recipient_count: number | null
          scheduled_at: string | null
          sent_at: string | null
          status: string | null
          subject: string
          target_segment: string | null
        }
        Insert: {
          body_html: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          open_count?: number | null
          recipient_count?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          subject: string
          target_segment?: string | null
        }
        Update: {
          body_html?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          open_count?: number | null
          recipient_count?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string
          target_segment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          bill_url: string | null
          category: string
          category_source: string
          clinic_id: string
          created_at: string
          created_by: string | null
          date: string
          gst_amount: number
          id: string
          notes: string | null
          organization_id: string | null
          payment_mode: string
          title: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount: number
          bill_url?: string | null
          category: string
          category_source?: string
          clinic_id: string
          created_at?: string
          created_by?: string | null
          date?: string
          gst_amount?: number
          id?: string
          notes?: string | null
          organization_id?: string | null
          payment_mode?: string
          title: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          bill_url?: string | null
          category?: string
          category_source?: string
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          date?: string
          gst_amount?: number
          id?: string
          notes?: string | null
          organization_id?: string | null
          payment_mode?: string
          title?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string | null
          description: string | null
          enabled_for_doctor_ids: Json | null
          enabled_for_plans: Json | null
          id: string
          is_enabled_globally: boolean | null
          key: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          enabled_for_doctor_ids?: Json | null
          enabled_for_plans?: Json | null
          id?: string
          is_enabled_globally?: boolean | null
          key: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          enabled_for_doctor_ids?: Json | null
          enabled_for_plans?: Json | null
          id?: string
          is_enabled_globally?: boolean | null
          key?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      finance_audit: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          after_data: Json | null
          amount: number | null
          before_data: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          organization_id: string
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          after_data?: Json | null
          amount?: number | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          organization_id: string
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          after_data?: Json | null
          amount?: number | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          organization_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_audit_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_budgets: {
        Row: {
          category: string
          created_at: string
          id: string
          monthly_limit: number
          organization_id: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          monthly_limit?: number
          organization_id: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          monthly_limit?: number
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_budgets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_goals: {
        Row: {
          created_at: string
          goal_type: string
          id: string
          is_active: boolean
          label: string | null
          organization_id: string
          period: string
          target_value: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          goal_type: string
          id?: string
          is_active?: boolean
          label?: string | null
          organization_id: string
          period?: string
          target_value?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          goal_type?: string
          id?: string
          is_active?: boolean
          label?: string | null
          organization_id?: string
          period?: string
          target_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_goals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_ledger: {
        Row: {
          appointment_id: string | null
          auto_generated: boolean
          clinic_id: string | null
          created_at: string
          created_by: string | null
          discount: number
          doctor_id: string | null
          doctor_name: string | null
          entry_date: string
          entry_type: string
          expense_category: string | null
          expense_id: string | null
          gross_amount: number
          id: string
          invoice_id: string | null
          invoice_number: string | null
          net_amount: number
          notes: string | null
          organization_id: string
          patient_id: string | null
          patient_name: string | null
          payment_id: string | null
          payment_mode: string | null
          service_category: string | null
          source: string | null
          tax_amount: number
          updated_at: string
          vendor: string | null
        }
        Insert: {
          appointment_id?: string | null
          auto_generated?: boolean
          clinic_id?: string | null
          created_at?: string
          created_by?: string | null
          discount?: number
          doctor_id?: string | null
          doctor_name?: string | null
          entry_date?: string
          entry_type?: string
          expense_category?: string | null
          expense_id?: string | null
          gross_amount?: number
          id?: string
          invoice_id?: string | null
          invoice_number?: string | null
          net_amount?: number
          notes?: string | null
          organization_id: string
          patient_id?: string | null
          patient_name?: string | null
          payment_id?: string | null
          payment_mode?: string | null
          service_category?: string | null
          source?: string | null
          tax_amount?: number
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          appointment_id?: string | null
          auto_generated?: boolean
          clinic_id?: string | null
          created_at?: string
          created_by?: string | null
          discount?: number
          doctor_id?: string | null
          doctor_name?: string | null
          entry_date?: string
          entry_type?: string
          expense_category?: string | null
          expense_id?: string | null
          gross_amount?: number
          id?: string
          invoice_id?: string | null
          invoice_number?: string | null
          net_amount?: number
          notes?: string | null
          organization_id?: string
          patient_id?: string | null
          patient_name?: string | null
          payment_id?: string | null
          payment_mode?: string | null
          service_category?: string | null
          source?: string | null
          tax_amount?: number
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_ledger_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_ledger_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          created_at: string
          id: string
          low_stock_threshold: number
          name: string
          notes: string | null
          organization_id: string
          quantity: number
          reorder_level: number
          sku: string | null
          unit: string
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          low_stock_threshold?: number
          name: string
          notes?: string | null
          organization_id: string
          quantity?: number
          reorder_level?: number
          sku?: string | null
          unit?: string
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          low_stock_threshold?: number
          name?: string
          notes?: string | null
          organization_id?: string
          quantity?: number
          reorder_level?: number
          sku?: string | null
          unit?: string
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          item_id: string
          movement_type: string
          note: string | null
          organization_id: string
          quantity: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id: string
          movement_type: string
          note?: string | null
          organization_id: string
          quantity: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string
          movement_type?: string
          note?: string | null
          organization_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          invoice_number: string
          organization_id: string
          paid_at: string | null
          pdf_url: string | null
          razorpay_invoice_id: string | null
          status: string
          subscription_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          invoice_number: string
          organization_id: string
          paid_at?: string | null
          pdf_url?: string | null
          razorpay_invoice_id?: string | null
          status?: string
          subscription_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          invoice_number?: string
          organization_id?: string
          paid_at?: string | null
          pdf_url?: string | null
          razorpay_invoice_id?: string | null
          status?: string
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_orders: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          ordered_by: string | null
          organization_id: string
          patient_id: string | null
          patient_name: string
          result_text: string | null
          result_url: string | null
          status: string
          test_id: string | null
          test_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          ordered_by?: string | null
          organization_id: string
          patient_id?: string | null
          patient_name: string
          result_text?: string | null
          result_url?: string | null
          status?: string
          test_id?: string | null
          test_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          ordered_by?: string | null
          organization_id?: string
          patient_id?: string | null
          patient_name?: string
          result_text?: string | null
          result_url?: string | null
          status?: string
          test_id?: string | null
          test_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "lab_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_tests: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          organization_id: string
          price: number
          sample_type: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          organization_id: string
          price?: number
          sample_type?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          price?: number
          sample_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_tests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          appointment_id: string | null
          campaign_id: string | null
          clinic_id: string | null
          contacted_at: string | null
          converted_at: string | null
          created_at: string
          email: string | null
          id: string
          landing_path: string | null
          message: string | null
          name: string
          organization_id: string | null
          phone: string | null
          referrer: string | null
          source: string | null
          status: string | null
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          value: number
        }
        Insert: {
          appointment_id?: string | null
          campaign_id?: string | null
          clinic_id?: string | null
          contacted_at?: string | null
          converted_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          landing_path?: string | null
          message?: string | null
          name: string
          organization_id?: string | null
          phone?: string | null
          referrer?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          value?: number
        }
        Update: {
          appointment_id?: string | null
          campaign_id?: string | null
          clinic_id?: string | null
          contacted_at?: string | null
          converted_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          landing_path?: string | null
          message?: string | null
          name?: string
          organization_id?: string | null
          phone?: string | null
          referrer?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "leads_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_cards: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          id: string
          organization_id: string
          program_id: string
          qr_token: string
          redeemed_count: number
          stamps: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          id?: string
          organization_id: string
          program_id: string
          qr_token?: string
          redeemed_count?: number
          stamps?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          id?: string
          organization_id?: string
          program_id?: string
          qr_token?: string
          redeemed_count?: number
          stamps?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_cards_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_cards_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "loyalty_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_events: {
        Row: {
          added_by: string | null
          card_id: string
          created_at: string
          event_type: string
          id: string
          note: string | null
          organization_id: string
        }
        Insert: {
          added_by?: string | null
          card_id: string
          created_at?: string
          event_type: string
          id?: string
          note?: string | null
          organization_id: string
        }
        Update: {
          added_by?: string | null
          card_id?: string
          created_at?: string
          event_type?: string
          id?: string
          note?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_events_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "loyalty_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_programs: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          organization_id: string
          reward_description: string
          stamps_required: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          organization_id: string
          reward_description?: string
          stamps_required?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          reward_description?: string
          stamps_required?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_programs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_automations: {
        Row: {
          body: string
          channel: string
          clinic_id: string | null
          converted_count: number
          created_at: string
          delay_minutes: number
          id: string
          is_active: boolean
          name: string
          organization_id: string
          run_count: number
          template_key: string | null
          trigger_event: string
          updated_at: string
        }
        Insert: {
          body?: string
          channel?: string
          clinic_id?: string | null
          converted_count?: number
          created_at?: string
          delay_minutes?: number
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          run_count?: number
          template_key?: string | null
          trigger_event: string
          updated_at?: string
        }
        Update: {
          body?: string
          channel?: string
          clinic_id?: string | null
          converted_count?: number
          created_at?: string
          delay_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          run_count?: number
          template_key?: string | null
          trigger_event?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_automations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_campaigns: {
        Row: {
          audience_filter: Json
          audience_segment: string | null
          body: string
          booked_count: number
          channel: string
          clicked_count: number
          created_at: string
          created_by: string | null
          cta_text: string | null
          cta_url: string | null
          delivered_count: number
          id: string
          name: string
          opened_count: number
          organization_id: string
          recipient_count: number
          revenue_generated: number
          scheduled_at: string | null
          sent_at: string | null
          spend: number
          status: string
          subject: string | null
          template_key: string | null
          timezone: string
          type: string
          updated_at: string
        }
        Insert: {
          audience_filter?: Json
          audience_segment?: string | null
          body?: string
          booked_count?: number
          channel: string
          clicked_count?: number
          created_at?: string
          created_by?: string | null
          cta_text?: string | null
          cta_url?: string | null
          delivered_count?: number
          id?: string
          name: string
          opened_count?: number
          organization_id: string
          recipient_count?: number
          revenue_generated?: number
          scheduled_at?: string | null
          sent_at?: string | null
          spend?: number
          status?: string
          subject?: string | null
          template_key?: string | null
          timezone?: string
          type?: string
          updated_at?: string
        }
        Update: {
          audience_filter?: Json
          audience_segment?: string | null
          body?: string
          booked_count?: number
          channel?: string
          clicked_count?: number
          created_at?: string
          created_by?: string | null
          cta_text?: string | null
          cta_url?: string | null
          delivered_count?: number
          id?: string
          name?: string
          opened_count?: number
          organization_id?: string
          recipient_count?: number
          revenue_generated?: number
          scheduled_at?: string | null
          sent_at?: string | null
          spend?: number
          status?: string
          subject?: string | null
          template_key?: string | null
          timezone?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_coupons: {
        Row: {
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          max_usage: number
          min_spend: number
          organization_id: string
          title: string
          updated_at: string
          usage_count: number
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_usage?: number
          min_spend?: number
          organization_id: string
          title?: string
          updated_at?: string
          usage_count?: number
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_usage?: number
          min_spend?: number
          organization_id?: string
          title?: string
          updated_at?: string
          usage_count?: number
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_coupons_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_recipients: {
        Row: {
          campaign_id: string
          created_at: string
          email: string | null
          error: string | null
          id: string
          name: string | null
          organization_id: string
          patient_id: string | null
          phone: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          email?: string | null
          error?: string | null
          id?: string
          name?: string | null
          organization_id: string
          patient_id?: string | null
          phone?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          email?: string | null
          error?: string | null
          id?: string
          name?: string | null
          organization_id?: string
          patient_id?: string | null
          phone?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_recipients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_recipients_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          created_at: string
          default_dose: string | null
          default_instructions: string | null
          form: string | null
          id: string
          name: string
          organization_id: string
          strength: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_dose?: string | null
          default_instructions?: string | null
          form?: string | null
          id?: string
          name: string
          organization_id: string
          strength?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_dose?: string | null
          default_instructions?: string | null
          form?: string | null
          id?: string
          name?: string
          organization_id?: string
          strength?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      module_value_benchmarks: {
        Row: {
          competitor_monthly_cost: number
          competitor_name: string | null
          created_at: string
          description: string | null
          module_key: string
          per_unit_label: string | null
          per_unit_value: number
          updated_at: string
        }
        Insert: {
          competitor_monthly_cost?: number
          competitor_name?: string | null
          created_at?: string
          description?: string | null
          module_key: string
          per_unit_label?: string | null
          per_unit_value?: number
          updated_at?: string
        }
        Update: {
          competitor_monthly_cost?: number
          competitor_name?: string | null
          created_at?: string
          description?: string | null
          module_key?: string
          per_unit_label?: string | null
          per_unit_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      modules: {
        Row: {
          category: string
          created_at: string
          description: string
          icon: string
          id: string
          is_available: boolean | null
          is_core: boolean | null
          min_plan: string | null
          name: string
          sort_order: number | null
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          icon: string
          id: string
          is_available?: boolean | null
          is_core?: boolean | null
          min_plan?: string | null
          name: string
          sort_order?: number | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_available?: boolean | null
          is_core?: boolean | null
          min_plan?: string | null
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          category: string
          created_at: string
          event_token: string
          id: string
          meta: Json
          organization_id: string | null
          read_at: string | null
          title: string
          url: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          category?: string
          created_at?: string
          event_token?: string
          id?: string
          meta?: Json
          organization_id?: string | null
          read_at?: string | null
          title: string
          url?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          category?: string
          created_at?: string
          event_token?: string
          id?: string
          meta?: Json
          organization_id?: string | null
          read_at?: string | null
          title?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      organization_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          clinic_id: string | null
          id: string
          invited_by: string | null
          joined_at: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          clinic_id?: string | null
          id?: string
          invited_by?: string | null
          joined_at?: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          clinic_id?: string | null
          id?: string
          invited_by?: string | null
          joined_at?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_modules: {
        Row: {
          id: string
          installed_at: string
          installed_by: string | null
          module_id: string
          organization_id: string
        }
        Insert: {
          id?: string
          installed_at?: string
          installed_by?: string | null
          module_id: string
          organization_id: string
        }
        Update: {
          id?: string
          installed_at?: string
          installed_by?: string | null
          module_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_modules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_onboarding: {
        Row: {
          business_type_set: boolean | null
          completed: boolean | null
          completed_at: string | null
          created_at: string
          current_step: number
          modules_selected: boolean | null
          organization_id: string
          plan_selected: boolean | null
          updated_at: string
        }
        Insert: {
          business_type_set?: boolean | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          current_step?: number
          modules_selected?: boolean | null
          organization_id: string
          plan_selected?: boolean | null
          updated_at?: string
        }
        Update: {
          business_type_set?: boolean | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          current_step?: number
          modules_selected?: boolean | null
          organization_id?: string
          plan_selected?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_onboarding_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          business_type: Database["public"]["Enums"]["business_type"]
          created_at: string
          custom_domain: string | null
          custom_domain_status:
            | Database["public"]["Enums"]["domain_status"]
            | null
          custom_domain_verified_at: string | null
          description: string | null
          google_business_name: string | null
          google_business_profile_connected_at: string | null
          google_business_profile_url: string | null
          google_place_id: string | null
          google_rating: number | null
          google_reviews_count: number | null
          google_sync_status: string | null
          id: string
          logo_url: string | null
          marketing_settings: Json
          name: string
          primary_color: string | null
          public_address: string | null
          public_email: string | null
          public_phone: string | null
          reputation_target_monthly_reviews: number | null
          reputation_target_rating: number | null
          reputation_target_reviews: number | null
          slug: string
          tagline: string | null
          updated_at: string
        }
        Insert: {
          business_type?: Database["public"]["Enums"]["business_type"]
          created_at?: string
          custom_domain?: string | null
          custom_domain_status?:
            | Database["public"]["Enums"]["domain_status"]
            | null
          custom_domain_verified_at?: string | null
          description?: string | null
          google_business_name?: string | null
          google_business_profile_connected_at?: string | null
          google_business_profile_url?: string | null
          google_place_id?: string | null
          google_rating?: number | null
          google_reviews_count?: number | null
          google_sync_status?: string | null
          id?: string
          logo_url?: string | null
          marketing_settings?: Json
          name: string
          primary_color?: string | null
          public_address?: string | null
          public_email?: string | null
          public_phone?: string | null
          reputation_target_monthly_reviews?: number | null
          reputation_target_rating?: number | null
          reputation_target_reviews?: number | null
          slug: string
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          business_type?: Database["public"]["Enums"]["business_type"]
          created_at?: string
          custom_domain?: string | null
          custom_domain_status?:
            | Database["public"]["Enums"]["domain_status"]
            | null
          custom_domain_verified_at?: string | null
          description?: string | null
          google_business_name?: string | null
          google_business_profile_connected_at?: string | null
          google_business_profile_url?: string | null
          google_place_id?: string | null
          google_rating?: number | null
          google_reviews_count?: number | null
          google_sync_status?: string | null
          id?: string
          logo_url?: string | null
          marketing_settings?: Json
          name?: string
          primary_color?: string | null
          public_address?: string | null
          public_email?: string | null
          public_phone?: string | null
          reputation_target_monthly_reviews?: number | null
          reputation_target_rating?: number | null
          reputation_target_reviews?: number | null
          slug?: string
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      patient_invoice_items: {
        Row: {
          amount: number
          description: string
          id: string
          invoice_id: string
          position: number
          quantity: number
          unit_price: number
        }
        Insert: {
          amount?: number
          description: string
          id?: string
          invoice_id: string
          position?: number
          quantity?: number
          unit_price?: number
        }
        Update: {
          amount?: number
          description?: string
          id?: string
          invoice_id?: string
          position?: number
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "patient_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "patient_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_invoices: {
        Row: {
          amount_paid: number
          clinic_id: string | null
          created_at: string
          created_by: string | null
          discount: number
          due_date: string | null
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          organization_id: string
          patient_id: string | null
          patient_name: string
          status: string
          subtotal: number
          tax_percent: number
          total: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          clinic_id?: string | null
          created_at?: string
          created_by?: string | null
          discount?: number
          due_date?: string | null
          id?: string
          invoice_number: string
          issue_date?: string
          notes?: string | null
          organization_id: string
          patient_id?: string | null
          patient_name: string
          status?: string
          subtotal?: number
          tax_percent?: number
          total?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          clinic_id?: string | null
          created_at?: string
          created_by?: string | null
          discount?: number
          due_date?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          organization_id?: string
          patient_id?: string | null
          patient_name?: string
          status?: string
          subtotal?: number
          tax_percent?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_invoices_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_invoices_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_loyalty: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          patient_id: string
          points: number
          tier: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          patient_id: string
          points?: number
          tier?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          patient_id?: string
          points?: number
          tier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_loyalty_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_loyalty_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_payments: {
        Row: {
          amount: number
          created_by: string | null
          id: string
          invoice_id: string
          method: string
          note: string | null
          organization_id: string
          paid_at: string
        }
        Insert: {
          amount: number
          created_by?: string | null
          id?: string
          invoice_id: string
          method?: string
          note?: string | null
          organization_id: string
          paid_at?: string
        }
        Update: {
          amount?: number
          created_by?: string | null
          id?: string
          invoice_id?: string
          method?: string
          note?: string | null
          organization_id?: string
          paid_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "patient_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          age: number | null
          clinic_id: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          gender: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string | null
          phone: string | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          age?: number | null
          clinic_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          gender?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          age?: number | null
          clinic_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          gender?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacy_batches: {
        Row: {
          batch_no: string
          created_at: string
          expiry_date: string | null
          id: string
          item_id: string
          mrp: number
          organization_id: string
          purchase_price: number | null
          quantity: number
          updated_at: string
        }
        Insert: {
          batch_no: string
          created_at?: string
          expiry_date?: string | null
          id?: string
          item_id: string
          mrp?: number
          organization_id: string
          purchase_price?: number | null
          quantity?: number
          updated_at?: string
        }
        Update: {
          batch_no?: string
          created_at?: string
          expiry_date?: string | null
          id?: string
          item_id?: string
          mrp?: number
          organization_id?: string
          purchase_price?: number | null
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_batches_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacy_sale_items: {
        Row: {
          batch_id: string | null
          batch_no: string | null
          created_at: string
          drug_name: string
          id: string
          item_id: string | null
          line_total: number
          organization_id: string
          quantity: number
          sale_id: string
          unit_price: number
        }
        Insert: {
          batch_id?: string | null
          batch_no?: string | null
          created_at?: string
          drug_name: string
          id?: string
          item_id?: string | null
          line_total?: number
          organization_id: string
          quantity: number
          sale_id: string
          unit_price?: number
        }
        Update: {
          batch_id?: string | null
          batch_no?: string | null
          created_at?: string
          drug_name?: string
          id?: string
          item_id?: string | null
          line_total?: number
          organization_id?: string
          quantity?: number
          sale_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_sale_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "pharmacy_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_sale_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_sale_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "pharmacy_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacy_sales: {
        Row: {
          created_at: string
          created_by: string | null
          discount: number
          id: string
          note: string | null
          organization_id: string
          patient_id: string | null
          patient_name: string
          payment_method: string
          prescription_id: string | null
          status: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          discount?: number
          id?: string
          note?: string | null
          organization_id: string
          patient_id?: string | null
          patient_name: string
          payment_method?: string
          prescription_id?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          discount?: number
          id?: string
          note?: string | null
          organization_id?: string
          patient_id?: string | null
          patient_name?: string
          payment_method?: string
          prescription_id?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_sales_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_sales_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_sales_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          currency: string
          discounted_monthly_price: number | null
          discounted_yearly_price: number | null
          features: Json
          id: string
          is_popular: boolean | null
          module_ids: string[]
          monthly_price: number
          name: string
          patient_limit: number | null
          sort_order: number | null
          staff_limit: number | null
          tagline: string | null
          yearly_price: number
        }
        Insert: {
          created_at?: string
          currency?: string
          discounted_monthly_price?: number | null
          discounted_yearly_price?: number | null
          features?: Json
          id: string
          is_popular?: boolean | null
          module_ids?: string[]
          monthly_price: number
          name: string
          patient_limit?: number | null
          sort_order?: number | null
          staff_limit?: number | null
          tagline?: string | null
          yearly_price: number
        }
        Update: {
          created_at?: string
          currency?: string
          discounted_monthly_price?: number | null
          discounted_yearly_price?: number | null
          features?: Json
          id?: string
          is_popular?: boolean | null
          module_ids?: string[]
          monthly_price?: number
          name?: string
          patient_limit?: number | null
          sort_order?: number | null
          staff_limit?: number | null
          tagline?: string | null
          yearly_price?: number
        }
        Relationships: []
      }
      prescription_items: {
        Row: {
          created_at: string
          dose: string | null
          drug_name: string
          duration: string | null
          frequency: string | null
          id: string
          instructions: string | null
          medication_id: string | null
          organization_id: string
          position: number
          prescription_id: string
        }
        Insert: {
          created_at?: string
          dose?: string | null
          drug_name: string
          duration?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          medication_id?: string | null
          organization_id: string
          position?: number
          prescription_id: string
        }
        Update: {
          created_at?: string
          dose?: string | null
          drug_name?: string
          duration?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          medication_id?: string | null
          organization_id?: string
          position?: number
          prescription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescription_items_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_items_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          appointment_id: string | null
          consultation_id: string | null
          created_at: string
          id: string
          issued_by: string | null
          notes: string | null
          organization_id: string
          patient_id: string | null
          patient_name: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          consultation_id?: string | null
          created_at?: string
          id?: string
          issued_by?: string | null
          notes?: string | null
          organization_id: string
          patient_id?: string | null
          patient_name: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          consultation_id?: string | null
          created_at?: string
          id?: string
          issued_by?: string | null
          notes?: string | null
          organization_id?: string
          patient_id?: string | null
          patient_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          impersonation_allowed: boolean | null
          last_login_at: string | null
          role: string
          suspended_at: string | null
          suspended_reason: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          impersonation_allowed?: boolean | null
          last_login_at?: string | null
          role?: string
          suspended_at?: string | null
          suspended_reason?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          impersonation_allowed?: boolean | null
          last_login_at?: string | null
          role?: string
          suspended_at?: string | null
          suspended_reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_events: {
        Row: {
          created_at: string
          endpoint_hash: string | null
          event: string
          id: string
          notification_id: string | null
          organization_id: string | null
          plan_id: string | null
          platform: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint_hash?: string | null
          event: string
          id?: string
          notification_id?: string | null
          organization_id?: string | null
          plan_id?: string | null
          platform?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint_hash?: string | null
          event?: string
          id?: string
          notification_id?: string | null
          organization_id?: string | null
          plan_id?: string | null
          platform?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_events_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          categories: string[]
          created_at: string
          device_label: string | null
          enabled: boolean
          endpoint: string
          expiration_time: string | null
          failure_count: number
          id: string
          last_used_at: string | null
          p256dh: string
          platform: string | null
          quiet_end: string | null
          quiet_start: string | null
          timezone: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          categories?: string[]
          created_at?: string
          device_label?: string | null
          enabled?: boolean
          endpoint: string
          expiration_time?: string | null
          failure_count?: number
          id?: string
          last_used_at?: string | null
          p256dh: string
          platform?: string | null
          quiet_end?: string | null
          quiet_start?: string | null
          timezone?: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          categories?: string[]
          created_at?: string
          device_label?: string | null
          enabled?: boolean
          endpoint?: string
          expiration_time?: string | null
          failure_count?: number
          id?: string
          last_used_at?: string | null
          p256dh?: string
          platform?: string | null
          quiet_end?: string | null
          quiet_start?: string | null
          timezone?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      review_qr_codes: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          reviews_submitted: number
          scans: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
          reviews_submitted?: number
          scans?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          reviews_submitted?: number
          scans?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_qr_codes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          assigned_staff_id: string | null
          category: string | null
          clinic_id: string | null
          comment: string | null
          created_at: string
          id: string
          internal_notes: string | null
          organization_id: string
          private_status: string | null
          rating: number
          reply: string | null
          resolution_date: string | null
          reviewer_email: string | null
          reviewer_name: string
          reviewer_phone: string | null
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_staff_id?: string | null
          category?: string | null
          clinic_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          internal_notes?: string | null
          organization_id: string
          private_status?: string | null
          rating: number
          reply?: string | null
          resolution_date?: string | null
          reviewer_email?: string | null
          reviewer_name: string
          reviewer_phone?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_staff_id?: string | null
          category?: string | null
          clinic_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          internal_notes?: string | null
          organization_id?: string
          private_status?: string | null
          rating?: number
          reply?: string | null
          resolution_date?: string | null
          reviewer_email?: string | null
          reviewer_name?: string
          reviewer_phone?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_assigned_staff_id_fkey"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scribe_sessions: {
        Row: {
          audio_url: string | null
          clinic_id: string
          created_at: string
          id: string
          patient_name: string | null
          soap_note: Json | null
          status: string
          transcript: string | null
        }
        Insert: {
          audio_url?: string | null
          clinic_id: string
          created_at?: string
          id?: string
          patient_name?: string | null
          soap_note?: Json | null
          status?: string
          transcript?: string | null
        }
        Update: {
          audio_url?: string | null
          clinic_id?: string
          created_at?: string
          id?: string
          patient_name?: string | null
          soap_note?: Json | null
          status?: string
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scribe_sessions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          ip_hash: string
          metadata: Json | null
          risk_breakdown: Json | null
          risk_score: number | null
          severity: Database["public"]["Enums"]["security_severity"] | null
          tenant_id: string
          user_id: string | null
          visitor_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          ip_hash: string
          metadata?: Json | null
          risk_breakdown?: Json | null
          risk_score?: number | null
          severity?: Database["public"]["Enums"]["security_severity"] | null
          tenant_id?: string
          user_id?: string | null
          visitor_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          ip_hash?: string
          metadata?: Json | null
          risk_breakdown?: Json | null
          risk_score?: number | null
          severity?: Database["public"]["Enums"]["security_severity"] | null
          tenant_id?: string
          user_id?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      security_metrics_daily: {
        Row: {
          blocked_devices: number | null
          browser_distribution: Json | null
          countries: Json | null
          date: string
          high_risk_logins: number | null
          id: string
          new_devices: number | null
          os_distribution: Json | null
          tenant_id: string
          total_devices: number | null
          updated_at: string | null
        }
        Insert: {
          blocked_devices?: number | null
          browser_distribution?: Json | null
          countries?: Json | null
          date?: string
          high_risk_logins?: number | null
          id?: string
          new_devices?: number | null
          os_distribution?: Json | null
          tenant_id?: string
          total_devices?: number | null
          updated_at?: string | null
        }
        Update: {
          blocked_devices?: number | null
          browser_distribution?: Json | null
          countries?: Json | null
          date?: string
          high_risk_logins?: number | null
          id?: string
          new_devices?: number | null
          os_distribution?: Json | null
          tenant_id?: string
          total_devices?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      security_metrics_realtime: {
        Row: {
          active_sessions: number | null
          blocked_attempts: number | null
          high_risk_last_hour: number | null
          id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          active_sessions?: number | null
          blocked_attempts?: number | null
          high_risk_last_hour?: number | null
          id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Update: {
          active_sessions?: number | null
          blocked_attempts?: number | null
          high_risk_last_hour?: number | null
          id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      seo_ai_content: {
        Row: {
          clinic_id: string
          created_at: string
          generated_by: string
          id: string
          kind: string
          payload: Json
          published: boolean
          title: string | null
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          generated_by?: string
          id?: string
          kind: string
          payload: Json
          published?: boolean
          title?: string | null
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          generated_by?: string
          id?: string
          kind?: string
          payload?: Json
          published?: boolean
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_ai_content_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_audits: {
        Row: {
          category: string
          clinic_id: string
          created_at: string
          findings: Json
          id: string
          score: number
        }
        Insert: {
          category: string
          clinic_id: string
          created_at?: string
          findings?: Json
          id?: string
          score?: number
        }
        Update: {
          category?: string
          clinic_id?: string
          created_at?: string
          findings?: Json
          id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "seo_audits_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_citations: {
        Row: {
          checked_at: string
          clinic_id: string
          engine: string
          id: string
          mentioned: boolean
          position: number | null
          query: string
          raw_response: string | null
          snippet: string | null
        }
        Insert: {
          checked_at?: string
          clinic_id: string
          engine: string
          id?: string
          mentioned?: boolean
          position?: number | null
          query: string
          raw_response?: string | null
          snippet?: string | null
        }
        Update: {
          checked_at?: string
          clinic_id?: string
          engine?: string
          id?: string
          mentioned?: boolean
          position?: number | null
          query?: string
          raw_response?: string | null
          snippet?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seo_citations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_keywords: {
        Row: {
          clinic_id: string
          created_at: string
          current_position: number | null
          difficulty: string | null
          id: string
          keyword: string
          last_checked_at: string | null
          location: string | null
          search_volume: number | null
          status: string
          target_position: number | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          current_position?: number | null
          difficulty?: string | null
          id?: string
          keyword: string
          last_checked_at?: string | null
          location?: string | null
          search_volume?: number | null
          status?: string
          target_position?: number | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          current_position?: number | null
          difficulty?: string | null
          id?: string
          keyword?: string
          last_checked_at?: string | null
          location?: string | null
          search_volume?: number | null
          status?: string
          target_position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "seo_keywords_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_rank_history: {
        Row: {
          checked_at: string
          clinic_id: string
          id: string
          keyword_id: string
          position: number | null
          source: string
        }
        Insert: {
          checked_at?: string
          clinic_id: string
          id?: string
          keyword_id: string
          position?: number | null
          source?: string
        }
        Update: {
          checked_at?: string
          clinic_id?: string
          id?: string
          keyword_id?: string
          position?: number | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_rank_history_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_rank_history_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "seo_keywords"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_tasks: {
        Row: {
          category: string
          clinic_id: string
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          is_completed: boolean
          task_key: string
          title: string
        }
        Insert: {
          category: string
          clinic_id: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_completed?: boolean
          task_key: string
          title: string
        }
        Update: {
          category?: string
          clinic_id?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_completed?: boolean
          task_key?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_tasks_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      site_templates: {
        Row: {
          created_at: string
          created_by: string | null
          css_body: string | null
          description: string | null
          html_body: string | null
          id: string
          is_active: boolean
          is_global: boolean
          kind: string
          name: string
          preview_image_url: string | null
          slug: string
          sort_order: number
          swatch: string | null
          theme_color: string | null
          updated_at: string
          variants: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          css_body?: string | null
          description?: string | null
          html_body?: string | null
          id?: string
          is_active?: boolean
          is_global?: boolean
          kind?: string
          name: string
          preview_image_url?: string | null
          slug: string
          sort_order?: number
          swatch?: string | null
          theme_color?: string | null
          updated_at?: string
          variants?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          css_body?: string | null
          description?: string | null
          html_body?: string | null
          id?: string
          is_active?: boolean
          is_global?: boolean
          kind?: string
          name?: string
          preview_image_url?: string | null
          slug?: string
          sort_order?: number
          swatch?: string | null
          theme_color?: string | null
          updated_at?: string
          variants?: Json
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          display_order: number | null
          features: Json | null
          id: string
          is_active: boolean | null
          max_appointments_per_month: number | null
          max_branches: number | null
          max_patients: number | null
          name: string
          price_monthly: number | null
          price_yearly: number | null
          razorpay_plan_id_monthly: string | null
          razorpay_plan_id_yearly: string | null
          slug: string
        }
        Insert: {
          display_order?: number | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_appointments_per_month?: number | null
          max_branches?: number | null
          max_patients?: number | null
          name: string
          price_monthly?: number | null
          price_yearly?: number | null
          razorpay_plan_id_monthly?: string | null
          razorpay_plan_id_yearly?: string | null
          slug: string
        }
        Update: {
          display_order?: number | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_appointments_per_month?: number | null
          max_branches?: number | null
          max_patients?: number | null
          name?: string
          price_monthly?: number | null
          price_yearly?: number | null
          razorpay_plan_id_monthly?: string | null
          razorpay_plan_id_yearly?: string | null
          slug?: string
        }
        Relationships: []
      }
      subscription_reminders: {
        Row: {
          body: string | null
          created_at: string
          dismissed_at: string | null
          id: string
          kind: string
          organization_id: string
          severity: string
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          kind: string
          organization_id: string
          severity?: string
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          kind?: string
          organization_id?: string
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_reminders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string
          gateway: string | null
          gateway_customer_id: string | null
          gateway_subscription_id: string | null
          id: string
          metadata: Json
          organization_id: string
          plan_id: string
          razorpay_customer_id: string | null
          razorpay_subscription_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          gateway?: string | null
          gateway_customer_id?: string | null
          gateway_subscription_id?: string | null
          id?: string
          metadata?: Json
          organization_id: string
          plan_id: string
          razorpay_customer_id?: string | null
          razorpay_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          gateway?: string | null
          gateway_customer_id?: string | null
          gateway_subscription_id?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
          plan_id?: string
          razorpay_customer_id?: string | null
          razorpay_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          body: string
          created_at: string | null
          doctor_email: string | null
          doctor_id: string | null
          id: string
          priority: string | null
          status: string | null
          subject: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          body: string
          created_at?: string | null
          doctor_email?: string | null
          doctor_id?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          subject: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          body?: string
          created_at?: string | null
          doctor_email?: string | null
          doctor_id?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          subject?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string | null
          updated_by: string | null
          value: string | null
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_replies: {
        Row: {
          body: string
          created_at: string | null
          id: string
          sender_id: string | null
          sender_type: string | null
          ticket_id: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          sender_id?: string | null
          sender_type?: string | null
          ticket_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          sender_id?: string | null
          sender_type?: string | null
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number | null
          billing_cycle: string | null
          created_at: string | null
          currency: string | null
          doctor_id: string | null
          gateway: string | null
          gateway_order_id: string | null
          gateway_payment_id: string | null
          id: string
          organization_id: string | null
          plan: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          refund_amount: number | null
          refund_id: string | null
          status: string | null
        }
        Insert: {
          amount?: number | null
          billing_cycle?: string | null
          created_at?: string | null
          currency?: string | null
          doctor_id?: string | null
          gateway?: string | null
          gateway_order_id?: string | null
          gateway_payment_id?: string | null
          id?: string
          organization_id?: string | null
          plan?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          refund_amount?: number | null
          refund_id?: string | null
          status?: string | null
        }
        Update: {
          amount?: number | null
          billing_cycle?: string | null
          created_at?: string | null
          currency?: string | null
          doctor_id?: string | null
          gateway?: string | null
          gateway_order_id?: string | null
          gateway_payment_id?: string | null
          id?: string
          organization_id?: string | null
          plan?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          refund_amount?: number | null
          refund_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_devices: {
        Row: {
          created_at: string | null
          device_id: string
          first_seen: string | null
          id: string
          is_blocked: boolean | null
          is_trusted: boolean | null
          last_seen: string | null
          login_count: number | null
          risk_breakdown: Json | null
          risk_score: number | null
          tenant_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_id: string
          first_seen?: string | null
          id?: string
          is_blocked?: boolean | null
          is_trusted?: boolean | null
          last_seen?: string | null
          login_count?: number | null
          risk_breakdown?: Json | null
          risk_score?: number | null
          tenant_id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_id?: string
          first_seen?: string | null
          id?: string
          is_blocked?: boolean | null
          is_trusted?: boolean | null
          last_seen?: string | null
          login_count?: number | null
          risk_breakdown?: Json | null
          risk_score?: number | null
          tenant_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_devices_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          city: string | null
          country: string | null
          created_at: string | null
          device_id: string
          expires_at: string
          id: string
          ip_hash: string
          is_revoked: boolean | null
          last_activity: string | null
          session_token: string
          tenant_id: string
          token_family_id: string
          user_id: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          device_id: string
          expires_at: string
          id?: string
          ip_hash: string
          is_revoked?: boolean | null
          last_activity?: string | null
          session_token: string
          tenant_id?: string
          token_family_id?: string
          user_id: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          device_id?: string
          expires_at?: string
          id?: string
          ip_hash?: string
          is_revoked?: boolean | null
          last_activity?: string | null
          session_token?: string
          tenant_id?: string
          token_family_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      value_events: {
        Row: {
          created_at: string
          description: string | null
          event_type: string
          id: string
          module_key: string
          organization_id: string
          related_id: string | null
          value_amount: number
          value_type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          module_key: string
          organization_id: string
          related_id?: string | null
          value_amount?: number
          value_type: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          module_key?: string
          organization_id?: string
          related_id?: string | null
          value_amount?: number
          value_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "value_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_categories: {
        Row: {
          category: string
          created_at: string
          hits: number
          id: string
          organization_id: string
          updated_at: string
          vendor_key: string
          vendor_label: string
        }
        Insert: {
          category: string
          created_at?: string
          hits?: number
          id?: string
          organization_id: string
          updated_at?: string
          vendor_key: string
          vendor_label: string
        }
        Update: {
          category?: string
          created_at?: string
          hits?: number
          id?: string
          organization_id?: string
          updated_at?: string
          vendor_key?: string
          vendor_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          event_type: string | null
          id: string
          payload: Json | null
          provider: string
          received_at: string
        }
        Insert: {
          event_type?: string | null
          id: string
          payload?: Json | null
          provider?: string
          received_at?: string
        }
        Update: {
          event_type?: string | null
          id?: string
          payload?: Json | null
          provider?: string
          received_at?: string
        }
        Relationships: []
      }
      whatsapp_logs: {
        Row: {
          appointment_id: string | null
          automation_key: string | null
          created_at: string
          error: string | null
          id: string
          message: string
          metadata: Json
          organization_id: string
          patient_name: string | null
          patient_phone: string
          scheduled_for: string | null
          sent_at: string | null
          status: string
          template_key: string
          wa_link: string | null
        }
        Insert: {
          appointment_id?: string | null
          automation_key?: string | null
          created_at?: string
          error?: string | null
          id?: string
          message: string
          metadata?: Json
          organization_id: string
          patient_name?: string | null
          patient_phone: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          template_key: string
          wa_link?: string | null
        }
        Update: {
          appointment_id?: string | null
          automation_key?: string | null
          created_at?: string
          error?: string | null
          id?: string
          message?: string
          metadata?: Json
          organization_id?: string
          patient_name?: string | null
          patient_phone?: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          template_key?: string
          wa_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          template_key: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          template_key: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          template_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_clinic: {
        Args: { _clinic_id: string; _user_id: string }
        Returns: boolean
      }
      expire_lapsed_subscriptions: { Args: never; Returns: number }
      get_invite_by_token: {
        Args: { _token: string }
        Returns: {
          accepted_at: string
          email: string
          expires_at: string
          id: string
          organization_id: string
          organization_name: string
          role: Database["public"]["Enums"]["org_role"]
        }[]
      }
      get_public_clinic_site: {
        Args: { _preview_token?: string; _slug: string }
        Returns: Json
      }
      has_org_role: {
        Args: {
          _org_id: string
          _roles: Database["public"]["Enums"]["org_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      user_clinic_ids: { Args: { _user_id: string }; Returns: string[] }
      user_org_ids: { Args: { _user_id: string }; Returns: string[] }
    }
    Enums: {
      app_role: "super_admin" | "support"
      appointment_status:
        | "pending"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "no_show"
      billing_cycle: "monthly" | "yearly"
      business_type:
        | "doctor"
        | "clinic"
        | "hospital"
        | "diagnostic_center"
        | "therapist"
        | "dentist"
        | "physiotherapist"
      domain_status: "pending" | "verifying" | "verified" | "active" | "failed"
      org_role: "owner" | "admin" | "doctor" | "staff"
      security_severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "cancelled"
        | "expired"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "support"],
      appointment_status: [
        "pending",
        "confirmed",
        "completed",
        "cancelled",
        "no_show",
      ],
      billing_cycle: ["monthly", "yearly"],
      business_type: [
        "doctor",
        "clinic",
        "hospital",
        "diagnostic_center",
        "therapist",
        "dentist",
        "physiotherapist",
      ],
      domain_status: ["pending", "verifying", "verified", "active", "failed"],
      org_role: ["owner", "admin", "doctor", "staff"],
      security_severity: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "cancelled",
        "expired",
      ],
    },
  },
} as const
