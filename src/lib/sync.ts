import { createClient } from '@supabase/supabase-js';
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/config";

export interface UserData {
  id: number;
  username?: string;
  first_name: string;
  balance: number;
  max_energy: number;
  current_energy: number;
  multitap_level: number;
  energy_limit_level: number;
  last_energy_sync?: string;
  referred_by?: number;
  created_at: string;
}

export interface UserUpgrade {
  id: string;
  level: number;
  cost: number;
}

/**
 * Creates an authenticated Supabase client
 */
function createAuthClient(token: string | null) {
  if (!token) {
    console.warn("[sync] No auth token provided, using anonymous client");
    return supabase;
  }
  
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

/**
 * Syncs user data with Supabase database
 * Returns the loaded user data or null if sync fails
 */
export async function syncUserData(
  telegramUserId: number,
  username: string | undefined,
  firstName: string
): Promise<UserData | null> {
  console.log("[sync] Starting sync for user:", { 
    telegramUserId, 
    username, 
    firstName 
  });

  try {
    // Get auth token from localStorage
    const token = localStorage.getItem("sb_auth_token");
    console.log("[sync] Auth token present:", token ? "Yes" : "No");
    
    const client = createAuthClient(token);

    // First, try to upsert the user (insert or update)
    console.log("[sync] Attempting to upsert user in Supabase...");
    
    const { data: userData, error: upsertError } = await client
      .from("users")
      .upsert(
        {
          id: telegramUserId,
          username: username || null,
          first_name: firstName,
          balance: 0,
          max_energy: 1000,
          current_energy: 1000,
          multitap_level: 1,
          energy_limit_level: 1,
        },
        {
          onConflict: "id",
          ignoreDuplicates: false,
        }
      )
      .select()
      .single();

    if (upsertError) {
      console.error("[sync] Failed to upsert user", { 
        error: upsertError,
        errorDetails: JSON.stringify(upsertError)
      });
      return null;
    }

    console.log("[sync] User upsert successful. Raw userData from Supabase:", userData);

    // Calculate offline energy regeneration
    const now = new Date();
    const lastSync = userData.last_energy_sync
      ? new Date(userData.last_energy_sync)
      : now;
    const timeDiffMs = now.getTime() - lastSync.getTime();
    const timeDiffSeconds = Math.floor(timeDiffMs / 1000);

    // 1 energy per tick (2 seconds by default), adjust based on recharge upgrade
    const energyRegenRate = 1;
    const energyToRegen = Math.floor((timeDiffMs / 2000) * energyRegenRate);
    const regeneratedEnergy = Math.min(
      userData.max_energy,
      userData.current_energy + energyToRegen
    );

    console.log("[sync] Energy regeneration calculation:", {
      lastSync: lastSync.toISOString(),
      now: now.toISOString(),
      timeDiffSeconds,
      energyToRegen,
      originalEnergy: userData.current_energy,
      regeneratedEnergy,
      maxEnergy: userData.max_energy,
    });

    // Update the last_energy_sync time
    console.log("[sync] Updating energy sync timestamp...");
    const { data: updatedData, error: updateError } = await client
      .from("users")
      .update({
        current_energy: regeneratedEnergy,
        last_energy_sync: now.toISOString(),
      })
      .eq("id", telegramUserId)
      .select()
      .single();

    if (updateError) {
      console.error("[sync] Failed to update energy sync", {
        error: updateError,
        errorDetails: JSON.stringify(updateError),
      });
      // Continue anyway with the original data
    } else {
      console.log("[sync] Energy sync updated successfully:", updatedData);
    }

    const finalUserData: UserData = {
      ...userData,
      current_energy: regeneratedEnergy,
      ...(updatedData || {}),
    };

    console.log("[sync] Final UserData to be returned to GameStateProvider:", finalUserData);
    
    return finalUserData;
  } catch (error) {
    console.error("[sync] Sync error", { 
      error,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}

/**
 * Saves user game state to Supabase
 */
export async function saveUserState(
  telegramUserId: number,
  updates: Partial<UserData>
): Promise<boolean> {
  console.log("[save] Saving user state:", { telegramUserId, updates });
  
  try {
    // Get auth token from localStorage
    const token = localStorage.getItem("sb_auth_token");
    const client = createAuthClient(token);
    
    const { error } = await client
      .from("users")
      .update({
        ...updates,
        last_energy_sync: new Date().toISOString(),
      })
      .eq("id", telegramUserId);

    if (error) {
      console.error("[save] Failed to save user state", { 
        error,
        errorDetails: JSON.stringify(error)
      });
      return false;
    }

    console.log("[save] User state saved successfully");
    return true;
  } catch (error) {
    console.error("[save] Save error", { 
      error,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return false;
  }
}

/**
 * Loads user data from Supabase
 */
export async function loadUserData(
  telegramUserId: number
): Promise<UserData | null> {
  console.log("[load] Loading user data for:", telegramUserId);
  
  try {
    // Get auth token from localStorage
    const token = localStorage.getItem("sb_auth_token");
    const client = createAuthClient(token);
    
    const { data, error } = await client
      .from("users")
      .select("*")
      .eq("id", telegramUserId)
      .single();

    if (error) {
      console.error("[load] Failed to load user data", { 
        error,
        errorDetails: JSON.stringify(error)
      });
      return null;
    }

    console.log("[load] Raw data from Supabase:", data);

    // Calculate offline energy regeneration
    const now = new Date();
    const lastSync = data.last_energy_sync
      ? new Date(data.last_energy_sync)
      : now;
    const timeDiffMs = now.getTime() - lastSync.getTime();

    const energyRegenRate = 1;
    const energyToRegen = Math.floor((timeDiffMs / 2000) * energyRegenRate);
    const regeneratedEnergy = Math.min(
      data.max_energy,
      data.current_energy + energyToRegen
    );

    console.log("[load] Energy regeneration:", {
      energyToRegen,
      regeneratedEnergy,
    });

    const result = {
      ...data,
      current_energy: regeneratedEnergy,
    };

    console.log("[load] Final loaded UserData:", result);
    
    return result;
  } catch (error) {
    console.error("[load] Load error", { 
      error,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}