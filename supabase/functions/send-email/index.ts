import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") || "";
const FROM_EMAIL = "clubdeplage.piriacsurmer@hotmail.com";
const FROM_NAME  = "Eole Beach Club";

// RIB en base64 — à remplacer par votre vrai RIB encodé
// Pour encoder : btoa(String.fromCharCode(...new Uint8Array(fichier)))
const RIB_BASE64 = Deno.env.get("RIB_BASE64") || "";

serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const body = await req.json();
    const { type, to, toName, subject, htmlContent, attachments } = body;

    // Construire les pièces jointes
    const allAttachments = [];

    // Pièce jointe PDF facture si fournie
    if (attachments?.factureHtml) {
      // Encoder le HTML en base64 (Brevo accepte HTML en pièce jointe)
      const encoder = new TextEncoder();
      const bytes = encoder.encode(attachments.factureHtml);
      let binary = "";
      bytes.forEach(b => binary += String.fromCharCode(b));
      const b64 = btoa(binary);
      allAttachments.push({
        content: b64,
        name: attachments.factureNom || "facture.html",
        type: "text/html",
      });
    }

    // RIB en pièce jointe pour mail de confirmation panier
    if (type === "confirmation" && RIB_BASE64) {
      allAttachments.push({
        content: RIB_BASE64,
        name: "RIB-Eole-Beach-Club.pdf",
        type: "application/pdf",
      });
    }

    // Appel API Brevo
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

    if (!response.ok) {
      throw new Error(result.message || "Erreur Brevo");
    }

    return new Response(JSON.stringify({ success: true, messageId: result.messageId }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
