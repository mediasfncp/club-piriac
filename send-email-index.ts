import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") || "";
const FROM_EMAIL = "clubdeplage.piriacsurmer@hotmail.com";
const FROM_NAME  = "Eole Beach Club";
const RIB_BASE64 = Deno.env.get("RIB_BASE64") || "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json();
    const { type, to, toName, subject, htmlContent, attachments } = body;

    const allAttachments = [];

    // Pièce jointe PDF (base64 envoyé depuis le client)
    if (attachments?.pdfBase64) {
      allAttachments.push({
        content: attachments.pdfBase64,
        name: attachments.pdfNom || "facture.pdf",
        type: "application/pdf",
      });
    }
    // Fallback HTML si pas de PDF
    else if (attachments?.factureHtml) {
      const encoder = new TextEncoder();
      const bytes = encoder.encode(attachments.factureHtml);
      let binary = "";
      bytes.forEach(b => binary += String.fromCharCode(b));
      allAttachments.push({
        content: btoa(binary),
        name: attachments.factureNom || "facture.html",
        type: "text/html",
      });
    }

    // RIB pour mail de confirmation
    if (type === "confirmation" && RIB_BASE64) {
      allAttachments.push({
        content: RIB_BASE64,
        name: "RIB-Eole-Beach-Club.pdf",
        type: "application/pdf",
      });
    }

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: FROM_NAME, email: FROM_EMAIL },
        to: [{ email: to, name: toName || to }],
        subject,
        htmlContent,
        ...(allAttachments.length > 0 ? { attachment: allAttachments } : {}),
      }),
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Erreur Brevo");

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json", ...CORS },
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }
});
