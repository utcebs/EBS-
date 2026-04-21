import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://hddfkkojfvmjuxsyhcgh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkZGZra29qZnZtanV4c3loY2doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MDI1MjksImV4cCI6MjA5MjI3ODUyOX0.2EYGf2PPBDpkkY1d2Rp87GY5so05ehx6a0sYfCXHe1Q'
)
