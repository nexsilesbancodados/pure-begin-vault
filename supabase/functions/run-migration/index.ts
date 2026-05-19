
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const sql = `
      ALTER TABLE products ADD COLUMN IF NOT EXISTS import_job_id UUID REFERENCES import_jobs(id) ON DELETE SET NULL;
      ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS import_job_id UUID REFERENCES import_jobs(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_products_import_job_id ON products(import_job_id);
      CREATE INDEX IF NOT EXISTS idx_stock_movements_import_job_id ON stock_movements(import_job_id);
    `;

    const { error } = await supabase.rpc("exec_sql", { sql_query: sql });
    
    // If exec_sql doesn't exist, we might have to use another way, 
    // but usually in these environments there is a helper or we can just try.
    
    if (error) {
       // If rpc fails, try to just run it as a raw query if possible (not directly possible via JS client without extensions)
       return new Response(JSON.stringify({ error: "exec_sql rpc not found or failed: " + error.message }), { 
         headers: { ...corsHeaders, "Content-Type": "application/json" },
         status: 400 
       });
    }

    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500 
    });
  }
});
