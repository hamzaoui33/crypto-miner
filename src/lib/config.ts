/**
 * Centralized configuration for Supabase and API endpoints
 * Uses environment variables with fallback defaults for production
 */

// Supabase configuration
export const SUPABASE_URL = 
  import.meta.env.VITE_SUPABASE_URL || 
  "https://bqmadlgevzscpwafuswg.supabase.co";

export const SUPABASE_PUBLISHABLE_KEY = 
  import.meta.env.VITE_SUPABASE_ANON_KEY || 
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxbWFkbGdldnpzY3B3YWZ1c3dnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MTM3MzcsImV4cCI6MjA5NjE4OTczN30.7evRnAIWYqlI0rLe1AHYiW_oYv9qLErrZsYrndS4NA0";

// Edge Functions base URL
export const SUPABASE_FUNCTIONS_URL = 
  import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || 
  `${SUPABASE_URL}/functions/v1`;

// API endpoints for edge functions
export const API_ENDPOINTS = {
  AUTH_TELEGRAM: `${SUPABASE_FUNCTIONS_URL}/auth-telegram`,
  SUBMIT_TAPS: `${SUPABASE_FUNCTIONS_URL}/submit-taps`,
} as const;

// Environment detection
export const isDevelopment = import.meta.env.DEV;
export const isProduction = import.meta.env.PROD;

// Logging helper (disabled in production for sensitive operations)
export const logDebug = (...args: unknown[]) => {
  if (isDevelopment) {
    console.log("[debug]", ...args);
  }
};