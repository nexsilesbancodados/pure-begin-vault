import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { extractText, getDocumentProxy } from "npm:unpdf@0.12.1";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROMPTS: Record<string, string> = {
  sales:
    'You convert raw Brazilian sales reports into structured JSON. Read the TEXT below and extract EVERY sale row. Return JSON: {"rows":[{...}]}. Each row keys (use empty string when missing): "Data" (DD/MM/YYYY), "Valor" (number string, dot decimal, no R$), "Cliente", "Produto", "Quantidade", "Forma Pagamento", "IMEI", "SKU", "Marca", "Modelo", "CPF", "Telefone", "Email", "Endereco", "Bairro", "Cidade", "Data Nascimento", "Observacao". Do NOT invent rows. Do NOT include header/totals lines.',
  stock:
    'Extract products from Brazilian inventory TEXT. JSON: {"rows":[{"Produto":"","SKU":"","Categoria":"","Marca":"","Modelo":"","IMEI":"","EAN":"","Preco":"0","Custo":"0","Estoque":"0","Observacao":""}]}.',
  finance:
    'Extract finance entries from Brazilian TEXT. JSON: {"rows":[{"Data":"DD/MM/YYYY","Descricao":"","Valor":"0","Tipo":"receita|despesa","Categoria":"","Pessoa":"","Forma Pagamento":"","Observacao":""}]}.',
};

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pdfToText(bytes: Uint8Array): Promise<{ text: string; pages: number }> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return { text: typeof text === "string" ? text : (text as string[]).join("\n"), pages: pdf.numPages };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const t0 = Date.now();
  try {
    const { fileBase64, fileName, kind } = await req.json();
    if (!fileBase64) {
      return new Response(JSON.stringify({ error: "Arquivo ausente" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bytes = base64ToBytes(fileBase64);
    if (bytes.byteLength > 8 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: `PDF muito grande: ${(bytes.byteLength / 1024 / 1024).toFixed(1)}MB (máx 8MB). Divida o arquivo.` }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1) Extract text natively (fast, free)
    let pdfText = "";
    let pages = 0;
    try {
      const r = await pdfToText(bytes);
      pdfText = r.text || "";
      pages = r.pages;
    } catch (e) {
      console.error("unpdf failed:", e);
    }

    const letters = (pdfText.match(/[a-zA-Z]/g) || []).length;
    const hasGoodText = pdfText.length > 200 && letters > 80;

    let rows: any[] = [];
    let mode: "text" | "vision" = "text";
    let model = "google/gemini-2.5-flash-lite";

    const prompt = PROMPTS[kind] || PROMPTS.sales;

    const callAI = async (body: any) => {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (resp.status === 429) throw new Error("RATE_LIMIT");
      if (resp.status === 402) throw new Error("NO_CREDITS");
      const data = await resp.json();
      if (!data.choices?.[0]?.message?.content) {
        console.error("AI error:", JSON.stringify(data).slice(0, 500));
        throw new Error(data.error?.message || "Falha na IA");
      }
      return data.choices[0].message.content as string;
    };

    const parseContent = (content: string): any[] => {
      try {
        const obj = JSON.parse(content);
        return Array.isArray(obj) ? obj : obj.rows || obj.data || obj.items || [];
      } catch {
        const match = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (match) {
          try {
            const obj = JSON.parse(match[0]);
            return Array.isArray(obj) ? obj : obj.rows || obj.data || [];
          } catch {}
        }
        return [];
      }
    };

    if (hasGoodText) {
      // Truncate to keep token budget reasonable
      const truncated = pdfText.slice(0, 60000);
      const content = await callAI({
        model,
        response_format: { type: "json_object" },
        reasoning: { effort: "none" },
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: `TEXTO DO PDF (${pages} páginas):\n\n${truncated}` },
        ],
      });
      rows = parseContent(content);
    }

    // 2) Fallback: vision on the PDF (scanned / unreadable text)
    if (rows.length === 0) {
      mode = "vision";
      model = "google/gemini-2.5-flash";
      try {
        const content = await callAI({
          model,
          response_format: { type: "json_object" },
          reasoning: { effort: "none" },
          messages: [
            { role: "system", content: prompt + ' Return {"rows":[...]}.' },
            {
              role: "user",
              content: [
                { type: "text", text: "Extraia todas as linhas deste PDF agora." },
                {
                  type: "image_url",
                  image_url: { url: `data:application/pdf;base64,${fileBase64}` },
                },
              ],
            },
          ],
        });
        rows = parseContent(content);
      } catch (e: any) {
        if (e.message === "RATE_LIMIT" || e.message === "NO_CREDITS") throw e;
        console.error("Vision fallback failed:", e);
      }
    }

    const elapsed = Date.now() - t0;
    console.log(
      `parse-import-pdf ${kind} ${fileName} pages=${pages} text=${pdfText.length}ch mode=${mode} -> ${rows.length} rows in ${elapsed}ms`
    );
    return new Response(
      JSON.stringify({ rows, elapsed_ms: elapsed, model, mode, pages, text_length: pdfText.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    const msg = error.message === "RATE_LIMIT"
      ? "Limite de uso atingido. Tente novamente em instantes."
      : error.message === "NO_CREDITS"
      ? "Créditos de IA esgotados. Adicione créditos na workspace."
      : error.message || "Erro ao processar PDF";
    const status = error.message === "RATE_LIMIT" ? 429 : error.message === "NO_CREDITS" ? 402 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
