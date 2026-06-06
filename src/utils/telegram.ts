export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export function getTelegramUser(): TelegramUser | null {
  try {
    const tw = window as unknown as {
      Telegram?: { WebApp?: { initDataUnsafe?: { user?: TelegramUser } } };
    };
    return tw.Telegram?.WebApp?.initDataUnsafe?.user ?? null;
  } catch {
    return null;
  }
}

export function isInsideTelegram(): boolean {
  try {
    const tw = window as unknown as {
      Telegram?: { WebApp?: unknown };
    };
    return !!tw.Telegram?.WebApp;
  } catch {
    return false;
  }
}
