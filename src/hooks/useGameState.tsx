import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { getTelegramUser, isInsideTelegram } from "@/utils/telegram";

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
  const [coins, setCoins] = useState(0);
  const [taps, setTaps] = useState(0);
  const [energy, setEnergy] = useState(1000);
  const [tapPower, setTapPower] = useState(1);
  const [maxEnergy, setMaxEnergy] = useState(1000);
  const [energyRegenRate, setEnergyRegenRate] = useState(1);
  const [upgrades, setUpgrades] = useState<Upgrade[]>(defaultUpgrades);
  const [dailyBoosts, setDailyBoosts] = useState<DailyBoost[]>(defaultDailyBoosts);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const nextFloatId = useRef(0);

  // Energy regeneration
  useEffect(() => {
    const interval = setInterval(() => {
      setEnergy((prev) => Math.min(maxEnergy, prev + energyRegenRate));
    }, 2000);
    return () => clearInterval(interval);
  }, [maxEnergy, energyRegenRate]);

  // Auto-bot passive income
  const autoBotLevel = upgrades.find((u) => u.id === "auto_bot")?.level ?? 0;
  useEffect(() => {
    if (autoBotLevel <= 0) return;
    const interval = setInterval(() => {
      setCoins((prev) => prev + autoBotLevel);
    }, 1000);
    return () => clearInterval(interval);
  }, [autoBotLevel]);

  // Load Telegram user data on mount
  useEffect(() => {
    if (isInsideTelegram()) {
      const user = getTelegramUser();
      if (user) {
        setTelegramUser(user);
      }
    }
  }, []);

  // Clean up floating texts
  useEffect(() => {
    if (floatingTexts.length === 0) return;
    const timeout = setTimeout(() => {
      setFloatingTexts((prev) => prev.slice(1));
    }, 900);
    return () => clearTimeout(timeout);
  }, [floatingTexts]);

  const addCoins = useCallback((amount: number) => {
    setCoins((prev) => prev + amount);
  }, []);

  const tap = useCallback(
    (x: number, y: number) => {
      if (energy <= 0) return;
      setCoins((prev) => prev + tapPower);
      setTaps((prev) => prev + 1);
      setEnergy((prev) => Math.max(0, prev - 1));
      const id = nextFloatId.current++;
      setFloatingTexts((prev) => [...prev, { id, x, y }]);
    },
    [energy, tapPower]
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
      if (id === "multitap") setTapPower((prev) => prev + 1);
      if (id === "energy_limit") setMaxEnergy((prev) => prev + 500);
      if (id === "recharge") setEnergyRegenRate((prev) => prev * 2);
    },
    [upgrades, coins]
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