import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROMPTS: Record<string, string> = {
  sales:
    'Extract sales rows from the PDF. Return ONLY a JSON array. Each item: {"Data":"DD/MM/YYYY","Valor":"1500.00","Cliente":"","Produto":"","Quantidade":"1","Forma Pagamento":"","IMEI":"","SKU":"","Marca":"","Modelo":"","CPF":"","Telefone":"","Email":"","Endereco":"","Bairro":"","Cidade":"","Data Nascimento":"","Observacao":""}. Omit markdown. Empty strings for missing fields.',
  stock:
    'Extract products from the PDF inventory. Return ONLY a JSON array. Each item: {"Produto":"","SKU":"","Categoria":"","Marca":"","Modelo":"","IMEI":"","EAN":"","Preco":"0","Custo":"0","Estoque":"0","Observacao":""}. No markdown.',
  finance:
    'Extract finance entries from the PDF. Return ONLY a JSON array. Each item: {"Data":"DD/MM/YYYY","Descricao":"","Valor":"0","Tipo":"receita|despesa","Categoria":"","Pessoa":"","Forma Pagamento":"","Observacao":""}. No markdown.',
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const t0 = Date.now();
  try {
    const { fileBase64, fileName, kind, fast } = await req.json();
    if (!fileBase64) {
      return new Response(JSON.stringify({ error: "No file" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const prompt = PROMPTS[kind] || PROMPTS.sales;
    // Use the fastest Gemini for PDF extraction by default
    const model = fast ? "google/gemini-2.5-flash-lite" : "google/gemini-2.5-flash";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        // Force JSON; skip reasoning to cut latency
        response_format: { type: "json_object" },
        reasoning: { effort: "none" },
        messages: [
          { role: "system", content: prompt + ' Wrap the array in {"rows":[...]} for valid JSON.' },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract now." },
              {
                type: "image_url",
                image_url: { url: `data:application/pdf;base64,${fileBase64}` },
              },
            ],
          },
        ],
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de uso atingido. Tente novamente em instantes." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await response.json();
    if (!aiData.choices?.[0]?.message?.content) {
      console.error("AI Error:", aiData);
      throw new Error(aiData.error?.message || "Erro na IA ao processar o PDF.");
    }
    const content = aiData.choices[0].message.content;
    let rows: any[] = [];
    try {
      const obj = JSON.parse(content);
      rows = Array.isArray(obj) ? obj : obj.rows || obj.data || [];
    } catch {
      const match = content.match(/\[[\s\S]*\]/);
      if (match) rows = JSON.parse(match[0]);
    }
    const elapsed = Date.now() - t0;
    console.log(`parse-import-pdf ${kind} ${fileName} -> ${rows.length} rows in ${elapsed}ms (${model})`);
    return new Response(JSON.stringify({ rows, elapsed_ms: elapsed, model }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
