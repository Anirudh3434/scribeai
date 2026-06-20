/**
 * proxy-gemini — Supabase Edge Function
 *
 * Proxies Gemini API calls on behalf of the ScribeAI desktop app.
 * The GEMINI_API_KEY secret is stored in the Supabase project dashboard
 * (Settings → Edge Functions → Secrets) — it is NEVER in source code.
 *
 * Deploy:
 *   supabase functions deploy proxy-gemini --no-verify-jwt
 *
 * Set secret:
 *   supabase secrets set GEMINI_API_KEY=your_key_here
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Simple rate limiting: max 30 requests per IP per minute (in-memory, resets on cold start)
const ipRequestCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipRequestCounts.get(ip);

  if (!entry || now > entry.resetAt) {
    ipRequestCounts.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  if (entry.count >= 30) return false;

  entry.count++;
  return true;
}

serve(async (req: Request) => {
  // CORS — allow the Electron app (file:// origin) and local dev
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Rate limit by IP
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!checkRateLimit(clientIp)) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please slow down." }),
      {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Read and validate the request body
  let body: { systemPrompt?: string; initialText?: string; model?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { systemPrompt, initialText, model = "gemini-flash-latest" } = body;

  if (!systemPrompt || !initialText) {
    return new Response(
      JSON.stringify({ error: "systemPrompt and initialText are required" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Fetch the API key from Supabase secrets (set via: supabase secrets set GEMINI_API_KEY=...)
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    console.error("GEMINI_API_KEY secret is not set in Supabase dashboard");
    return new Response(
      JSON.stringify({ error: "Service configuration error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Proxy the request to Gemini
  const geminiUrl = `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`;
  const geminiPayload = {
    contents: [{ parts: [{ text: `Text to rewrite:\n${initialText}` }] }],
    system_instruction: { parts: [{ text: systemPrompt }] },
    generationConfig: { temperature: 0.3 },
  };

  let geminiResponse: Response;
  try {
    geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiPayload),
    });
  } catch (err) {
    console.error("Failed to reach Gemini API:", err);
    return new Response(
      JSON.stringify({ error: "Failed to reach AI service. Try again later." }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  if (!geminiResponse.ok) {
    const errBody = await geminiResponse.json().catch(() => ({}));
    const message =
      (errBody as any)?.error?.message ?? `Gemini HTTP ${geminiResponse.status}`;
    return new Response(JSON.stringify({ error: { message } }), {
      status: geminiResponse.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const geminiData = await geminiResponse.json();
  const text =
    geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;

  if (!text) {
    return new Response(
      JSON.stringify({ error: "Empty response from AI service" }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Return only the text — never expose the raw Gemini response structure
  return new Response(JSON.stringify({ text }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
