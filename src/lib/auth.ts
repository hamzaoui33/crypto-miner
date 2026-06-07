import { createClient } from '@supabase/supabase-js';
import { supabase } from "@/integrations/supabase/client";
import { API_ENDPOINTS, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/config";

/**
 * Authenticates a Telegram user by validating their initData
 * and returns a JWT token for subsequent API calls
 */
export async function authenticateWithTelegram(
  initData: string
): Promise<{ success: boolean; error?: string; userId?: string; username?: string }> {
  console.log("[auth] Starting authentication with Telegram initData");
  
  try {
    console.log("[auth] Sending request to edge function:", API_ENDPOINTS.AUTH_TELEGRAM);
    
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

    console.log("[auth] Edge function response status:", response.status);

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
    console.log("[auth] Edge function response payload:", data);

    // Store the JWT token in localStorage for persistence
    if (data.token) {
      localStorage.setItem("sb_auth_token", data.token);
      console.log("[auth] JWT token stored in localStorage");
    }

    return { 
      success: true,
      userId: data.userId,
      username: data.username,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[auth] Authentication error", { 
      error,
      message: errorMessage,
    });
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Gets the stored auth token from localStorage
 */
export function getStoredAuthToken(): string | null {
  const token = localStorage.getItem("sb_auth_token");
  console.log("[auth] Retrieved auth token from localStorage:", token ? "Token exists" : "No token");
  return token;
}

/**
 * Clears the stored auth token
 */
export function clearAuthToken(): void {
  console.log("[auth] Clearing auth token from localStorage");
  localStorage.removeItem("sb_auth_token");
}

/**
 * Creates a Supabase client with the authenticated user's JWT token
 */
export function createAuthenticatedClient(token: string) {
  console.log("[auth] Creating authenticated Supabase client");
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