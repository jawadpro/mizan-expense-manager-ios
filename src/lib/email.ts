import "server-only";

// Account emails (verify address, reset password), sent through Resend's HTTP API.
// Needs RESEND_API_KEY and EMAIL_FROM (e.g. "Mizan <hello@yourdomain.com>"). Without them, a development
// server prints the link to its console instead, and a production server reports that email isn't set up.

export function emailConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export class EmailNotConfigured extends Error {}

type Mail = { to: string; subject: string; text: string; html: string };

export async function sendMail(m: Mail): Promise<void> {
  if (!emailConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[mizan] email not configured; would send to ${m.to}: ${m.subject}\n${m.text}`);
      return;
    }
    throw new EmailNotConfigured("RESEND_API_KEY and EMAIL_FROM are not set");
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [m.to], subject: m.subject, text: m.text, html: m.html }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Resend responded ${res.status}`);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function linkMail(to: string, subject: string, intro: string, cta: string, url: string, outro: string): Mail {
  return {
    to,
    subject,
    text: `${intro}\n\n${cta}: ${url}\n\n${outro}`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:480px;line-height:1.5;color:#1f2937">
<p>${esc(intro)}</p>
<p><a href="${esc(url)}" style="display:inline-block;background:#0f766e;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">${esc(cta)}</a></p>
<p style="color:#6b7280;font-size:14px">${esc(outro)}</p></div>`,
  };
}

export function verifyEmailMail(to: string, url: string): Mail {
  return linkMail(to, "Confirm your email for Mizan", "Welcome to Mizan! Confirm your email address to finish setting up your account.", "Confirm email", url,
    "This link works for 3 days. If you didn't create a Mizan account, you can ignore this email.");
}

export function resetPasswordMail(to: string, url: string): Mail {
  return linkMail(to, "Reset your Mizan password", "Someone asked to reset the password for your Mizan account.", "Choose a new password", url,
    "This link works for 1 hour and only once. If you didn't ask for this, you can ignore this email and your password stays the same.");
}
