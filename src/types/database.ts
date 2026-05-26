export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          avatar_url: string | null;
          couple_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          avatar_url?: string | null;
          couple_id?: string | null;
        };
        Update: {
          email?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          couple_id?: string | null;
        };
        Relationships: [];
      };
      couples: {
        Row: {
          id: string;
          name: string | null;
          invite_code: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name?: string | null;
          invite_code?: string;
        };
        Update: {
          name?: string | null;
          invite_code?: string;
        };
        Relationships: [];
      };
      cards: {
        Row: {
          id: string;
          couple_id: string;
          owner_id: string;
          plaid_item_id: string | null;
          plaid_account_id: string | null;
          plaid_access_token: string | null;
          institution_name: string;
          account_name: string;
          last_four: string | null;
          account_type: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          couple_id: string;
          owner_id: string;
          plaid_item_id?: string | null;
          plaid_account_id?: string | null;
          plaid_access_token?: string | null;
          institution_name: string;
          account_name: string;
          last_four?: string | null;
          account_type?: string;
          is_active?: boolean;
        };
        Update: {
          couple_id?: string;
          owner_id?: string;
          plaid_item_id?: string | null;
          plaid_account_id?: string | null;
          plaid_access_token?: string | null;
          institution_name?: string;
          account_name?: string;
          last_four?: string | null;
          account_type?: string;
          is_active?: boolean;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          couple_id: string | null;
          name: string;
          icon: string | null;
          color: string | null;
          is_default: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          couple_id?: string | null;
          name: string;
          icon?: string | null;
          color?: string | null;
          is_default?: boolean;
        };
        Update: {
          couple_id?: string | null;
          name?: string;
          icon?: string | null;
          color?: string | null;
          is_default?: boolean;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          couple_id: string;
          card_id: string | null;
          category_id: string | null;
          plaid_transaction_id: string | null;
          merchant_name: string | null;
          amount: number;
          currency: string;
          date: string;
          note: string | null;
          is_pending: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          couple_id: string;
          card_id?: string | null;
          category_id?: string | null;
          plaid_transaction_id?: string | null;
          merchant_name?: string | null;
          amount: number;
          currency?: string;
          date: string;
          note?: string | null;
          is_pending?: boolean;
        };
        Update: {
          card_id?: string | null;
          category_id?: string | null;
          merchant_name?: string | null;
          amount?: number;
          currency?: string;
          date?: string;
          note?: string | null;
          is_pending?: boolean;
        };
        Relationships: [];
      };
      transaction_splits: {
        Row: {
          id: string;
          transaction_id: string;
          category_id: string | null;
          amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          transaction_id: string;
          category_id?: string | null;
          amount: number;
        };
        Update: {
          category_id?: string | null;
          amount?: number;
        };
        Relationships: [];
      };
      budgets: {
        Row: {
          id: string;
          couple_id: string;
          category_id: string | null;
          name: string;
          amount: number;
          period: "weekly" | "monthly" | "yearly";
          start_date: string;
          end_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          couple_id: string;
          category_id?: string | null;
          name: string;
          amount: number;
          period: "weekly" | "monthly" | "yearly";
          start_date?: string;
          end_date?: string | null;
        };
        Update: {
          category_id?: string | null;
          name?: string;
          amount?: number;
          period?: "weekly" | "monthly" | "yearly";
          start_date?: string;
          end_date?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
