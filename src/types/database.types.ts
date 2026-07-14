export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserStatus = "active" | "suspended" | "banned";
export type AppRole = "user" | "business" | "admin" | "moderator";
export type ProviderStatus = "draft" | "pending_review" | "active" | "suspended" | "archived";
export type VerificationStatus =
  | "unverified"
  | "pending"
  | "partially_verified"
  | "verified"
  | "rejected"
  | "expired";

export type LocalizedJson = { ar: string; en: string };
export type ImageKind = "avatar" | "cover" | "gallery";
export type ProblemPriority = "emergency" | "high" | "normal" | "low";
export type ProviderVerificationStatus = "pending" | "approved" | "rejected";

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          phone: string | null;
          phone_verified_at: string | null;
          email_verified_at: string | null;
          status: UserStatus;
          last_login_at: string | null;
          preferred_locale: string;
          preferred_city_id: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          email: string;
          phone?: string | null;
          phone_verified_at?: string | null;
          email_verified_at?: string | null;
          status?: UserStatus;
          last_login_at?: string | null;
          preferred_locale?: string;
          preferred_city_id?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          phone?: string | null;
          phone_verified_at?: string | null;
          email_verified_at?: string | null;
          status?: UserStatus;
          last_login_at?: string | null;
          preferred_locale?: string;
          preferred_city_id?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          user_id: string;
          display_name: string;
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          display_name: string;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          display_name?: string;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: AppRole;
          granted_at: string;
          granted_by: string | null;
          revoked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: AppRole;
          granted_at?: string;
          granted_by?: string | null;
          revoked_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: AppRole;
          granted_at?: string;
          granted_by?: string | null;
          revoked_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      providers: {
        Row: {
          id: string;
          owner_id: string;
          slug: string;
          name: LocalizedJson;
          about: LocalizedJson | null;
          module_id: string;
          category_id: string;
          city_id: string;
          district_id: string | null;
          address_line: Json | null;
          latitude: number | null;
          longitude: number | null;
          phone: string | null;
          whatsapp: string | null;
          email: string | null;
          website: string | null;
          cover_image_id: string | null;
          avatar_image_id: string | null;
          status: ProviderStatus;
          verification_status: VerificationStatus;
          trust_score: number;
          rating_avg: number;
          review_count: number;
          response_time_hours: number | null;
          profile_completeness: number;
          is_featured: boolean;
          featured_until: string | null;
          metadata: Json;
          published_at: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          owner_id: string;
          slug: string;
          name: LocalizedJson;
          about?: LocalizedJson | null;
          module_id: string;
          category_id: string;
          city_id: string;
          district_id?: string | null;
          address_line?: Json | null;
          latitude?: number | null;
          longitude?: number | null;
          phone?: string | null;
          whatsapp?: string | null;
          email?: string | null;
          website?: string | null;
          cover_image_id?: string | null;
          avatar_image_id?: string | null;
          status?: ProviderStatus;
          verification_status?: VerificationStatus;
          trust_score?: number;
          rating_avg?: number;
          review_count?: number;
          response_time_hours?: number | null;
          profile_completeness?: number;
          is_featured?: boolean;
          featured_until?: string | null;
          metadata?: Json;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          owner_id?: string;
          slug?: string;
          name?: LocalizedJson;
          about?: LocalizedJson | null;
          module_id?: string;
          category_id?: string;
          city_id?: string;
          district_id?: string | null;
          address_line?: Json | null;
          latitude?: number | null;
          longitude?: number | null;
          phone?: string | null;
          whatsapp?: string | null;
          email?: string | null;
          website?: string | null;
          cover_image_id?: string | null;
          avatar_image_id?: string | null;
          status?: ProviderStatus;
          verification_status?: VerificationStatus;
          trust_score?: number;
          rating_avg?: number;
          review_count?: number;
          response_time_hours?: number | null;
          profile_completeness?: number;
          is_featured?: boolean;
          featured_until?: string | null;
          metadata?: Json;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      images: {
        Row: {
          id: string;
          owner_id: string;
          provider_id: string;
          bucket: string;
          path: string;
          kind: ImageKind;
          alt_text: LocalizedJson | null;
          sort_order: number;
          mime_type: string | null;
          size_bytes: number | null;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          owner_id: string;
          provider_id: string;
          bucket?: string;
          path: string;
          kind: ImageKind;
          alt_text?: LocalizedJson | null;
          sort_order?: number;
          mime_type?: string | null;
          size_bytes?: number | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          owner_id?: string;
          provider_id?: string;
          bucket?: string;
          path?: string;
          kind?: ImageKind;
          alt_text?: LocalizedJson | null;
          sort_order?: number;
          mime_type?: string | null;
          size_bytes?: number | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      provider_services: {
        Row: {
          id: string;
          provider_id: string;
          name: LocalizedJson;
          description: LocalizedJson | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          provider_id: string;
          name: LocalizedJson;
          description?: LocalizedJson | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          provider_id?: string;
          name?: LocalizedJson;
          description?: LocalizedJson | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      provider_working_hours: {
        Row: {
          id: string;
          provider_id: string;
          day_of_week: number;
          opens_at: string | null;
          closes_at: string | null;
          is_closed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider_id: string;
          day_of_week: number;
          opens_at?: string | null;
          closes_at?: string | null;
          is_closed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          provider_id?: string;
          day_of_week?: number;
          opens_at?: string | null;
          closes_at?: string | null;
          is_closed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      cities: {
        Row: {
          id: string;
          slug: string;
          name: LocalizedJson;
          country_code: string;
          latitude: number | null;
          longitude: number | null;
          population: number | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: LocalizedJson;
          country_code?: string;
          latitude?: number | null;
          longitude?: number | null;
          population?: number | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: LocalizedJson;
          country_code?: string;
          latitude?: number | null;
          longitude?: number | null;
          population?: number | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          module_id: string;
          parent_id: string | null;
          slug: string;
          name: LocalizedJson;
          description: LocalizedJson | null;
          icon: string | null;
          depth: number;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          module_id: string;
          parent_id?: string | null;
          slug: string;
          name: LocalizedJson;
          description?: LocalizedJson | null;
          icon?: string | null;
          depth?: number;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          module_id?: string;
          parent_id?: string | null;
          slug?: string;
          name?: LocalizedJson;
          description?: LocalizedJson | null;
          icon?: string | null;
          depth?: number;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      provider_verifications: {
        Row: {
          id: string;
          provider_id: string;
          id_front_url: string | null;
          id_back_url: string | null;
          selfie_url: string | null;
          status: ProviderVerificationStatus;
          rejection_reason: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider_id: string;
          id_front_url?: string | null;
          id_back_url?: string | null;
          selfie_url?: string | null;
          status?: ProviderVerificationStatus;
          rejection_reason?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          provider_id?: string;
          id_front_url?: string | null;
          id_back_url?: string | null;
          selfie_url?: string | null;
          status?: ProviderVerificationStatus;
          rejection_reason?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      search_logs: {
        Row: {
          id: string;
          user_id: string | null;
          query_text: string;
          normalized_query: string | null;
          problem_id: string | null;
          category_slug: string | null;
          city_slug: string | null;
          priority: ProblemPriority | null;
          result_count: number;
          provider_ids: string[];
          locale: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          query_text: string;
          normalized_query?: string | null;
          problem_id?: string | null;
          category_slug?: string | null;
          city_slug?: string | null;
          priority?: ProblemPriority | null;
          result_count?: number;
          provider_ids?: string[];
          locale?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          query_text?: string;
          normalized_query?: string | null;
          problem_id?: string | null;
          category_slug?: string | null;
          city_slug?: string | null;
          priority?: ProblemPriority | null;
          result_count?: number;
          provider_ids?: string[];
          locale?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      modules: {
        Row: {
          id: string;
          slug: string;
          name: LocalizedJson;
          description: LocalizedJson | null;
          icon: string | null;
          is_active: boolean;
          sort_order: number;
          config: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: LocalizedJson;
          description?: LocalizedJson | null;
          icon?: string | null;
          is_active?: boolean;
          sort_order?: number;
          config?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: LocalizedJson;
          description?: LocalizedJson | null;
          icon?: string | null;
          is_active?: boolean;
          sort_order?: number;
          config?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_status: UserStatus;
      app_role: AppRole;
      provider_status: ProviderStatus;
      verification_status: VerificationStatus;
      problem_priority: ProblemPriority;
      provider_verification_status: ProviderVerificationStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
