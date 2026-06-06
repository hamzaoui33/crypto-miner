import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { validateInitData } from "../_shared/telegramAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body
    const { initData } = await req.json();

    if (!initData) {
      return new Response("Missing initData", {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Get bot token from environment
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) {
      console.error("[auth-telegram] Missing TELEGRAM_BOT_TOKEN");
      return new Response("Server configuration error", {
        status: 500,
        headers: corsHeaders,
      });
    }

    // Validate Telegram initData
    const validation = validateInitData(initData, botToken);

    if (!validation.valid || !validation.userId) {
      console.warn("[auth-telegram] Invalid initData", {
        valid: validation.valid,
        userId: validation.userId,
      });
      return new Response("Invalid Telegram authentication", {
        status: 401,
        headers: corsHeaders,
      });
    }

    console.log("[auth-telegram] Validation successful", {
      userId: validation.userId,
      username: validation.username,
    });

    // Create Supabase client with admin privileges
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {}
    );

    // Check if user exists
    const { data: existingUser } = await supabaseClient
      .from("users")
      .select("id")
      .eq("id", validation.userId)
      .single();

    if (!existingUser) {
      // Create new user
      const { error: insertError } = await supabaseClient.from("users").insert({
        id: Number(validation.userId),
        username: validation.username || null,
        first_name: validation.firstName || "User",
        balance: 0,
        max_energy: 1000,
        current_energy: 1000,
        multitap_level: 1,
        energy_limit_level: 1,
      });

      if (insertError) {
        console.error("[auth-telegram] Failed to create user", {
          error: insertError,
        });
        return new Response("Failed to create user", {
          status: 500,
          headers: corsHeaders,
        });
      }

      console.log("[auth-telegram] User created", {
        id: validation.userId,
      });
    }

    // Generate a JWT token for Supabase authentication
    // This token will be used for subsequent API calls
    const { data: sessionData, error: sessionError } =
      await supabaseClient.auth.signInAnonymously();

    if (sessionError) {
      console.error("[auth-telegram] Failed to generate session", {
        error: sessionError,
      });
      return new Response("Failed to authenticate", {
        status: 500,
        headers: corsHeaders,
      });
    }

    const token = sessionData.session?.access_token;

    if (!token) {
      console.error("[auth-telegram] No token generated");
      return new Response("Failed to generate token", {
        status: 500,
        headers: corsHeaders,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        token,
        userId: validation.userId,
        username: validation.username,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[auth-telegram] Error processing request", { error });
    return new Response("Internal server error", {
      status: 500,
      headers: corsHeaders,
    });
  }
});