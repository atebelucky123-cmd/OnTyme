// Supabase client — used only for Storage (invoice/receipt PDFs).
// Firebase Storage requires the Blaze (billing) plan; Supabase's free tier
// doesn't, so file storage lives here while Auth/Firestore stay on Firebase.
//
// This publishable key is safe to ship in frontend code — Storage access is
// controlled by the bucket policies set on the Supabase project, not by
// hiding this key. Bucket policies live only in Supabase, scoped to the
// ontyme-invoices / ontyme-receipts buckets — nothing here touches any other
// table or bucket in that project.
//
// Requires the supabase-js UMD build to be loaded on the page first:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
const SUPABASE_URL = 'https://ezodxjliaosqtzdvlxdr.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_N2wTmxCPNHyA2MWXhMuoXQ_qXBS-S4h';

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
