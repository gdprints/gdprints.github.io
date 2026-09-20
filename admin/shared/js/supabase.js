/* ============================================================
   Supabase client — shared across every page (site, admin, manager)
   Loaded via CDN BEFORE this script:
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   ============================================================ */

const SUPABASE_URL = "https://updrcpiopffnoibchaqp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwZHJjcGlvcGZmbm9pYmNoYXFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxNjc2MTQsImV4cCI6MjEwMTc0MzYxNH0.KAwWbfLsUpgzTJFsa5IcrLpwGLtF-tQjCTU-zlFG8B0";

// Expose the shared client both as a global lexical binding and on window.
// Public site pages (e.g. partner registration) need window.supabaseClient,
// while legacy admin/app scripts reference supabaseClient directly.
window.supabaseClient = window.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseClient = window.supabaseClient;
