import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { validateInitData } from "../_shared/telegramAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log("[auth-telegram] === FUNCTION INVOKED ===");
  console.log("[auth-telegram] Request method:", req.method);
  console.log("[auth-telegram] Request headers:", Object.fromEntries(req.headers.entries()));

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log("[auth-telegram] CORS preflight request, returning OK");
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse request body
    console.log("[auth-telegram] Attempting to parse request body...");
    const { initData } = await req.json();
    console.log("[auth-telegram] Parsed body successfully");
    console.log("[auth-telegram] initData present:", !!initData);
    console.log("[auth-telegram] initData length:", initData ? initData.length : 0);
    console.log("[auth-telegram] initData preview:", initData ? initData.substring(0, 100) + "..." : "N/A");

    if (!initData) {
      console.error("[auth-telegram] ❌ FAILURE: Missing initData in request body");
      return new Response("Missing initData", {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Get bot token from environment
    // deno-lint-ignore no-explicit-any
    const botToken = (Deno as any).env.get("TELEGRAM_BOT_TOKEN");
    console.log("[auth-telegram] TELEGRAM_BOT_TOKEN present:", !!botToken);
    console.log("[auth-telegram] TELEGRAM_BOT_TOKEN length:", botToken ? botToken.length : 0);
    
    if (!botToken) {
      console.error("[auth-telegram] ❌ FAILURE: Missing TELEGRAM_BOT_TOKEN environment variable");
      return new Response("Server configuration error", {
        status: 500,
        headers: corsHeaders,
      });
    }

    // Validate Telegram initData
    console.log("[auth-telegram] === STARTING TELEGRAM SIGNATURE VERIFICATION ===");
    let validation: { valid: boolean; userId?: string; username?: string; firstName?: string; authDate?: number };
    
    try {
      validation = validateInitData(initData, botToken);
      
      console.log("[auth-telegram] Validation result:", validation);
      console.log("[auth-telegram] validation.valid:", validation.valid);
      console.log("[auth-telegram] validation.userId:", validation.userId);
      console.log("[auth-telegram] validation.username:", validation.username);
      console.log("[auth-telegram] validation.firstName:", validation.firstName);
      console.log("[auth-telegram] validation.authDate:", validation.authDate);

      if (!validation.valid || !validation.userId) {
        console.error("[auth-telegram] ❌ SIGNATURE VERIFICATION FAILURE");
        console.error("[auth-telegram] Reason: validation.valid =", validation.valid);
        console.error("[auth-telegram] Reason: validation.userId =", validation.userId);
        return new Response("Invalid Telegram authentication", {
          status: 401,
          headers: corsHeaders,
        });
      }

      console.log("[auth-telegram] ✅ SIGNATURE VERIFICATION SUCCESS");
      console.log("[auth-telegram] Validated user ID:", validation.userId);
      console.log("[auth-telegram] Validated username:", validation.username);
    } catch (verifyError) {
      console.error("[auth-telegram] ❌ SIGNATURE VERIFICATION THREW ERROR");
      console.error("[auth-telegram] Error type:", verifyError instanceof Error ? verifyError.constructor.name : "Unknown");
      console.error("[auth-telegram] Error message:", verifyError instanceof Error ? verifyError.message : String(verifyError));
      console.error("[auth-telegram] Error stack:", verifyError instanceof Error ? verifyError.stack : "No stack");
      return new Response("Telegram verification failed", {
        status: 401,
        headers: corsHeaders,
      });
    }

    // Create Supabase client with admin privileges
    console.log("[auth-telegram] === CREATING SUPABASE ADMIN CLIENT ===");
    // deno-lint-ignore no-explicit-any
    const supabaseClient = createClient(
      // deno-lint-ignore no-explicit-any
      (Deno as any).env.get("SUPABASE_URL") ?? "",
      // deno-lint-ignore no-explicit-any
      (Deno as any).env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {}
    );
    console.log("[auth-telegram] Supabase client created");

    // Check if user exists
    console.log("[auth-telegram] === CHECKING IF USER EXISTS ===");
    const { data: existingUser, error: fetchError } = await supabaseClient
      .from("users")
      .select("id")
      .eq("id", Number(validation.userId))
      .single();

    if (fetchError) {
      console.log("[auth-telegram] User fetch error (expected for new users):", fetchError);
    } else {
      console.log("[auth-telegram] Existing user found:", existingUser);
    }

    if (!existingUser) {
      console.log("[auth-telegram] === CREATING NEW USER ===");
      const { data: insertedUser, error: insertError } = await supabaseClient.from("users").insert({
        id: Number(validation.userId),
        username: validation.username || null,
        first_name: validation.firstName || "User",
        balance: 0,
        max_energy: 1000,
        current_energy: 1000,
        multitap_level: 1,
        energy_limit_level: 1,
      }).select().single();

      if (insertError) {
        console.error("[auth-telegram] ❌ FAILURE: Failed to create user");
        console.error("[auth-telegram] Insert error:", insertError);
        return new Response("Failed to create user", {
          status: 500,
          headers: corsHeaders,
        });
      }

      console.log("[auth-telegram] ✅ User created successfully:", insertedUser);
    }

    // Generate a JWT token for Supabase authentication
    console.log("[auth-telegram] === GENERATING JWT TOKEN ===");
    const { data: sessionData, error: sessionError } =
      await supabaseClient.auth.signInAnonymously();

    if (sessionError) {
      console.error("[auth-telegram] ❌ FAILURE: Failed to generate session");
      console.error("[auth-telegram] Session error:", sessionError);
      return new Response("Failed to authenticate", {
        status: 500,
        headers: corsHeaders,
      });
    }

    const token = sessionData.session?.access_token;
    console.log("[auth-telegram] Token generated:", !!token);
    console.log("[auth-telegram] Token length:", token ? token.length : 0);

    if (!token) {
      console.error("[auth-telegram] ❌ FAILURE: No token generated from signInAnonymously");
      return new Response("Failed to generate token", {
        status: 500,
        headers: corsHeaders,
      });
    }

    console.log("[auth-telegram] === AUTHENTICATION SUCCESSFUL ===");
    console.log("[auth-telegram] Returning response with token");

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
    console.error("[auth-telegram] === UNCAUGHT ERROR ===");
    console.error("[auth-telegram] Error type:", error instanceof Error ? error.constructor.name : "Unknown");
    console.error("[auth-telegram] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[auth-telegram] Error stack:", error instanceof Error ? error.stack : "No stack");
    return new Response("Internal server error", {
      status: 500,
      headers: corsHeaders,
    });
  }
});