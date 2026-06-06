/**
 * Telegram Web App Init Data validation utilities
 * Follows Telegram's official validation specification:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
 */
import { HmacSHA256, enc } from "https://esm.sh/crypto-js@4.2.0";

/**
 * Parses URL-encoded initData string into key-value pairs
 */
export function parseInitData(initData: string): Map<string, string> {
  const params = new Map<string, string>();
  const pairs = initData.split("&");
  
  for (const pair of pairs) {
    const [key, ...valueParts] = pair.split("=");
    const value = decodeURIComponent(valueParts.join("=") || "");
    
    if (key) {
      params.set(key, value);
    }
  }
  
  return params;
}

/**
 * Validates Telegram Web App Init Data signature
 * Returns validated user data or null if invalid
 */
export function validateInitData(
  initData: string,
  botToken: string
): { valid: boolean; userId?: string; username?: string; firstName?: string; authDate?: number } {
  try {
    const params = parseInitData(initData);
    
    // Extract the hash from initData
    const hash = params.get("hash");
    if (!hash) {
      console.warn("[telegram-auth] Missing hash in initData");
      return { valid: false };
    }
    
    // Remove hash from params for signature computation
    params.delete("hash");
    
    // Sort all parameters alphabetically
    const sortedKeys = Array.from(params.keys()).sort();
    const dataCheckString = sortedKeys
      .map((key) => `${key}=${params.get(key)}`)
      .join("\n");
    
    // Create secret key: HMAC_SHA256(bot_token, "WebAppData")
    const secretKey = HmacSHA256("WebAppData", botToken).toString(enc.Hex);
    
    // Calculate data check hash: HMAC_SHA256(data_check_string, secret_key)
    const computedHash = HmacSHA256(dataCheckString, secretKey).toString(enc.Hex);
    
    // Compare hashes
    const isValid = computedHash === hash;
    
    if (!isValid) {
      console.warn("[telegram-auth] Hash mismatch", {
        expected: computedHash.slice(0, 16) + "...",
        received: hash.slice(0, 16) + "...",
      });
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
        console.error("[telegram-auth] Failed to parse user data", { error: e });
      }
    }
    
    const authDate = params.get("auth_date")
      ? parseInt(params.get("auth_date")!, 10)
      : undefined;
    
    console.log("[telegram-auth] Validation success", { userId, username });
    
    return {
      valid: true,
      userId,
      username,
      firstName,
      authDate,
    };
  } catch (error) {
    console.error("[telegram-auth] Validation error", { error });
    return { valid: false };
  }
}

/**
 * Checks if auth_date is within valid window (prevents replay attacks)
 * Default: 24 hours
 */
export function isAuthDateValid(
  authDate: number,
  maxAgeHours: number = 24
): boolean {
  const now = Math.floor(Date.now() / 1000);
  const maxAgeSeconds = maxAgeHours * 3600;
  return now - authDate <= maxAgeSeconds;
}

/**
 * Extracts and validates Telegram User ID from initData
 * Returns user data or null if validation fails
 */
export function extractTelegramUser(
  initData: string,
  botToken: string
): { userId: string; username?: string; firstName?: string } | null {
  const result = validateInitData(initData, botToken);
  
  if (!result.valid || !result.userId) {
    return null;
  }
  
  // Check auth_date freshness (prevent replay attacks)
  if (result.authDate && !isAuthDateValid(result.authDate)) {
    console.warn("[telegram-auth] Auth date expired", {
      authDate: result.authDate,
      now: Math.floor(Date.now() / 1000),
    });
    return null;
  }
  
  return {
    userId: result.userId,
    username: result.username,
    firstName: result.firstName,
  };
}
