export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string;
          email: string;
          role: "CUSTOMER" | "SUPPORT_AGENT" | "ADMIN";
          avatar: string | null;
          created_at: string;
          updated_at?: string;
        };
        Insert: {
          id: string;
          name: string;
          email: string;
          role: "CUSTOMER" | "SUPPORT_AGENT" | "ADMIN";
          avatar?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          role?: "CUSTOMER" | "SUPPORT_AGENT" | "ADMIN";
          avatar?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tickets: {
        Row: {
          id: string;
          title: string;
          description: string;
          category: string;
          priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
          status: string;
          customer_id: string;
          assigned_agent_id: string | null;
          created_at: string;
          updated_at: string;
          sla_response_deadline: string | null;
          sla_resolution_deadline: string | null;
          sla_deadline: string | null;
          sla_breach: boolean;
          attachments: Json | null;
          tags: string[] | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          description: string;
          category: string;
          priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
          status?: string;
          customer_id: string;
          assigned_agent_id?: string | null;
          created_at?: string;
          updated_at?: string;
          sla_response_deadline?: string | null;
          sla_resolution_deadline?: string | null;
          sla_deadline?: string | null;
          sla_breach?: boolean;
          attachments?: Json | null;
          tags?: string[] | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string;
          category?: string;
          priority?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
          status?: string;
          customer_id?: string;
          assigned_agent_id?: string | null;
          created_at?: string;
          updated_at?: string;
          sla_response_deadline?: string | null;
          sla_resolution_deadline?: string | null;
          sla_deadline?: string | null;
          sla_breach?: boolean;
          attachments?: Json | null;
          tags?: string[] | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      ticket_comments: {
        Row: {
          id: string;
          ticket_id: string;
          author_id: string;
          content: string;
          is_internal: boolean;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          ticket_id: string;
          author_id: string;
          content: string;
          is_internal?: boolean;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          ticket_id?: string;
          author_id?: string;
          content?: string;
          is_internal?: boolean;
          created_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          created_at: string;
          actor_id: string | null;
          actor_name: string;
          actor_role: string;
          action: string;
          entity_id: string;
          entity_type: string;
          old_value: Json | null;
          new_value: Json | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          actor_id?: string | null;
          actor_name: string;
          actor_role: string;
          action: string;
          entity_id: string;
          entity_type: string;
          old_value?: Json | null;
          new_value?: Json | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          actor_id?: string | null;
          actor_name?: string;
          actor_role?: string;
          action?: string;
          entity_id?: string;
          entity_type?: string;
          old_value?: Json | null;
          new_value?: Json | null;
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
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export type DbUser = Database["public"]["Tables"]["users"]["Row"];
export type DbTicket = Database["public"]["Tables"]["tickets"]["Row"];
export type DbComment = Database["public"]["Tables"]["ticket_comments"]["Row"];
export type DbAuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];
