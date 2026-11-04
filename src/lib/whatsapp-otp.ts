/** Server-only WhatsApp authentication-template delivery. */

type SendResult = { ok: true } | { ok: false; error: "unconfigured" | "send" };

function digits(phone: string) {
  return phone.replace(/[^\d]/g, "");
}

async function sendCloud(phone: string, code: string): Promise<SendResult | null> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const name = process.env.WHATSAPP_TEMPLATE_NAME;
  if (!token || !phoneId || !name) return null;
  const lang = process.env.WHATSAPP_TEMPLATE_LANG || "en";
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: digits(phone),
      type: "template",
      template: {
        name,
        language: { code: lang },
        components: [
          { type: "body", parameters: [{ type: "text", text: code }] },
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [{ type: "text", text: code }],
          },
        ],
      },
    }),
  });
  return res.ok ? { ok: true } : { ok: false, error: "send" };
}

async function sendTwilio(phone: string, code: string): Promise<SendResult | null> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  const contentSid = process.env.TWILIO_CONTENT_SID;
  if (!sid || !token || !from || !contentSid) return null;
  const sender = from.startsWith("whatsapp:") ? from : `whatsapp:${from}`;
  const body = new URLSearchParams({
    To: `whatsapp:+${digits(phone)}`,
    From: sender,
    ContentSid: contentSid,
    ContentVariables: JSON.stringify({ "1": code }),
  });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });
  return res.ok ? { ok: true } : { ok: false, error: "send" };
}

export async function sendWhatsAppCode(phone: string, code: string): Promise<SendResult> {
  const cloud = await sendCloud(phone, code);
  if (cloud) return cloud;
  const twilio = await sendTwilio(phone, code);
  if (twilio) return twilio;
  return { ok: false, error: "unconfigured" };
}
