// Minimal supabase type stubs for compatibility with copied Next.js components
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Stub Database type to satisfy imports in chat-history.tsx
// In a full Supabase integration you'd replace this with the generated types
export interface Database {
  [schema: string]: {
    Tables: {
      [table: string]: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
    };
  };
}
