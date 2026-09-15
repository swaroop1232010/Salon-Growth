import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, name, service, voucherText, referenceId, discountAmount, offerPrice } = body;

    const cleanPhone = (phone || "").replace(/\D/g, "").slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      return NextResponse.json({ success: false, error: "Invalid phone number" }, { status: 400 });
    }

    const recipient = `91${cleanPhone}`;
    let cloudApiResult: Record<string, unknown> | null = null;
    let cloudApiError: string | null = null;

    // ─── 1. Official Meta WhatsApp Cloud API ────────────────────────────────────
    // Phone Number ID & Access Token configured in .env.local
    const phoneNumberId =
      process.env.WHATSAPP_CLOUD_API_PHONE_NUMBER_ID ||
      process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken =
      process.env.WHATSAPP_CLOUD_API_ACCESS_TOKEN ||
      process.env.WHATSAPP_ACCESS_TOKEN;
    const templateName = process.env.WHATSAPP_TEMPLATE_NAME;

    if (phoneNumberId && accessToken) {
      const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

      let payload: Record<string, unknown>;
      if (templateName) {
        // Template message (for business-initiated messages outside 24h window)
        payload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipient,
          type: "template",
          template: {
            name: templateName,
            language: { code: "en" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: name || "Guest" },
                  { type: "text", text: referenceId || "SGS-BOOKING" },
                  { type: "text", text: service || "Salon Service" },
                  { type: "text", text: `₹${discountAmount || 200} OFF` },
                ],
              },
            ],
          },
        };
      } else {
        // Direct text message payload
        payload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipient,
          type: "text",
          text: {
            preview_url: true,
            body: voucherText,
          },
        };
      }

      try {
        const metaRes = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        cloudApiResult = (await metaRes.json()) as Record<string, unknown>;
        if (!metaRes.ok) {
          const errObj = cloudApiResult?.error as { message?: string } | undefined;
          cloudApiError = errObj?.message || "Failed sending via WhatsApp Cloud API";
          console.warn("Meta Cloud API notice:", cloudApiResult);
        }
      } catch (err: unknown) {
        cloudApiError = err instanceof Error ? err.message : "Network error calling Meta API";
        console.warn("Meta Cloud API fetch exception:", err);
      }
    }

    // ─── 2. Optional Webhook Forwarding (Zapier, Pabbly, Make, etc.) ───────────
    const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: recipient,
            name,
            service,
            referenceId,
            message: voucherText,
            timestamp: new Date().toISOString(),
          }),
        });
      } catch (webhookErr) {
        console.warn("WhatsApp webhook dispatch notice:", webhookErr);
      }
    }

    return NextResponse.json({
      success: true,
      phone: cleanPhone,
      recipient,
      cloudApiConfigured: Boolean(phoneNumberId && accessToken),
      cloudApiSent: Boolean(cloudApiResult && !cloudApiError),
      cloudApiResult,
      cloudApiError,
      waLink: `https://wa.me/${recipient}?text=${encodeURIComponent(voucherText || "")}`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
