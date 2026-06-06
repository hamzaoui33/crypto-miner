import { supabase } from "@/integrations/supabase/client";

export interface UserData {
  id: number;
  username?: string;
  first_name: string;
  balance: number;
  max_energy: number;
  current_energy: number;
  multitap_level: number;
  energy_limit_level: number;
  referred_by?: number;
  created_at: string;
}

export interface UserUpgrade {
  id: string;
  level: number;
  cost: number;
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
  try {
    // First, try to upsert the user (insert or update)
    const { data: userData, error: upsertError } = await supabase
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
      console.error("[sync] Failed to upsert user", { error: upsertError });
      return null;
    }

    console.log("[sync] User data synced successfully", { userData });

    // Calculate offline energy regeneration
    const now = new Date();
    const lastSync = userData.last_energy_sync
      ? new Date(userData.last_energy_sync)
      : now;
    const timeDiffMs = now.getTime() - lastSync.getTime();

    // 1 energy per tick (2 seconds by default), adjust based on recharge upgrade
    const energyRegenRate = 1; // This will be updated when recharge upgrade is implemented
    const energyToRegen = Math.floor((timeDiffMs / 2000) * energyRegenRate);
    const regeneratedEnergy = Math.min(
      userData.max_energy,
      userData.current_energy + energyToRegen
    );

    // Update the last_energy_sync time
    const { error: updateError } = await supabase
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
      });
      // Continue anyway with the original data
    }

    return {
      ...userData,
      current_energy: regeneratedEnergy,
    };
  } catch (error) {
    console.error("[sync] Sync error", { error });
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
  try {
    const { error } = await supabase
      .from("users")
      .update({
        ...updates,
        last_energy_sync: new Date().toISOString(),
      })
      .eq("id", telegramUserId);

    if (error) {
      console.error("[save] Failed to save user state", { error });
      return false;
    }

    console.log("[save] User state saved successfully");
    return true;
  } catch (error) {
    console.error("[save] Save error", { error });
    return false;
  }
}

/**
 * Loads user data from Supabase
 */
export async function loadUserData(
  telegramUserId: number
): Promise<UserData | null> {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", telegramUserId)
      .single();

    if (error) {
      console.error("[load] Failed to load user data", { error });
      return null;
    }

    // Calculate offline energy regeneration
    const now = new Date();
    const lastSync = data.last_energy_sync
      ? new Date(data.last_energy_sync)
      : now;
    const timeDiffMs = now.getTime() - lastSync.getTime();

    const energyRegenRate = 1; // Adjust based on recharge upgrade
    const energyToRegen = Math.floor((timeDiffMs / 2000) * energyRegenRate);
    const regeneratedEnergy = Math.min(
      data.max_energy,
      data.current_energy + energyToRegen
    );

    // Update energy in local state
    return {
      ...data,
      current_energy: regeneratedEnergy,
    };
  } catch (error) {
    console.error("[load] Load error", { error });
    return null;
  }
}