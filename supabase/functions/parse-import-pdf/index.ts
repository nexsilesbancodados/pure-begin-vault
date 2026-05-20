import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROMPTS: Record<string, string> = {
  sales: `Extract ALL SALES rows from this PDF (sales/orders report). Return a JSON array.
Each row must be an object with these keys (string values, use empty string if missing):
  "Data", "Valor", "Cliente", "Produto", "Quantidade", "Forma Pagamento",
  "IMEI", "SKU", "Marca", "Modelo", "CPF", "Telefone", "Email",
  "Endereco", "Bairro", "Cidade", "Data Nascimento", "Observacao".
Rules:
- Dates in DD/MM/YYYY.
- Values like 1500.00 (no R$, dot as decimal).
- One object per sale line. Return ONLY the JSON array, no prose, no markdown.`,
  stock: `Extract ALL PRODUCTS from this PDF inventory. Return a JSON array.
Each row: { "Produto","SKU","Categoria","Marca","Modelo","IMEI","EAN","Preco","Custo","Estoque","Observacao" }.
Return ONLY JSON.`,
  finance: `Extract ALL FINANCE entries from this PDF. Return a JSON array.
Each row: { "Data","Descricao","Valor","Tipo","Categoria","Pessoa","Forma Pagamento","Observacao" }.
Tipo = "receita" or "despesa". Return ONLY JSON.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { fileBase64, fileName, kind } = await req.json();
    if (!fileBase64) {
      return new Response(JSON.stringify({ error: "No file" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const prompt = PROMPTS[kind] || PROMPTS.sales;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: prompt },
          {
            role: "user",
            content: [
              { type: "text", text: `Extract from: ${fileName}` },
              { type: "image_url", image_url: { url: `data:application/pdf;base64,${fileBase64}` } },
            ],
          },
        ],
      }),
    });

    const aiData = await response.json();
    if (!aiData.choices?.[0]?.message?.content) {
      console.error("AI Error:", aiData);
      throw new Error(aiData.error?.message || "Erro na IA ao processar o PDF.");
    }
    const content = aiData.choices[0].message.content;
    let rows: any[] = [];
    try {
      const match = content.match(/\[[\s\S]*\]/);
      rows = match ? JSON.parse(match[0]) : JSON.parse(content.replace(/```json|```/g, "").trim());
    } catch (e) {
      console.error("Parse error", content);
      throw new Error("Não foi possível interpretar o retorno do PDF.");
    }
    return new Response(JSON.stringify({ rows }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
