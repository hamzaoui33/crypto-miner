import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { getTelegramUser, isInsideTelegram } from "@/utils/telegram";
import { syncUserData, saveUserState, type UserData } from "@/lib/sync";
import { useTapBatching, type TapBatch } from "@/lib/tapBatching";
import { API_ENDPOINTS } from "@/lib/config";

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

  // Initialize Telegram user and sync with backend
  useEffect(() => {
    async function initialize() {
      if (isInsideTelegram()) {
        const user = getTelegramUser();
        if (user) {
          setTelegramUser(user);
          setTeleUserId(user.id);

          // Sync user data with Supabase
          console.log("[init] Syncing user data with Supabase...");
          const userData = await syncUserData(
            user.id,
            user.username,
            user.first_name
          );

          if (userData) {
            // Update game state from database
            setCoins(userData.balance);
            setEnergy(userData.current_energy);
            setMaxEnergy(userData.max_energy);
            
            // Map database upgrade levels to local state
            setUpgrades(prev => prev.map(u => {
              if (u.id === "multitap") {
                const newLevel = userData.multitap_level || 1;
                const newCost = Math.floor(100 * Math.pow(1.8, newLevel - 1));
                return { ...u, level: newLevel, cost: newCost };
              }
              if (u.id === "energy_limit") {
                const newLevel = userData.energy_limit_level || 1;
                const newCost = Math.floor(200 * Math.pow(2.0, newLevel - 1));
                return { ...u, level: newLevel, cost: newCost };
              }
              return u;
            }));

            // Apply upgrade effects
            setTapPower(userData.multitap_level || 1);
            setMaxEnergy(1000 + ((userData.energy_limit_level || 1) - 1) * 500);

            setIsSynced(true);
            console.log("[init] Sync complete", { userData });
          } else {
            console.warn("[init] Sync failed, using local state");
            setIsSynced(true); // Still mark as synced to allow gameplay
          }
        }
      } else {
        console.log("[init] Running outside Telegram, using mock data");
        setIsSynced(true);
      }

      setIsLoading(false);
    }

    initialize();
  }, []);

  // Submit tap batch to backend
  const submitTapBatch = useCallback(async (batch: TapBatch) => {
    if (!teleUserId) {
      console.warn("[batch] No Telegram user ID, skipping batch submit");
      return;
    }

    try {
      const response = await fetch(
        API_ENDPOINTS.SUBMIT_TAPS,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            clicks: batch.clicks,
            energySpent: batch.energySpent,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("[batch] Batch submit failed", {
          status: response.status,
          error: errorData,
        });
        return;
      }

      const result = await response.json();
      console.log("[batch] Batch submitted successfully", {
        newBalance: result.newBalance,
        newEnergy: result.newEnergy,
      });

      // Update local state to match server state
      setCoins(result.newBalance);
      setEnergy(result.newEnergy);
    } catch (error) {
      console.error("[batch] Batch submit error", { error });
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
        setEnergy((prev) => Math.min(maxEnergy, prev + energyRegenRate));
        
        // Also save energy periodically to backend
        if (isSynced && teleUserId && Math.random() < 0.1) { // 10% chance every 2 seconds
          const newEnergy = Math.min(maxEnergy, energy + energyRegenRate);
          saveUserState(teleUserId, { current_energy: newEnergy });
        }
      }, 2000);
      return () => clearInterval(interval);
    }, [maxEnergy, energyRegenRate, isSynced, teleUserId, energy]);

  // Auto-bot passive income
  const autoBotLevel = upgrades.find((u) => u.id === "auto_bot")?.level ?? 0;
  useEffect(() => {
    if (autoBotLevel <= 0) return;
    
    const interval = setInterval(() => {
      setCoins((prev) => prev + autoBotLevel);
      
      // Save passive income to backend periodically
      if (isSynced && teleUserId && Math.random() < 0.2) { // 20% chance every second
        saveUserState(teleUserId, { balance: coins + autoBotLevel });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [autoBotLevel, isSynced, teleUserId, coins]);

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
    setCoins((prev) => prev + amount);
    
    // Save to backend immediately for task rewards
    if (isSynced && teleUserId) {
      saveUserState(teleUserId, { balance: coins + amount });
    }
  }, [isSynced, teleUserId, coins]);

  const tap = useCallback(
    (x: number, y: number) => {
      if (energy <= 0) return;
      
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
      if (!upgrade || coins < upgrade.cost) return;

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
        setTapPower((prev) => prev + 1);
        // Save to backend
        if (isSynced && teleUserId) {
          saveUserState(teleUserId, { multitap_level: (upgrades.find(u => u.id === "multitap")?.level || 1) + 1 });
        }
      }
      if (id === "energy_limit") {
        setMaxEnergy((prev) => prev + 500);
        // Save to backend
        if (isSynced && teleUserId) {
          saveUserState(teleUserId, { 
            max_energy: maxEnergy + 500,
            energy_limit_level: (upgrades.find(u => u.id === "energy_limit")?.level || 1) + 1 
          });
        }
      }
      if (id === "recharge") setEnergyRegenRate((prev) => prev * 2);
    },
    [upgrades, coins, isSynced, teleUserId, maxEnergy]
  );

  const useDailyBoost = useCallback(
    (id: string) => {
      const boost = dailyBoosts.find((b) => b.id === id);
      if (!boost || boost.remaining <= 0) return;

      setDailyBoosts((prev) =>
        prev.map((b) => (b.id === id ? { ...b, remaining: b.remaining - 1 } : b))
      );

      if (id === "full_energy") setEnergy(maxEnergy);
      if (id === "turbo_tap") {
        const originalTapPower = tapPower;
        setTapPower(originalTapPower * 5);
        setTimeout(() => setTapPower(originalTapPower), 60000);
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