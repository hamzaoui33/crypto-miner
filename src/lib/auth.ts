import { createClient } from '@supabase/supabase-js';
import { supabase } from "@/integrations/supabase/client";

/**
 * Authenticates a Telegram user by validating their initData
 * and returns a JWT token for subsequent API calls
 */
export async function authenticateWithTelegram(
  initData: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      "https://bqmadlgevzscpwafuswg.supabase.co/functions/v1/auth-telegram",
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
    "https://bqmadlgevzscpwafuswg.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxbWFkbGdldnpzY3B3YWZ1c3dnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MTM3MzcsImV4cCI6MjA5NjE4OTczN30.7evRnAIWYqlI0rLe1AHYiW_oYv9qLErrZsYrndS4NA0",
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );
}