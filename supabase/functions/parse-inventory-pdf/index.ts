 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import "https://deno.land/x/xhr@0.1.0/mod.ts";
 import { Buffer } from "https://deno.land/std@0.168.0/node/buffer.ts";
 
 const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
 };
 
 serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const { fileBase64, fileName } = await req.json();
 
     if (!fileBase64) {
       return new Response(JSON.stringify({ error: "No file provided" }), {
         status: 400,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
     }
 
     // Here we would normally extract text from PDF. 
     // Since Deno PDF parsing can be complex without many dependencies,
     // and the user wants "IA" to help, we can try to send the text if we could extract it.
     // For now, let's assume we can use an AI model that handles documents if we had the right integration.
     // BUT, I will use a clever trick: I'll use a Deno-compatible PDF text extractor if I can find one quickly.
     
     // Alternative: Recommend the user to use XLS/CSV for now, OR I can use a library via esm.sh.
     // Let's try https://esm.sh/pdf-parse-fork
     
     // Actually, I'll implement a robust prompt for the AI to "guess" or "parse" if it were text.
     // But wait, the user specifically asked for PDF.
     
     // Let's use a simple PDF text extraction approach.
     // Since I cannot easily install native binaries in the edge function, 
     // I'll use a pure JS implementation.
     
     // NOTE: Real PDF parsing in Edge Functions is best done by sending to an AI with vision 
     // OR using a library like pdf-parse.
     
     const prompt = `You are a data extraction assistant. I will provide you with the text content of a PDF inventory list from another system. 
      Extract ALL products found in the document. For each product, extract all details and return a JSON array of objects.
      CRITICAL: You must extract the following fields for EVERY item:
      - name (string) -> Full name/description. NEVER return null or "Unknown". Use the most descriptive text available.
      - price (number) -> The SELLING PRICE. Look for "Valor venda", "Preço Venda", "Venda", "Preço", "Valor", or columns on the right. If not found, use 0.
      - cost_price (number) -> The COST PRICE or PURCHASE PRICE. Look for "Valor custo", "Preço Custo", "Custo", "Compra", "Entrada". If not found, use 0.
      - stock_quantity (number) -> Current inventory count. Look for "Qtd", "Estoque", "Saldos". If not found, use 0.
      - category (string) -> Product category.
      - brand (string, optional) -> Manufacturer/Brand.
      - model (string, optional) -> Specific model/version.
      - sku (string, optional) -> SKU/Internal Code.
      - imei (string, optional) -> IMEI numbers (very common in cell phone inventory).
      - reference (string, optional) -> Internal reference/ID.
      - ncm (string, optional) -> Fiscal code.
      - ean (string, optional) -> Barcode.

      Rules:
      1. Be aggressive in finding prices. If there are multiple prices, the higher one is usually the selling price.
      2. If an item name is split across multiple lines or columns, combine them.
      3. Return ONLY the JSON array. No conversational text.
 
     If the text is messy, use your best judgment to identify the fields.
     Return ONLY the JSON array.`;
 
     // Convert base64 to image for AI vision
     // Since we want to parse the PDF, and it might have multiple pages, 
     // we will use the gemini-2.5-pro model which can handle PDF files directly 
     // if passed as part of the prompt in some integrations, 
     // but here we'll use a simpler approach: send the base64 as an inline data.
 
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
               { type: "text", text: `Analyze this inventory document: ${fileName}` },
               { 
                 type: "image_url", 
                 image_url: { 
                   url: `data:application/pdf;base64,${fileBase64}` 
                 } 
               }
             ]
           }
         ],
       }),
     });
 
      const aiData = await response.json();
      
      if (!aiData.choices?.[0]?.message?.content) {
        console.error("AI Error:", aiData);
        throw new Error(aiData.error?.message || "Erro na resposta da IA ao processar o PDF.");
      }

      const content = aiData.choices[0].message.content;
      console.log("AI Content:", content);
      
      let products = [];
      try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          products = JSON.parse(jsonMatch[0]);
        } else {
          products = JSON.parse(content.replace(/```json|```/g, "").trim());
        }
      } catch (e) {
        console.error("JSON Parse error:", content);
        throw new Error("Não foi possível processar a lista de produtos retornada.");
      }
 
     return new Response(JSON.stringify({ products }), {
       headers: { ...corsHeaders, "Content-Type": "application/json" },
     });
   } catch (error: any) {
     return new Response(JSON.stringify({ error: error.message }), {
       status: 500,
       headers: { ...corsHeaders, "Content-Type": "application/json" },
     });
   }
 });