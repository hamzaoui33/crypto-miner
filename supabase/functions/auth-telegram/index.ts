import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Hardcoded bot token for testing
const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');

if (!botToken) {
  console.error("[auth-telegram] ❌ FAILURE: TELEGRAM_BOT_TOKEN is missing in Deno.env!");
  return new Response("Bot token not configured", { status: 500 });
}

console.log("[auth-telegram] Successfully loaded bot token (length:", botToken.length, ")");

/**
 * Validates Telegram Web App initData using the official method
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
 */
async function validateTelegramInitData(
  initData: string,
  botToken: string
): Promise<{ valid: boolean; userId?: string; username?: string; firstName?: string; authDate?: number }> {
  try {
    console.log("[telegram-validate] Starting validation with initData length:", initData.length);

    // Parse the initData string into key-value pairs
    const params = new URLSearchParams(initData);
    const receivedHash = params.get("hash");

    if (!receivedHash) {
      console.error("[telegram-validate] Missing hash parameter");
      return { valid: false };
    }

    // Remove hash from params for signature computation
    params.delete("hash");

    // Sort all parameters alphabetically by key
    const sortedKeys = Array.from(params.keys()).sort();
    
    // Create data-check-string by joining key=value pairs with newline
    const dataCheckString = sortedKeys
      .map((key) => `${key}=${params.get(key)}`)
      .join("\n");

    console.log("[telegram-validate] Data check string:", dataCheckString.replace(/\n/g, "\\n"));

    // Step 1: Create secret key = HMAC-SHA256("WebAppData", bot_token)
    const encoder = new TextEncoder();
    const botTokenKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode(botToken),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const secretKeyBuffer = await crypto.subtle.sign(
      "HMAC",
      botTokenKey,
      encoder.encode("WebAppData")
    );

    // Step 2: Import the secret key for signing
    const secretKey = await crypto.subtle.importKey(
      "raw",
      secretKeyBuffer,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    // Step 3: Calculate data-check-hash = HMAC-SHA256(data_check_string, secret_key)
    const computedHashBuffer = await crypto.subtle.sign(
      "HMAC",
      secretKey,
      encoder.encode(dataCheckString)
    );

    // Convert to hex string
    const computedHash = Array.from(new Uint8Array(computedHashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    console.log("[telegram-validate] Computed hash:", computedHash);
    console.log("[telegram-validate] Received hash:", receivedHash);

    // Compare hashes
    const isValid = computedHash === receivedHash;

    if (!isValid) {
      console.error("[telegram-validate] Hash mismatch!");
      return { valid: false };
    }

    // Extract user data
    const userDataStr = params.get("user");
    let userId: string | undefined;
    let username: string | undefined;
    let firstName: string | undefined;

    if (userDataStr) {
      try {
        const userData = JSON.parse(userDataStr);
        userId = String(userData.id);
        username = userData.username;
        firstName = userData.first_name;
      } catch (e) {
        console.error("[telegram-validate] Failed to parse user data", { error: e });
      }
    }

    const authDate = params.get("auth_date")
      ? parseInt(params.get("auth_date")!, 10)
      : undefined;

    console.log("[telegram-validate] ✅ Validation successful", { userId, username });

    return {
      valid: true,
      userId,
      username,
      firstName,
      authDate,
    };
  } catch (error) {
    console.error("[telegram-validate] Validation error", { error });
    return { valid: false };
  }
}

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

    // Use hardcoded bot token for testing
    const botToken = BOT_TOKEN;
    console.log("[auth-telegram] Using hardcoded bot token (length:", botToken.length, ")");
    
    if (!botToken || BOT_TOKEN === "YOUR_BOT_TOKEN_HERE") {
      console.error("[auth-telegram] ❌ FAILURE: Bot token not configured. Please replace BOT_TOKEN constant.");
      return new Response("Server configuration error", {
        status: 500,
        headers: corsHeaders,
      });
    }

    // Validate Telegram initData using official method
    console.log("[auth-telegram] === STARTING TELEGRAM SIGNATURE VERIFICATION (OFFICIAL METHOD) ===");
    
    const validation = await validateTelegramInitData(initData, botToken);
    
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

    // Create Supabase client with admin privileges
    console.log("[auth-telegram] === CREATING SUPABASE ADMIN CLIENT ===");
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