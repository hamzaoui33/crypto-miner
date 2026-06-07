import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log("[submit-taps] === FUNCTION INVOKED ===");
  console.log("[submit-taps] Request method:", req.method);
  console.log("[submit-taps] Request headers:", Object.fromEntries(req.headers.entries()));

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log("[submit-taps] CORS preflight request, returning OK");
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Check for Authorization header (Supabase Anon Key)
    const authHeader = req.headers.get("Authorization");
    console.log("[submit-taps] Authorization header present:", !!authHeader);
    
    if (!authHeader) {
      console.error("[submit-taps] ❌ Missing Authorization header");
      return new Response("Unauthorized", {
        status: 401,
        headers: corsHeaders,
      });
    }

    // Check for X-User-Token header (user's JWT from Telegram auth)
    const userToken = req.headers.get("X-User-Token");
    console.log("[submit-taps] X-User-Token header present:", !!userToken);
    console.log("[submit-taps] X-User-Token length:", userToken ? userToken.length : 0);

    if (!userToken) {
      console.error("[submit-taps] ❌ Missing X-User-Token header");
      return new Response("Unauthorized - Missing user token", {
        status: 401,
        headers: corsHeaders,
      });
    }

    // Create Supabase client with service role for admin operations
    console.log("[submit-taps] === CREATING SUPABASE CLIENT ===");
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {}
    );

    // Verify the user's JWT token and get user claims
    console.log("[submit-taps] === VERIFYING USER JWT TOKEN ===");
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(userToken);

    if (authError || !user) {
      console.error("[submit-taps] ❌ Authentication failed", { authError });
      return new Response("Invalid token", {
        status: 401,
        headers: corsHeaders,
      });
    }

    console.log("[submit-taps] ✅ User authenticated:", user.id);

    // Parse request body
    console.log("[submit-taps] === PARSING REQUEST BODY ===");
    const { clicks, energySpent } = await req.json();
    console.log("[submit-taps] Parsed body:", { clicks, energySpent });

    if (!clicks || clicks <= 0) {
      console.error("[submit-taps] ❌ Invalid clicks value");
      return new Response("Invalid clicks value", {
        status: 400,
        headers: corsHeaders,
      });
    }

    const telegramUserId = Number(user.id);
    console.log("[submit-taps] Telegram User ID:", telegramUserId);

    // Get current user data (select all columns to include balance)
    console.log("[submit-taps] === FETCHING USER DATA ===");
    const { data: userData, error: fetchError } = await supabaseClient
      .from("users")
      .select("*")
      .eq("id", telegramUserId)
      .single();

    if (fetchError) {
      console.error("[submit-taps] ❌ Failed to fetch user data", {
        error: fetchError,
      });
      return new Response("User not found", {
        status: 404,
        headers: corsHeaders,
      });
    }

    console.log("[submit-taps] User data retrieved:", {
      balance: userData.balance,
      current_energy: userData.current_energy,
      max_energy: userData.max_energy,
    });

    // Validate energy (allow some tolerance for network delays)
    if (energySpent > userData.current_energy + 10) {
      console.warn("[submit-taps] ⚠️ Insufficient energy", {
        required: energySpent,
        available: userData.current_energy,
      });
      return new Response("Insufficient energy", {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Update user balance and energy
    console.log("[submit-taps] === UPDATING USER DATA ===");
    const newBalance = userData.balance + clicks;
    const newEnergy = Math.max(0, userData.current_energy - energySpent);
    
    console.log("[submit-taps] New balance:", newBalance);
    console.log("[submit-taps] New energy:", newEnergy);

    const { error: updateError } = await supabaseClient
      .from("users")
      .update({
        balance: newBalance,
        current_energy: newEnergy,
        last_energy_sync: new Date().toISOString(),
      })
      .eq("id", telegramUserId);

    if (updateError) {
      console.error("[submit-taps] ❌ Failed to update user data", {
        error: updateError,
      });
      return new Response("Failed to update", {
        status: 500,
        headers: corsHeaders,
      });
    }

    console.log("[submit-taps] ✅ Successfully processed tap batch");
    console.log("[submit-taps] New state:", {
      newBalance,
      newEnergy,
    });

    return new Response(
      JSON.stringify({
        success: true,
        newBalance,
        newEnergy,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[submit-taps] === UNCAUGHT ERROR ===");
    console.error("[submit-taps] Error type:", error instanceof Error ? error.constructor.name : "Unknown");
    console.error("[submit-taps] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[submit-taps] Error stack:", error instanceof Error ? error.stack : "No stack");
    return new Response("Internal server error", {
      status: 500,
      headers: corsHeaders,
    });
  }
});