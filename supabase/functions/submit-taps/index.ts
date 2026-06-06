import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
    // Manual authentication handling
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response("Unauthorized", {
        status: 401,
        headers: corsHeaders,
      });
    }

    const token = authHeader.replace("Bearer ", "");

    // Create Supabase client with admin privileges
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    // Verify the JWT token and get user claims
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error("[submit-taps] Authentication failed", { authError });
      return new Response("Invalid token", {
        status: 401,
        headers: corsHeaders,
      });
    }

    // Parse request body
    const { clicks, energySpent } = await req.json();

    if (!clicks || clicks <= 0) {
      return new Response("Invalid clicks value", {
        status: 400,
        headers: corsHeaders,
      });
    }

    const telegramUserId = Number(user.id);

    console.log("[submit-taps] Processing tap batch", {
      userId: telegramUserId,
      clicks,
      energySpent,
    });

    // Get current user data
    const { data: userData, error: fetchError } = await supabaseClient
      .from("users")
      .select("current_energy, max_energy")
      .eq("id", telegramUserId)
      .single();

    if (fetchError) {
      console.error("[submit-taps] Failed to fetch user data", {
        error: fetchError,
      });
      return new Response("User not found", {
        status: 404,
        headers: corsHeaders,
      });
    }

    // Validate energy (allow some tolerance for network delays)
    if (energySpent > userData.current_energy + 10) {
      console.warn("[submit-taps] Insufficient energy", {
        required: energySpent,
        available: userData.current_energy,
      });
      return new Response("Insufficient energy", {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Update user balance and energy
    const { error: updateError } = await supabaseClient
      .from("users")
      .update({
        balance: userData.balance + clicks,
        current_energy: Math.max(0, userData.current_energy - energySpent),
        last_energy_sync: new Date().toISOString(),
      })
      .eq("id", telegramUserId);

    if (updateError) {
      console.error("[submit-taps] Failed to update user data", {
        error: updateError,
      });
      return new Response("Failed to update", {
        status: 500,
        headers: corsHeaders,
      });
    }

    console.log("[submit-taps] Successfully processed", {
      newBalance: userData.balance + clicks,
      newEnergy: Math.max(0, userData.current_energy - energySpent),
    });

    return new Response(
      JSON.stringify({
        success: true,
        newBalance: userData.balance + clicks,
        newEnergy: Math.max(0, userData.current_energy - energySpent),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[submit-taps] Error processing request", { error });
    return new Response("Internal server error", {
      status: 500,
      headers: corsHeaders,
    });
  }
});