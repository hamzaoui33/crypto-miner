import { createClient } from '@supabase/supabase-js';
import { supabase } from "@/integrations/supabase/client";
import { API_ENDPOINTS, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/config";

/**
 * Authenticates a Telegram user by validating their initData
 * and returns a JWT token for subsequent API calls
 */
export async function authenticateWithTelegram(
  initData: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      API_ENDPOINTS.AUTH_TELEGRAM,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ initData }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[auth] Authentication failed", {
        status: response.status,
        error: errorData,
      });
      return {
        success: false,
        error: errorData.error || "Authentication failed",
      };
    }

    const data = await response.json();

    // Store the JWT token in localStorage for persistence
    if (data.token) {
      localStorage.setItem("sb_auth_token", data.token);
    }

    return { success: true };
  } catch (error) {
    console.error("[auth] Authentication error", { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Gets the stored auth token from localStorage
 */
export function getStoredAuthToken(): string | null {
  return localStorage.getItem("sb_auth_token");
}

/**
 * Clears the stored auth token
 */
export function clearAuthToken(): void {
  localStorage.removeItem("sb_auth_token");
}

/**
 * Creates a Supabase client with the authenticated user's JWT token
 */
export function createAuthenticatedClient(token: string) {
  return createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );
}