import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://jxaisgqluhozmgffjvln.supabase.co';
export const BUCKET_NAME = 'quotations';

export const supabase = createClient(
  SUPABASE_URL,
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4YWlzZ3FsdWhvem1nZmZqdmxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMjg3MjEsImV4cCI6MjA5NTgwNDcyMX0.L0S_YnfaRHHQD7bkRaIq0vN3d40nh_7D49Vb9jD18-Q'
);
