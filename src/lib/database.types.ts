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
        };
        Insert: {
          id: string;
          name: string;
          email: string;
          role: "CUSTOMER" | "SUPPORT_AGENT" | "ADMIN";
          avatar?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
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
        };
        Update: Partial<Database["public"]["Tables"]["tickets"]["Insert"]>;
      };
      ticket_comments: {
        Row: {
          id: string;
          ticket_id: string;
          author_id: string;
          content: string;
          is_internal: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          ticket_id: string;
          author_id: string;
          content: string;
          is_internal?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ticket_comments"]["Insert"]>;
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
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Insert"]>;
      };
    };
  };
}

export type DbUser = Database["public"]["Tables"]["users"]["Row"];
export type DbTicket = Database["public"]["Tables"]["tickets"]["Row"];
export type DbComment = Database["public"]["Tables"]["ticket_comments"]["Row"];
export type DbAuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];
