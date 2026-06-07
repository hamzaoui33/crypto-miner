import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { getTelegramUser, isInsideTelegram } from "@/utils/telegram";
import { syncUserData, saveUserState, type UserData } from "@/lib/sync";
import { useTapBatching, type TapBatch } from "@/lib/tapBatching";
import { API_ENDPOINTS } from "@/lib/config";
import { authenticateWithTelegram, getStoredAuthToken } from "@/lib/auth";

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

interface Upgrade {
  id: string;
  name: string;
  description: string;
  level: number;
  cost: number;
  costMultiplier: number;
  icon: string;
  color: string;
}

interface GameState {
  coins: number;
  taps: number;
  energy: number;
  maxEnergy: number;
  tapPower: number;
  energyRegenRate: number;
  upgrades: Upgrade[];
  addCoins: (amount: number) => void;
  tap: (x: number, y: number) => void;
  purchaseUpgrade: (id: string) => void;
  useDailyBoost: (id: string) => void;
  dailyBoosts: DailyBoost[];
  floatingTexts: FloatingText[];
  telegramUser: TelegramUser | null;
  isSynced: boolean;
  isLoading: boolean;
}

interface FloatingText {
  id: number;
  x: number;
  y: number;
}

interface DailyBoost {
  id: string;
  name: string;
  description: string;
  remaining: number;
  icon: string;
}

const defaultUpgrades: Upgrade[] = [
  { id: "multitap", name: "Multitap", description: "+1 coin per tap", level: 1, cost: 100, costMultiplier: 1.8, icon: "MousePointerClick", color: "from-amber-500 to-orange-500" },
  { id: "energy_limit", name: "Energy Limit", description: "+500 max energy", level: 1, cost: 200, costMultiplier: 2.0, icon: "Battery", color: "from-blue-500 to-cyan-500" },
  { id: "auto_bot", name: "Auto-Bot", description: "+1 coin/sec passive", level: 0, cost: 500, costMultiplier: 2.5, icon: "Bot", color: "from-violet-500 to-purple-500" },
  { id: "recharge", name: "Recharge Speed", description: "2x energy recovery", level: 0, cost: 300, costMultiplier: 2.0, icon: "Zap", color: "from-rose-500 to-pink-500" },
];

const defaultDailyBoosts: DailyBoost[] = [
  { id: "full_energy", name: "Full Energy", description: "Restore energy to max", remaining: 3, icon: "BatteryCharging" },
  { id: "turbo_tap", name: "Turbo Tap", description: "5x tap power for 1 min", remaining: 1, icon: "Rocket" },
];

const GameStateContext = createContext<GameState | null>(null);

export const GameStateProvider = ({ children }: { children: ReactNode }) => {
  // Telegram user state
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSynced, setIsSynced] = useState(false);
  const [teleUserId, setTeleUserId] = useState<number | null>(null);

  // Game state
  const [coins, setCoins] = useState(0);
  const [taps, setTaps] = useState(0);
  const [energy, setEnergy] = useState(1000);
  const [tapPower, setTapPower] = useState(1);
  const [maxEnergy, setMaxEnergy] = useState(1000);
  const [energyRegenRate, setEnergyRegenRate] = useState(1);
  const [upgrades, setUpgrades] = useState<Upgrade[]>(defaultUpgrades);
  const [dailyBoosts, setDailyBoosts] = useState<DailyBoost[]>(defaultDailyBoosts);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const nextFloatId = useRef(0);

  // Track if initialization has completed to prevent re-initialization
  const hasInitialized = useRef(false);

  // Store the auth token for use in API calls
  const authTokenRef = useRef<string | null>(null);

  // Initialize Telegram user and sync with backend
  useEffect(() => {
    // Prevent multiple initializations
    if (hasInitialized.current) {
      console.log("[init] Already initialized, skipping...");
      return;
    }
    hasInitialized.current = true;

    console.log("[init] ==============================================");
    console.log("[init] Starting initialization sequence...");
    console.log("[init] ==============================================");

    async function initialize() {
      try {
        const isTg = isInsideTelegram();
        console.log("[init-1] isInsideTelegram() result:", isTg);

        if (isTg) {
          const user = getTelegramUser();
          console.log("[init-2] getTelegramUser() result:", user);

          if (user) {
            console.log("[init-3] Telegram user detected:", {
              id: user.id,
              first_name: user.first_name,
              username: user.username,
            });
            
            setTelegramUser(user);
            setTeleUserId(user.id);

            // STEP 1: Authenticate with Telegram to get JWT token
            console.log("[init-4] === STARTING TELEGRAM AUTHENTICATION ===");
            
            // Get initData from Telegram WebApp
            const tw = window as unknown as {
              Telegram?: { 
                WebApp?: { 
                  initData?: string;
                  initDataUnsafe?: { user?: TelegramUser };
                } 
              };
            };
            
            const initData = tw.Telegram?.WebApp?.initData;
            console.log("[init-4a] Raw initData from Telegram:", initData ? "Present (" + initData.length + " chars)" : "Missing");

            if (!initData) {
              console.error("[init-4b] ❌ CRITICAL: No initData available from Telegram WebApp!");
              console.error("[init-4b] Cannot authenticate without initData. Falling back to local mode.");
              setIsSynced(true);
              setIsLoading(false);
              return;
            }

            // Call authenticateWithTelegram and WAIT for response
            console.log("[init-4c] Calling authenticateWithTelegram()...");
            const authResult = await authenticateWithTelegram(initData);
            
            console.log("[init-4d] Authentication result:", authResult);

            if (!authResult.success) {
              console.error("[init-4e] ❌ Authentication FAILED:", authResult.error);
              console.error("[init-4e] Cannot proceed with sync without valid JWT token.");
              console.error("[init-4e] Falling back to local mode (data will not persist).");
              setIsSynced(true);
              setIsLoading(false);
              return;
            }

            console.log("[init-4f] ✅ Authentication SUCCESS!");
            console.log("[init-4g] User ID from auth:", authResult.userId);
            console.log("[init-4h] Username from auth:", authResult.username);

            // Store the auth token for later use
            authTokenRef.current = getStoredAuthToken();
            console.log("[init-4i] Auth token retrieved and stored in ref:", authTokenRef.current ? "Token exists" : "No token");

            // STEP 2: Now sync user data with Supabase (authenticated)
            console.log("[init-5] === STARTING SUPABASE SYNC (AUTHENTICATED) ===");
            const userData = await syncUserData(
              user.id,
              user.username,
              user.first_name
            );

            console.log("[init-6] === SYNC COMPLETE ===");
            console.log("[init-6a] syncUserData returned:", userData);

            if (userData) {
              console.log("[init-7] ✅ Sync successful! Updating game state with server values...");
              
              // Update game state from database
              console.log("[init-7a] Setting coins from", coins, "to", userData.balance);
              setCoins(userData.balance);
              
              console.log("[init-7b] Setting energy from", energy, "to", userData.current_energy);
              setEnergy(userData.current_energy);
              
              console.log("[init-7c] Setting maxEnergy from", maxEnergy, "to", userData.max_energy);
              setMaxEnergy(userData.max_energy);
              
              // Map database upgrade levels to local state
              console.log("[init-7d] Updating upgrade levels from database...");
              setUpgrades(prev => {
                const updated = prev.map(u => {
                  if (u.id === "multitap") {
                    const newLevel = userData.multitap_level || 1;
                    const newCost = Math.floor(100 * Math.pow(1.8, newLevel - 1));
                    console.log(`[init-7d-i] Multitap: level ${u.level} → ${newLevel}, cost ${u.cost} → ${newCost}`);
                    return { ...u, level: newLevel, cost: newCost };
                  }
                  if (u.id === "energy_limit") {
                    const newLevel = userData.energy_limit_level || 1;
                    const newCost = Math.floor(200 * Math.pow(2.0, newLevel - 1));
                    console.log(`[init-7d-ii] Energy Limit: level ${u.level} → ${newLevel}, cost ${u.cost} → ${newCost}`);
                    return { ...u, level: newLevel, cost: newCost };
                  }
                  return u;
                });
                console.log("[init-7d-iii] Updated upgrades array:", updated);
                return updated;
              });

              // Apply upgrade effects
              const newTapPower = userData.multitap_level || 1;
              console.log("[init-7e] Setting tapPower from", tapPower, "to", newTapPower);
              setTapPower(newTapPower);
              
              const newMaxEnergy = 1000 + ((userData.energy_limit_level || 1) - 1) * 500;
              console.log("[init-7f] Recalculating maxEnergy:", newMaxEnergy);
              setMaxEnergy(newMaxEnergy);

              console.log("[init-8] ✅ State update complete. Final state:", {
                coins: userData.balance,
                energy: userData.current_energy,
                maxEnergy: newMaxEnergy,
                tapPower: newTapPower,
                multitap_level: userData.multitap_level,
                energy_limit_level: userData.energy_limit_level,
              });

              setIsSynced(true);
              console.log("[init-9] ✅ Sync complete, isSynced set to true");
            } else {
              console.error("[init-10] ❌ Sync returned null! Using local state only.");
              setIsSynced(true); // Still mark as synced to allow gameplay
            }
          } else {
            console.warn("[init-11] No Telegram user found in getTelegramUser()");
            setIsSynced(true);
          }
        } else {
          console.log("[init-12] Running outside Telegram, using mock data (no auth needed)");
          setIsSynced(true);
        }

        console.log("[init-13] Setting isLoading to false");
        setIsLoading(false);
        console.log("[init-14] ==============================================");
        console.log("[init] === INITIALIZATION COMPLETE ===");
        console.log("[init] ==============================================");
      } catch (error) {
        console.error("[init-ERROR] ❌ FATAL ERROR during initialization:", {
          error,
          message: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        });
        // Still set loading to false to prevent infinite loading
        setIsLoading(false);
        setIsSynced(true);
      }
    }

    initialize();
  }, []);

  // Submit tap batch to backend
  const submitTapBatch = useCallback(async (batch: TapBatch) => {
    if (!teleUserId) {
      console.warn("[batch] No Telegram user ID, skipping batch submit");
      return;
    }

    console.log("[batch] Submitting tap batch:", batch);

    try {
      const response = await fetch(
        API_ENDPOINTS.SUBMIT_TAPS,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": authTokenRef.current ? `Bearer ${authTokenRef.current}` : "",
          },
          body: JSON.stringify({
            clicks: batch.clicks,
            energySpent: batch.energySpent,
          }),
        }
      );

      console.log("[batch] Server response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("[batch] Batch submit failed", {
          status: response.status,
          error: errorData,
        });
        return;
      }

      const result = await response.json();
      console.log("[batch] ✅ Batch submitted successfully:", {
        newBalance: result.newBalance,
        newEnergy: result.newEnergy,
      });

      // Update local state to match server state
      setCoins(result.newBalance);
      setEnergy(result.newEnergy);
    } catch (error) {
      console.error("[batch] Batch submit error", { 
        error,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [teleUserId]);

  // Use tap batching hook
  const { recordTap, flush: flushTaps } = useTapBatching({
    telegramUserId: teleUserId,
    enabled: isSynced && !!teleUserId,
    onBatchSubmit: submitTapBatch,
  });

  // Energy regeneration
  useEffect(() => {
    const interval = setInterval(() => {
      setEnergy((prev) => {
        const newEnergy = Math.min(maxEnergy, prev + energyRegenRate);
        
        // Also save energy periodically to backend
        if (isSynced && teleUserId && Math.random() < 0.1) {
          saveUserState(teleUserId, { current_energy: newEnergy });
        }
        
        return newEnergy;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [maxEnergy, energyRegenRate, isSynced, teleUserId]);

  // Auto-bot passive income
  const autoBotLevel = upgrades.find((u) => u.id === "auto_bot")?.level ?? 0;
  useEffect(() => {
    if (autoBotLevel <= 0) return;
    
    const interval = setInterval(() => {
      setCoins((prev) => {
        const newCoins = prev + autoBotLevel;
        
        // Save passive income to backend periodically
        if (isSynced && teleUserId && Math.random() < 0.2) {
          saveUserState(teleUserId, { balance: newCoins });
        }
        
        return newCoins;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [autoBotLevel, isSynced, teleUserId]);

  // Clean up floating texts
  useEffect(() => {
    if (floatingTexts.length === 0) return;
    const timeout = setTimeout(() => {
      setFloatingTexts((prev) => prev.slice(1));
    }, 900);
    return () => clearTimeout(timeout);
  }, [floatingTexts]);

  // Flush taps on unmount
  useEffect(() => {
    return () => {
      flushTaps();
    };
  }, [flushTaps]);

  const addCoins = useCallback((amount: number) => {
    console.log("[addCoins] Adding", amount, "coins");
    setCoins((prev) => {
      const newCoins = prev + amount;
      // Save to backend immediately for task rewards
      if (isSynced && teleUserId) {
        saveUserState(teleUserId, { balance: newCoins });
      }
      return newCoins;
    });
  }, [isSynced, teleUserId]);

  const tap = useCallback(
    (x: number, y: number) => {
      if (energy <= 0) {
        console.log("[tap] Not enough energy!");
        return;
      }
      
      setCoins((prev) => prev + tapPower);
      setTaps((prev) => prev + 1);
      setEnergy((prev) => Math.max(0, prev - 1));
      
      // Record tap for batching
      recordTap(1);
      
      const id = nextFloatId.current++;
      setFloatingTexts((prev) => [...prev, { id, x, y }]);
    },
    [energy, tapPower, recordTap]
  );

  const purchaseUpgrade = useCallback(
    (id: string) => {
      const upgrade = upgrades.find((u) => u.id === id);
      if (!upgrade || coins < upgrade.cost) {
        console.log("[purchaseUpgrade] Cannot afford upgrade:", { id, coins, cost: upgrade?.cost });
        return;
      }

      console.log("[purchaseUpgrade] Purchasing upgrade:", id);
      setCoins((prev) => prev - upgrade.cost);

      setUpgrades((prev) =>
        prev.map((u) => {
          if (u.id !== id) return u;
          const newLevel = u.level + 1;
          const newCost = Math.floor(u.cost * u.costMultiplier);
          return { ...u, level: newLevel, cost: newCost };
        })
      );

      // Apply upgrade effects
      if (id === "multitap") {
        setTapPower((prev) => {
          const newPower = prev + 1;
          if (isSynced && teleUserId) {
            const currentMultitapLevel = upgrades.find(u => u.id === "multitap")?.level || 1;
            saveUserState(teleUserId, { multitap_level: currentMultitapLevel + 1 });
          }
          return newPower;
        });
      }
      if (id === "energy_limit") {
        setMaxEnergy((prev) => {
          const newMax = prev + 500;
          if (isSynced && teleUserId) {
            const currentLevel = upgrades.find(u => u.id === "energy_limit")?.level || 1;
            saveUserState(teleUserId, { 
              max_energy: newMax,
              energy_limit_level: currentLevel + 1 
            });
          }
          return newMax;
        });
      }
      if (id === "recharge") {
        setEnergyRegenRate((prev) => prev * 2);
      }
    },
    [upgrades, coins, isSynced, teleUserId]
  );

  const useDailyBoost = useCallback(
    (id: string) => {
      const boost = dailyBoosts.find((b) => b.id === id);
      if (!boost || boost.remaining <= 0) return;

      setDailyBoosts((prev) =>
        prev.map((b) => (b.id === id ? { ...b, remaining: b.remaining - 1 } : b))
      );

      if (id === "full_energy") {
        console.log("[useDailyBoost] Activating Full Energy");
        setEnergy(maxEnergy);
      }
      if (id === "turbo_tap") {
        console.log("[useDailyBoost] Activating Turbo Tap");
        const originalTapPower = tapPower;
        setTapPower(originalTapPower * 5);
        setTimeout(() => {
          console.log("[useDailyBoost] Turbo Tap expired");
          setTapPower(originalTapPower);
        }, 60000);
      }
    },
    [dailyBoosts, maxEnergy, tapPower]
  );

  return (
    <GameStateContext.Provider
      value={{
        coins,
        taps,
        energy,
        maxEnergy,
        tapPower,
        energyRegenRate,
        upgrades,
        addCoins,
        tap,
        purchaseUpgrade,
        useDailyBoost,
        dailyBoosts,
        floatingTexts,
        telegramUser,
        isSynced,
        isLoading,
      }}
    >
      {children}
    </GameStateContext.Provider>
  );
};

export const useGameState = () => {
  const ctx = useContext(GameStateContext);
  if (!ctx) throw new Error("useGameState must be used within GameStateProvider");
  return ctx;
};