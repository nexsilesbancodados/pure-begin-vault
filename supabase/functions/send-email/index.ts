import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getInviteEmailHtml, getWelcomeEmailHtml } from "./templates.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string | string[];
  subject: string;
  html?: string;
  from?: string;
  template?: "invite" | "welcome";
  templateData?: any;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, html: customHtml, from, template, templateData }: EmailRequest = await req.json();

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    let finalHtml = customHtml || "";

    if (template === "invite") {
      finalHtml = getInviteEmailHtml(templateData.token, templateData.inviterEmail);
    } else if (template === "welcome") {
      finalHtml = getWelcomeEmailHtml(templateData.name);
    }

    if (!finalHtml) {
      throw new Error("No HTML content provided or template not found");
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: from || "ConectaCRM <onboarding@resend.dev>",
        to: Array.isArray(to) ? to : [to],
        subject,
        html: finalHtml,
      }),
    });

    const data = await res.json();

    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
