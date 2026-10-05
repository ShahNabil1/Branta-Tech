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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      applicant_profiles: {
        Row: {
          behance_url: string | null
          created_at: string
          current_location: string | null
          github_url: string | null
          graduation_year: number | null
          institute: string | null
          linkedin_url: string | null
          photo_path: string | null
          portfolio_url: string | null
          semester: string | null
          short_bio: string | null
          study_department: string | null
          study_status: string | null
          updated_at: string
          user_id: string
          website_url: string | null
        }
        Insert: {
          behance_url?: string | null
          created_at?: string
          current_location?: string | null
          github_url?: string | null
          graduation_year?: number | null
          institute?: string | null
          linkedin_url?: string | null
          photo_path?: string | null
          portfolio_url?: string | null
          semester?: string | null
          short_bio?: string | null
          study_department?: string | null
          study_status?: string | null
          updated_at?: string
          user_id: string
          website_url?: string | null
        }
        Update: {
          behance_url?: string | null
          created_at?: string
          current_location?: string | null
          github_url?: string | null
          graduation_year?: number | null
          institute?: string | null
          linkedin_url?: string | null
          photo_path?: string | null
          portfolio_url?: string | null
          semester?: string | null
          short_bio?: string | null
          study_department?: string | null
          study_status?: string | null
          updated_at?: string
          user_id?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applicant_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      applicant_resumes: {
        Row: {
          content_type: string
          file_name: string
          file_path: string
          file_size: number
          uploaded_at: string
          user_id: string
        }
        Insert: {
          content_type: string
          file_name: string
          file_path: string
          file_size: number
          uploaded_at?: string
          user_id: string
        }
        Update: {
          content_type?: string
          file_name?: string
          file_path?: string
          file_size?: number
          uploaded_at?: string
          user_id?: string
        }
        Relationships: []
      }
      application_drafts: {
        Row: {
          created_at: string
          data: Json
          job_id: string
          step: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          job_id: string
          step?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          job_id?: string
          step?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_drafts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      application_notes: {
        Row: {
          application_id: string
          author_user_id: string | null
          created_at: string
          id: string
          note: string
        }
        Insert: {
          application_id: string
          author_user_id?: string | null
          created_at?: string
          id?: string
          note: string
        }
        Update: {
          application_id?: string
          author_user_id?: string | null
          created_at?: string
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_notes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "job_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      authors: {
        Row: {
          bio: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          photo_url: string | null
          profile_url: string | null
          role: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          photo_url?: string | null
          profile_url?: string | null
          role?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          photo_url?: string | null
          profile_url?: string | null
          role?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      booking_availability_exceptions: {
        Row: {
          created_at: string
          end_time: string | null
          exception_date: string
          id: string
          kind: string
          reason: string | null
          start_time: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          exception_date: string
          id?: string
          kind: string
          reason?: string | null
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_time?: string | null
          exception_date?: string
          id?: string
          kind?: string
          reason?: string | null
          start_time?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      booking_availability_rules: {
        Row: {
          created_at: string
          day_of_week: number
          enabled: boolean
          end_time: string
          id: string
          sort_order: number
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          enabled?: boolean
          end_time: string
          id?: string
          sort_order?: number
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          enabled?: boolean
          end_time?: string
          id?: string
          sort_order?: number
          start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          booking_reference: string
          client_user_id: string | null
          company: string | null
          created_at: string
          duration_minutes: number
          email: string
          id: string
          internal_notes: string | null
          ip_hash: string | null
          meeting_url: string | null
          name: string
          notes: string | null
          phone: string | null
          public_notes: string | null
          requested_start_at: string
          service_interest: string[]
          status: string
          timezone: string
          topic: string
          updated_at: string
        }
        Insert: {
          booking_reference: string
          client_user_id?: string | null
          company?: string | null
          created_at?: string
          duration_minutes?: number
          email: string
          id?: string
          internal_notes?: string | null
          ip_hash?: string | null
          meeting_url?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          public_notes?: string | null
          requested_start_at: string
          service_interest?: string[]
          status?: string
          timezone: string
          topic: string
          updated_at?: string
        }
        Update: {
          booking_reference?: string
          client_user_id?: string | null
          company?: string | null
          created_at?: string
          duration_minutes?: number
          email?: string
          id?: string
          internal_notes?: string | null
          ip_hash?: string | null
          meeting_url?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          public_notes?: string | null
          requested_start_at?: string
          service_interest?: string[]
          status?: string
          timezone?: string
          topic?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_files: {
        Row: {
          client_user_id: string
          created_at: string
          description: string | null
          file_name: string
          file_size: number | null
          id: string
          mime_type: string | null
          storage_path: string
          title: string
          uploaded_by: string | null
        }
        Insert: {
          client_user_id: string
          created_at?: string
          description?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          storage_path: string
          title: string
          uploaded_by?: string | null
        }
        Update: {
          client_user_id?: string
          created_at?: string
          description?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          storage_path?: string
          title?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      job_applications: {
        Row: {
          answers: Json
          applicant_user_id: string | null
          cover_note: string
          created_at: string
          eligibility_passed: boolean | null
          email: string
          extra: Json
          full_name: string
          id: string
          ip_hash: string | null
          job_id: string
          linkedin_url: string | null
          location: string | null
          phone: string
          portfolio_url: string | null
          resume_url: string | null
          status: string
          submitted_at: string
          updated_at: string
          withdrawn_at: string | null
        }
        Insert: {
          answers?: Json
          applicant_user_id?: string | null
          cover_note: string
          created_at?: string
          eligibility_passed?: boolean | null
          email: string
          extra?: Json
          full_name: string
          id?: string
          ip_hash?: string | null
          job_id: string
          linkedin_url?: string | null
          location?: string | null
          phone: string
          portfolio_url?: string | null
          resume_url?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
          withdrawn_at?: string | null
        }
        Update: {
          answers?: Json
          applicant_user_id?: string | null
          cover_note?: string
          created_at?: string
          eligibility_passed?: boolean | null
          email?: string
          extra?: Json
          full_name?: string
          id?: string
          ip_hash?: string | null
          job_id?: string
          linkedin_url?: string | null
          location?: string | null
          phone?: string
          portfolio_url?: string | null
          resume_url?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_interviews: {
        Row: {
          application_id: string
          created_at: string
          created_by: string | null
          id: string
          internal_notes: string | null
          interview_type: string
          location: string | null
          meeting_url: string | null
          public_notes: string | null
          scheduled_at: string
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          application_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          internal_notes?: string | null
          interview_type?: string
          location?: string | null
          meeting_url?: string | null
          public_notes?: string | null
          scheduled_at: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          internal_notes?: string | null
          interview_type?: string
          location?: string | null
          meeting_url?: string | null
          public_notes?: string | null
          scheduled_at?: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_interviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "job_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      job_slug_redirects: {
        Row: {
          created_at: string
          job_id: string
          old_slug: string
        }
        Insert: {
          created_at?: string
          job_id: string
          old_slug: string
        }
        Update: {
          created_at?: string
          job_id?: string
          old_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_slug_redirects_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          created_at: string
          deadline_at: string | null
          department: string | null
          description_html: string | null
          description_json: Json
          details: Json
          employment_type: string | null
          featured: boolean
          id: string
          job_code: string | null
          location: string | null
          open_at: string | null
          published_at: string | null
          requirements_json: Json
          seo: Json
          slug: string
          sort_order: number
          status: string
          summary: string | null
          title: string
          updated_at: string
          urgent: boolean
          vacancies: number | null
          work_mode: string | null
        }
        Insert: {
          created_at?: string
          deadline_at?: string | null
          department?: string | null
          description_html?: string | null
          description_json?: Json
          details?: Json
          employment_type?: string | null
          featured?: boolean
          id?: string
          job_code?: string | null
          location?: string | null
          open_at?: string | null
          published_at?: string | null
          requirements_json?: Json
          seo?: Json
          slug: string
          sort_order?: number
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
          urgent?: boolean
          vacancies?: number | null
          work_mode?: string | null
        }
        Update: {
          created_at?: string
          deadline_at?: string | null
          department?: string | null
          description_html?: string | null
          description_json?: Json
          details?: Json
          employment_type?: string | null
          featured?: boolean
          id?: string
          job_code?: string | null
          location?: string | null
          open_at?: string | null
          published_at?: string | null
          requirements_json?: Json
          seo?: Json
          slug?: string
          sort_order?: number
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
          urgent?: boolean
          vacancies?: number | null
          work_mode?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          assigned_to: string | null
          attachment_name: string | null
          attachment_path: string | null
          budget_range: string | null
          client_user_id: string | null
          company: string | null
          created_at: string
          email: string
          id: string
          internal_notes: string | null
          ip_hash: string | null
          name: string
          phone: string | null
          project_summary: string
          reference_links: string[]
          service_interest: string[]
          source: string
          status: string
          timeline: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          assigned_to?: string | null
          attachment_name?: string | null
          attachment_path?: string | null
          budget_range?: string | null
          client_user_id?: string | null
          company?: string | null
          created_at?: string
          email: string
          id?: string
          internal_notes?: string | null
          ip_hash?: string | null
          name: string
          phone?: string | null
          project_summary: string
          reference_links?: string[]
          service_interest?: string[]
          source?: string
          status?: string
          timeline?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          assigned_to?: string | null
          attachment_name?: string | null
          attachment_path?: string | null
          budget_range?: string | null
          client_user_id?: string | null
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          internal_notes?: string | null
          ip_hash?: string | null
          name?: string
          phone?: string | null
          project_summary?: string
          reference_links?: string[]
          service_interest?: string[]
          source?: string
          status?: string
          timeline?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      page_sections: {
        Row: {
          body: string | null
          config: Json
          created_at: string
          cta_label: string | null
          cta_url: string | null
          eyebrow: string | null
          id: string
          is_visible: boolean
          media_type: string | null
          media_url: string | null
          page_id: string
          section_type: string
          sort_order: number
          title: string | null
          updated_at: string
        }
        Insert: {
          body?: string | null
          config?: Json
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          eyebrow?: string | null
          id?: string
          is_visible?: boolean
          media_type?: string | null
          media_url?: string | null
          page_id: string
          section_type: string
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Update: {
          body?: string | null
          config?: Json
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          eyebrow?: string | null
          id?: string
          is_visible?: boolean
          media_type?: string | null
          media_url?: string | null
          page_id?: string
          section_type?: string
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_sections_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "site_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_case_sections: {
        Row: {
          body: string | null
          config: Json
          created_at: string
          eyebrow: string | null
          id: string
          is_visible: boolean
          project_id: string
          section_type: string
          sort_order: number
          title: string | null
          updated_at: string
        }
        Insert: {
          body?: string | null
          config?: Json
          created_at?: string
          eyebrow?: string | null
          id?: string
          is_visible?: boolean
          project_id: string
          section_type: string
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Update: {
          body?: string | null
          config?: Json
          created_at?: string
          eyebrow?: string | null
          id?: string
          is_visible?: boolean
          project_id?: string
          section_type?: string
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_case_sections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      portfolio_media: {
        Row: {
          alt_text: string | null
          caption: string | null
          created_at: string
          height: number | null
          id: string
          media_type: string
          orientation: string
          poster_url: string | null
          project_id: string
          sort_order: number
          updated_at: string
          url: string
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          caption?: string | null
          created_at?: string
          height?: number | null
          id?: string
          media_type: string
          orientation?: string
          poster_url?: string | null
          project_id: string
          sort_order?: number
          updated_at?: string
          url: string
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          caption?: string | null
          created_at?: string
          height?: number | null
          id?: string
          media_type?: string
          orientation?: string
          poster_url?: string | null
          project_id?: string
          sort_order?: number
          updated_at?: string
          url?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_media_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_project_services: {
        Row: {
          project_id: string
          service_id: string
          sort_order: number
        }
        Insert: {
          project_id: string
          service_id: string
          sort_order?: number
        }
        Update: {
          project_id?: string
          service_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_project_services_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_project_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_project_team: {
        Row: {
          created_at: string
          id: string
          is_visible: boolean
          member_name: string
          photo_url: string | null
          profile_url: string | null
          project_id: string
          role: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_visible?: boolean
          member_name: string
          photo_url?: string | null
          profile_url?: string | null
          project_id: string
          role: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_visible?: boolean
          member_name?: string
          photo_url?: string | null
          profile_url?: string | null
          project_id?: string
          role?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_project_team_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_projects: {
        Row: {
          approach: string | null
          canonical_url: string | null
          category_id: string | null
          challenge: string | null
          client_name: string | null
          cover_position: string
          cover_poster_url: string | null
          cover_type: string | null
          cover_url: string | null
          created_at: string
          execution: string | null
          id: string
          industry: string | null
          is_featured: boolean
          meta_description: string | null
          meta_title: string | null
          noindex: boolean
          og_image_url: string | null
          overview: string | null
          project_year: number | null
          result: string | null
          short_description: string | null
          slug: string
          sort_order: number
          status: string
          timeline: string | null
          title: string
          updated_at: string
        }
        Insert: {
          approach?: string | null
          canonical_url?: string | null
          category_id?: string | null
          challenge?: string | null
          client_name?: string | null
          cover_position?: string
          cover_poster_url?: string | null
          cover_type?: string | null
          cover_url?: string | null
          created_at?: string
          execution?: string | null
          id?: string
          industry?: string | null
          is_featured?: boolean
          meta_description?: string | null
          meta_title?: string | null
          noindex?: boolean
          og_image_url?: string | null
          overview?: string | null
          project_year?: number | null
          result?: string | null
          short_description?: string | null
          slug: string
          sort_order?: number
          status?: string
          timeline?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          approach?: string | null
          canonical_url?: string | null
          category_id?: string | null
          challenge?: string | null
          client_name?: string | null
          cover_position?: string
          cover_poster_url?: string | null
          cover_type?: string | null
          cover_url?: string | null
          created_at?: string
          execution?: string | null
          id?: string
          industry?: string | null
          is_featured?: boolean
          meta_description?: string | null
          meta_title?: string | null
          noindex?: boolean
          og_image_url?: string | null
          overview?: string | null
          project_year?: number | null
          result?: string | null
          short_description?: string | null
          slug?: string
          sort_order?: number
          status?: string
          timeline?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_projects_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "portfolio_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string | null
          canonical_url: string | null
          category: string | null
          content_html: string | null
          content_json: Json
          cover_alt: string | null
          cover_url: string | null
          created_at: string
          excerpt: string | null
          featured: boolean
          id: string
          meta_description: string | null
          meta_title: string | null
          noindex: boolean
          og_image_url: string | null
          published_at: string | null
          slug: string
          sort_order: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          canonical_url?: string | null
          category?: string | null
          content_html?: string | null
          content_json?: Json
          cover_alt?: string | null
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          featured?: boolean
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          noindex?: boolean
          og_image_url?: string | null
          published_at?: string | null
          slug: string
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          canonical_url?: string | null
          category?: string | null
          content_html?: string | null
          content_json?: Json
          cover_alt?: string | null
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          featured?: boolean
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          noindex?: boolean
          og_image_url?: string | null
          published_at?: string | null
          slug?: string
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_groups: {
        Row: {
          config: Json
          created_at: string
          description: string | null
          id: string
          is_featured: boolean
          name: string
          short_description: string | null
          slug: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_featured?: boolean
          name: string
          short_description?: string | null
          slug: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_featured?: boolean
          name?: string
          short_description?: string | null
          slug?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          canonical_url: string | null
          created_at: string
          description: string | null
          featured: boolean
          group_id: string
          hero_media_type: string | null
          hero_media_url: string | null
          hero_poster_url: string | null
          id: string
          meta_description: string | null
          meta_title: string | null
          name: string
          noindex: boolean
          og_image_url: string | null
          page_config: Json
          short_description: string | null
          slug: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          canonical_url?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          group_id: string
          hero_media_type?: string | null
          hero_media_url?: string | null
          hero_poster_url?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          name: string
          noindex?: boolean
          og_image_url?: string | null
          page_config?: Json
          short_description?: string | null
          slug: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          canonical_url?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          group_id?: string
          hero_media_type?: string | null
          hero_media_url?: string | null
          hero_poster_url?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          noindex?: boolean
          og_image_url?: string | null
          page_config?: Json
          short_description?: string | null
          slug?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "service_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      site_pages: {
        Row: {
          canonical_url: string | null
          created_at: string
          id: string
          meta_description: string | null
          meta_title: string | null
          noindex: boolean
          og_image_url: string | null
          page_type: string
          slug: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          canonical_url?: string | null
          created_at?: string
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          noindex?: boolean
          og_image_url?: string | null
          page_type?: string
          slug: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          canonical_url?: string | null
          created_at?: string
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          noindex?: boolean
          og_image_url?: string | null
          page_type?: string
          slug?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          created_at: string
          id: string
          setting_group: string
          settings: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          setting_group: string
          settings?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          setting_group?: string
          settings?: Json
          updated_at?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          department: string | null
          email: string | null
          featured: boolean
          full_bio: string | null
          id: string
          leadership_level: number
          linkedin_url: string | null
          manager_id: string | null
          name: string
          photo_url: string | null
          role: string | null
          short_bio: string | null
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          email?: string | null
          featured?: boolean
          full_bio?: string | null
          id?: string
          leadership_level?: number
          linkedin_url?: string | null
          manager_id?: string | null
          name: string
          photo_url?: string | null
          role?: string | null
          short_bio?: string | null
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string | null
          featured?: boolean
          full_bio?: string | null
          id?: string
          leadership_level?: number
          linkedin_url?: string | null
          manager_id?: string | null
          name?: string
          photo_url?: string | null
          role?: string | null
          short_bio?: string | null
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ensure_applicant_profile: { Args: never; Returns: undefined }
      ensure_client_profile: { Args: never; Returns: undefined }
      list_sales_staff: {
        Args: never
        Returns: {
          email: string
          full_name: string
          id: string
        }[]
      }
      my_application: {
        Args: { _id: string }
        Returns: {
          cover_note: string
          email: string
          employment_type: string
          full_name: string
          has_resume: boolean
          id: string
          job_slug: string
          job_title: string
          linkedin_url: string
          location: string
          phone: string
          portfolio_url: string
          status: string
          submitted_at: string
          withdrawn_at: string
        }[]
      }
      my_application_extra: {
        Args: { _id: string }
        Returns: {
          answers: Json
          department: string
          extra: Json
          job_location: string
          work_mode: string
        }[]
      }
      my_applications: {
        Args: never
        Returns: {
          employment_type: string
          id: string
          job_slug: string
          job_title: string
          status: string
          submitted_at: string
        }[]
      }
      my_applications_full: {
        Args: never
        Returns: {
          department: string
          employment_type: string
          id: string
          job_slug: string
          job_title: string
          location: string
          status: string
          submitted_at: string
          work_mode: string
        }[]
      }
      my_bookings: {
        Args: never
        Returns: {
          booking_reference: string
          created_at: string
          duration_minutes: number
          id: string
          meeting_url: string
          public_notes: string
          requested_start_at: string
          service_interest: string[]
          status: string
          timezone: string
          topic: string
        }[]
      }
      my_interviews: {
        Args: never
        Returns: {
          application_id: string
          id: string
          interview_type: string
          job_title: string
          location: string
          meeting_url: string
          public_notes: string
          scheduled_at: string
          status: string
          timezone: string
        }[]
      }
      my_requests: {
        Args: never
        Returns: {
          created_at: string
          id: string
          project_summary: string
          service_interest: string[]
          status: string
        }[]
      }
      withdraw_my_application: { Args: { _id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
