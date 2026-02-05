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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      event_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          payload: Json
          requested_event_extra: string | null
          requested_event_name: string
          status: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          payload: Json
          requested_event_extra?: string | null
          requested_event_name: string
          status?: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          payload?: Json
          requested_event_extra?: string | null
          requested_event_name?: string
          status?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          category: string | null
          city: string | null
          created_at: string | null
          id: string
          image_url: string | null
          starts_at: string
          title: string
          venue: string | null
          warnings: string | null
        }
        Insert: {
          category?: string | null
          city?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          starts_at: string
          title: string
          venue?: string | null
          warnings?: string | null
        }
        Update: {
          category?: string | null
          city?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          starts_at?: string
          title?: string
          venue?: string | null
          warnings?: string | null
        }
        Relationships: []
      }
      audit_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          order_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          order_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          order_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      order_messages: {
        Row: {
          attachment_name: string | null
          attachment_url: string | null
          created_at: string | null
          id: string
          message: string
          order_id: string
          sender_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_url?: string | null
          created_at?: string | null
          id?: string
          message: string
          order_id: string
          sender_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_url?: string | null
          created_at?: string | null
          id?: string
          message?: string
          order_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount: number | null
          amount_clp: number | null
          buy_order: string | null
          buyer_id: string
          created_at: string | null
          currency: string | null
          event_id: string | null
          fee_clp: number | null
          fees_clp: number | null
          id: string
          listing_id: string | null
          paid_at: string | null
          payment_method: string | null
          payment_payload: Json | null
          payment_process_url: string | null
          payment_provider: string | null
          payment_request_id: string | null
          payment_state: string | null
          renominated_storage_bucket: string | null
          renominated_storage_path: string | null
          renominated_uploaded_at: string | null
          seller_id: string | null
          session_id: string | null
          status: string | null
          ticket_id: string | null
          total_amount: number
          total_clp: number | null
          total_paid_clp: number | null
          updated_at: string | null
          user_id: string | null
          webpay_authorization_code: string | null
          webpay_card_last4: string | null
          webpay_installments_number: number | null
          webpay_payment_type_code: string | null
          webpay_token: string | null
        }
        Insert: {
          amount?: number | null
          amount_clp?: number | null
          buy_order?: string | null
          buyer_id: string
          created_at?: string | null
          currency?: string | null
          event_id?: string | null
          fee_clp?: number | null
          fees_clp?: number | null
          id?: string
          listing_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_payload?: Json | null
          payment_process_url?: string | null
          payment_provider?: string | null
          payment_request_id?: string | null
          payment_state?: string | null
          renominated_storage_bucket?: string | null
          renominated_storage_path?: string | null
          renominated_uploaded_at?: string | null
          seller_id?: string | null
          session_id?: string | null
          status?: string | null
          ticket_id?: string | null
          total_amount?: number
          total_clp?: number | null
          total_paid_clp?: number | null
          updated_at?: string | null
          user_id?: string | null
          webpay_authorization_code?: string | null
          webpay_card_last4?: string | null
          webpay_installments_number?: number | null
          webpay_payment_type_code?: string | null
          webpay_token?: string | null
        }
        Update: {
          amount?: number | null
          amount_clp?: number | null
          buy_order?: string | null
          buyer_id?: string
          created_at?: string | null
          currency?: string | null
          event_id?: string | null
          fee_clp?: number | null
          fees_clp?: number | null
          id?: string
          listing_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_payload?: Json | null
          payment_process_url?: string | null
          payment_provider?: string | null
          payment_request_id?: string | null
          payment_state?: string | null
          renominated_storage_bucket?: string | null
          renominated_storage_path?: string | null
          renominated_uploaded_at?: string | null
          seller_id?: string | null
          session_id?: string | null
          status?: string | null
          ticket_id?: string | null
          total_amount?: number
          total_clp?: number | null
          total_paid_clp?: number | null
          updated_at?: string | null
          user_id?: string | null
          webpay_authorization_code?: string | null
          webpay_card_last4?: string | null
          webpay_installments_number?: number | null
          webpay_payment_type_code?: string | null
          webpay_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_accounts: {
        Row: {
          account_number: string
          account_type: string
          bank_name: string
          created_at: string
          holder_name: string
          holder_rut: string
          transfer_email: string | null
          transfer_phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_number: string
          account_type?: string
          bank_name: string
          created_at?: string
          holder_name: string
          holder_rut: string
          transfer_email?: string | null
          transfer_phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_number?: string
          account_type?: string
          bank_name?: string
          created_at?: string
          holder_name?: string
          holder_rut?: string
          transfer_email?: string | null
          transfer_phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          app_role: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          email: string | null
          email_confirmed: boolean | null
          full_name: string | null
          id: string
          is_blocked: boolean
          onboarding_completed: boolean | null
          onboarding_completed_at: string | null
          onboarding_dismissed_at: string | null
          onboarding_done: boolean | null
          onboarding_skipped_at: string | null
          phone: string | null
          role: string
          rut: string | null
          seller_tier: string | null
          seller_tier_locked: boolean
          seller_type: string | null
          status: string
          tier: string | null
          trust_score: number | null
          user_type: string | null
          verified_at: string | null
        }
        Insert: {
          app_role?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          email_confirmed?: boolean | null
          full_name?: string | null
          id: string
          is_blocked?: boolean
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          onboarding_dismissed_at?: string | null
          onboarding_done?: boolean | null
          onboarding_skipped_at?: string | null
          phone?: string | null
          role?: string
          rut?: string | null
          seller_tier?: string | null
          seller_tier_locked?: boolean
          seller_type?: string | null
          status?: string
          tier?: string | null
          trust_score?: number | null
          user_type?: string | null
          verified_at?: string | null
        }
        Update: {
          app_role?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          email_confirmed?: boolean | null
          full_name?: string | null
          id?: string
          is_blocked?: boolean
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          onboarding_dismissed_at?: string | null
          onboarding_done?: boolean | null
          onboarding_skipped_at?: string | null
          phone?: string | null
          role?: string
          rut?: string | null
          seller_tier?: string | null
          seller_tier_locked?: boolean
          seller_type?: string | null
          status?: string
          tier?: string | null
          trust_score?: number | null
          user_type?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      ratings: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          order_id: string | null
          rater_id: string
          role: string
          stars: number
          target_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          order_id?: string | null
          rater_id: string
          role: string
          stars: number
          target_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          order_id?: string | null
          rater_id?: string
          role?: string
          stars?: number
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      support_attachments: {
        Row: {
          created_at: string
          filename: string
          id: string
          message_id: string | null
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          message_id?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          message_id?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "support_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          body: string | null
          created_at: string
          id: string
          sender_role: string
          sender_user_id: string | null
          ticket_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          sender_role: string
          sender_user_id?: string | null
          ticket_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          sender_role?: string
          sender_user_id?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_response: string | null
          assigned_admin_id: string | null
          category: string | null
          closed_at: string | null
          closed_by: string | null
          code: string | null
          created_at: string | null
          due_at: string | null
          id: string
          last_message_at: string | null
          message: string
          order_id: string | null
          requester_email: string | null
          requester_name: string | null
          requester_rut: string | null
          status: string | null
          subject: string
          ticket_number: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_response?: string | null
          assigned_admin_id?: string | null
          category?: string | null
          closed_at?: string | null
          closed_by?: string | null
          code?: string | null
          created_at?: string | null
          due_at?: string | null
          id?: string
          last_message_at?: string | null
          message: string
          order_id?: string | null
          requester_email?: string | null
          requester_name?: string | null
          requester_rut?: string | null
          status?: string | null
          subject: string
          ticket_number?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_response?: string | null
          assigned_admin_id?: string | null
          category?: string | null
          closed_at?: string | null
          closed_by?: string | null
          code?: string | null
          created_at?: string | null
          due_at?: string | null
          id?: string
          last_message_at?: string | null
          message?: string
          order_id?: string | null
          requester_email?: string | null
          requester_name?: string | null
          requester_rut?: string | null
          status?: string | null
          subject?: string
          ticket_number?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_files: {
        Row: {
          created_at: string
          event_id: string
          id: string
          is_nominated: boolean
          original_filename: string | null
          owner_user_id: string
          sha256: string
          size_bytes: number | null
          status: string
          storage_bucket: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          is_nominated?: boolean
          original_filename?: string | null
          owner_user_id: string
          sha256: string
          size_bytes?: number | null
          status?: string
          storage_bucket?: string
          storage_path: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          is_nominated?: boolean
          original_filename?: string | null
          owner_user_id?: string
          sha256?: string
          size_bytes?: number | null
          status?: string
          storage_bucket?: string
          storage_path?: string
        }
        Relationships: []
      }
      ticket_files_unified: {
        Row: {
          created_at: string | null
          file_size: number
          id: string
          is_nominated: boolean | null
          meta: Json | null
          mime_type: string | null
          original_filename: string | null
          owner_user_id: string | null
          sha256: string | null
          status: string | null
          storage_bucket: string
          storage_path: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          file_size: number
          id?: string
          is_nominated?: boolean | null
          meta?: Json | null
          mime_type?: string | null
          original_filename?: string | null
          owner_user_id?: string | null
          sha256?: string | null
          status?: string | null
          storage_bucket: string
          storage_path: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          file_size?: number
          id?: string
          is_nominated?: boolean | null
          meta?: Json | null
          mime_type?: string | null
          original_filename?: string | null
          owner_user_id?: string | null
          sha256?: string | null
          status?: string | null
          storage_bucket?: string
          storage_path?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_files_unified_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_files_unified_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_role"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_uploads: {
        Row: {
          attendee_name: string | null
          attendee_rut: string | null
          category: string | null
          created_at: string
          event_datetime: string | null
          event_name: string | null
          file_hash: string
          file_size: number | null
          id: string
          is_nominada: boolean
          is_nominated: boolean
          meta: Json
          mime_type: string | null
          order_number: string | null
          original_filename: string | null
          original_name: string | null
          producer_name: string | null
          producer_rut: string | null
          provider: string | null
          qr_payload: string | null
          sector: string | null
          seller_id: string | null
          sha256: string | null
          status: string | null
          storage_bucket: string
          storage_path: string
          ticket_number: string | null
          user_id: string | null
          validation_reason: string | null
          validation_status: string | null
          venue: string | null
        }
        Insert: {
          attendee_name?: string | null
          attendee_rut?: string | null
          category?: string | null
          created_at?: string
          event_datetime?: string | null
          event_name?: string | null
          file_hash: string
          file_size?: number | null
          id?: string
          is_nominada?: boolean
          is_nominated?: boolean
          meta?: Json
          mime_type?: string | null
          order_number?: string | null
          original_filename?: string | null
          original_name?: string | null
          producer_name?: string | null
          producer_rut?: string | null
          provider?: string | null
          qr_payload?: string | null
          sector?: string | null
          seller_id?: string | null
          sha256?: string | null
          status?: string | null
          storage_bucket: string
          storage_path: string
          ticket_number?: string | null
          user_id?: string | null
          validation_reason?: string | null
          validation_status?: string | null
          venue?: string | null
        }
        Update: {
          attendee_name?: string | null
          attendee_rut?: string | null
          category?: string | null
          created_at?: string
          event_datetime?: string | null
          event_name?: string | null
          file_hash?: string
          file_size?: number | null
          id?: string
          is_nominada?: boolean
          is_nominated?: boolean
          meta?: Json
          mime_type?: string | null
          order_number?: string | null
          original_filename?: string | null
          original_name?: string | null
          producer_name?: string | null
          producer_rut?: string | null
          provider?: string | null
          qr_payload?: string | null
          sector?: string | null
          seller_id?: string | null
          sha256?: string | null
          status?: string | null
          storage_bucket?: string
          storage_path?: string
          ticket_number?: string | null
          user_id?: string | null
          validation_reason?: string | null
          validation_status?: string | null
          venue?: string | null
        }
        Relationships: []
      }
      tickets: {
        Row: {
          created_at: string
          currency: string
          description: string | null
          event_id: string
          id: string
          original_price: number | null
          platform_fee: number | null
          price: number
          row_label: string | null
          sale_type: string
          seat_label: string | null
          section_label: string | null
          sector: string | null
          seller_email: string | null
          seller_id: string
          seller_name: string | null
          seller_rut: string | null
          status: string
          ticket_upload_id: string | null
          title: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string | null
          event_id: string
          id?: string
          original_price?: number | null
          platform_fee?: number | null
          price: number
          row_label?: string | null
          sale_type?: string
          seat_label?: string | null
          section_label?: string | null
          sector?: string | null
          seller_email?: string | null
          seller_id: string
          seller_name?: string | null
          seller_rut?: string | null
          status?: string
          ticket_upload_id?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string | null
          event_id?: string
          id?: string
          original_price?: number | null
          platform_fee?: number | null
          price?: number
          row_label?: string | null
          sale_type?: string
          seat_label?: string | null
          section_label?: string | null
          sector?: string | null
          seller_email?: string | null
          seller_id?: string
          seller_name?: string | null
          seller_rut?: string | null
          status?: string
          ticket_upload_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      tier_config: {
        Row: {
          commission_rate: number
          display_name: string
          min_sales_90d: number
          sort_order: number
          tier: string
        }
        Insert: {
          commission_rate: number
          display_name: string
          min_sales_90d?: number
          sort_order: number
          tier: string
        }
        Update: {
          commission_rate?: number
          display_name?: string
          min_sales_90d?: number
          sort_order?: number
          tier?: string
        }
        Relationships: []
      }
      wallet_movements: {
        Row: {
          amount: number
          available_from: string | null
          created_at: string | null
          currency: string | null
          direction: string
          id: string
          order_id: string | null
          status: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          available_from?: string | null
          created_at?: string | null
          currency?: string | null
          direction: string
          id?: string
          order_id?: string | null
          status?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          available_from?: string | null
          created_at?: string | null
          currency?: string | null
          direction?: string
          id?: string
          order_id?: string | null
          status?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      tickets_public: {
        Row: {
          created_at: string | null
          currency: string | null
          event_id: string | null
          id: string | null
          price: number | null
          row_label: string | null
          sale_type: string | null
          seat_label: string | null
          section_label: string | null
          sector: string | null
          seller_id: string | null
          seller_name: string | null
          status: string | null
          title: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          event_id?: string | null
          id?: string | null
          price?: number | null
          row_label?: string | null
          sale_type?: string | null
          seat_label?: string | null
          section_label?: string | null
          sector?: string | null
          seller_id?: string | null
          seller_name?: string | null
          status?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          event_id?: string | null
          id?: string | null
          price?: number | null
          row_label?: string | null
          sale_type?: string | null
          seat_label?: string | null
          section_label?: string | null
          sector?: string | null
          seller_id?: string | null
          seller_name?: string | null
          status?: string | null
          title?: string | null
        }
        Relationships: []
      }
      profiles_with_role: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          email: string | null
          email_confirmed: boolean | null
          full_name: string | null
          id: string | null
          is_blocked: boolean | null
          onboarding_completed: boolean | null
          onboarding_completed_at: string | null
          onboarding_dismissed_at: string | null
          onboarding_done: boolean | null
          onboarding_skipped_at: string | null
          phone: string | null
          role: string | null
          rut: string | null
          seller_tier: string | null
          seller_tier_locked: boolean | null
          status: string | null
          trust_score: number | null
          user_type: string | null
          verified_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          email_confirmed?: boolean | null
          full_name?: string | null
          id?: string | null
          is_blocked?: boolean | null
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          onboarding_dismissed_at?: string | null
          onboarding_done?: boolean | null
          onboarding_skipped_at?: string | null
          phone?: string | null
          role?: string | null
          rut?: string | null
          seller_tier?: string | null
          seller_tier_locked?: boolean | null
          status?: string | null
          trust_score?: number | null
          user_type?: string | null
          verified_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          email_confirmed?: boolean | null
          full_name?: string | null
          id?: string | null
          is_blocked?: boolean | null
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          onboarding_dismissed_at?: string | null
          onboarding_done?: boolean | null
          onboarding_skipped_at?: string | null
          phone?: string | null
          role?: string | null
          rut?: string | null
          seller_tier?: string | null
          seller_tier_locked?: boolean | null
          status?: string | null
          trust_score?: number | null
          user_type?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_business_days: {
        Args: { days: number; start_ts: string }
        Returns: string
      }
      role_commission_rate: { Args: { p_role: string }; Returns: number }
      rut_exists: { Args: { rut_input: string }; Returns: boolean }
      upgrade_seller_tier_if_needed: {
        Args: { p_seller_id: string }
        Returns: undefined
      }
    }
    Enums: {
      user_role: "standard" | "premium" | "super_premium" | "admin"
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
      user_role: ["standard", "premium", "super_premium", "admin"],
    },
  },
} as const
