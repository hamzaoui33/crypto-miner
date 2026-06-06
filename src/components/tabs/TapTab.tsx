import { useState, useCallback, useEffect, useRef } from "react";
import { Pickaxe } from "lucide-react";

interface FloatingText {
  id: number;
  x: number;
  y: number;
}

const TapTab = () => {
  const [coins, setCoins] = useState(0);
  const [taps, setTaps] = useState(0);
  const [energy, setEnergy] = useState(1000);
  const [isPressed, setIsPressed] = useState(false);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const nextId = useRef(0);
  const coinRef = useRef<HTMLButtonElement>(null);

  const maxEnergy = 1000;
  const tapPower = 1;
  const energyCostPerTap = 1;
  const energyRegenRate = 1;
  const energyRegenInterval = 2000;

  // Energy regeneration
  useEffect(() => {
    const interval = setInterval(() => {
      setEnergy((prev) => Math.min(maxEnergy, prev + energyRegenRate));
    }, energyRegenInterval);
    return () => clearInterval(interval);
  }, []);

  // Clean up floating texts after animation
  useEffect(() => {
    if (floatingTexts.length === 0) return;
    const timeout = setTimeout(() => {
      setFloatingTexts((prev) => prev.slice(1));
    }, 900);
    return () => clearTimeout(timeout);
  }, [floatingTexts]);

  const handleTap = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (energy <= 0) return;

      setCoins((prev) => prev + tapPower);
      setTaps((prev) => prev + 1);
      setEnergy((prev) => Math.max(0, prev - energyCostPerTap));

      // Get click position relative to the button
      const rect = coinRef.current?.getBoundingClientRect();
      if (rect) {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const id = nextId.current++;
        setFloatingTexts((prev) => [...prev, { id, x, y }]);
      }

      // Press animation
      setIsPressed(true);
      setTimeout(() => setIsPressed(false), 100);
    },
    [energy, tapPower, energyCostPerTap]
  );

  const energyPercent = (energy / maxEnergy) * 100;

  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-6 px-6 py-8 select-none relative">
      {/* Coin Balance */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-gray-400 text-xs font-medium tracking-widest uppercase">
          Your Coins
        </span>
        <div className="flex items-center gap-2">
          <span className="text-5xl font-bold text-white tabular-nums tracking-tight">
            {coins.toLocaleString()}
          </span>
          <span className="text-2xl">🪙</span>
        </div>
        <span className="text-xs text-gray-500 mt-1">
          {taps.toLocaleString()} total taps
        </span>
      </div>

      {/* Tap Button */}
      <div className="relative">
        <button
          ref={coinRef}
          onClick={handleTap}
          className={`relative w-44 h-44 rounded-full flex items-center justify-center transition-transform duration-100 ease-out
            ${isPressed ? "scale-90" : "scale-100"}
            ${energy <= 0 ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
          `}
          style={{
            background:
              "radial-gradient(circle at 35% 35%, rgba(251,191,36,0.25) 0%, rgba(234,88,12,0.10) 60%, rgba(0,0,0,0) 100%)",
            border: "2px solid rgba(251,191,36,0.30)",
            boxShadow:
              "0 0 50px rgba(251,191,36,0.15), 0 8px 32px rgba(0,0,0,0.6), inset 0 2px 8px rgba(255,255,255,0.06)",
          }}
        >
          <div
            className="absolute inset-2 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 40% 30%, rgba(251,191,36,0.12) 0%, transparent 70%)",
            }}
          />
          <Pickaxe
            className="w-16 h-16 text-amber-400"
            style={{
              filter: "drop-shadow(0 0 14px rgba(251,191,36,0.5))",
            }}
          />

          {/* Floating +1 texts */}
          {floatingTexts.map((ft) => (
            <span
              key={ft.id}
              className="absolute pointer-events-none font-bold text-amber-300 text-xl"
              style={{
                left: ft.x,
                top: ft.y,
                animation: "floatUp 900ms ease-out forwards",
                textShadow: "0 0 10px rgba(251,191,36,0.6)",
              }}
            >
              +{tapPower}
            </span>
          ))}
        </button>
      </div>

      {/* Energy Bar */}
      <div className="w-full max-w-xs flex flex-col items-center gap-2">
        <div className="flex items-center justify-between w-full">
          <span className="text-xs text-gray-400 font-medium">⚡ Energy</span>
          <span className="text-xs text-gray-500 tabular-nums">
            {energy}/{maxEnergy}
          </span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-gray-800 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-200 ease-out"
            style={{
              width: `${energyPercent}%`,
              background:
                energyPercent > 30
                  ? "linear-gradient(90deg, #f59e0b, #f97316)"
                  : "linear-gradient(90deg, #ef4444, #f97316)",
            }}
          />
        </div>
        <span className="text-[10px] text-gray-600">
          Tap power: {tapPower} 🪙/tap
        </span>
      </div>

      {/* Inline keyframes for floating animation */}
      <style>{`
        @keyframes floatUp {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          60% {
            opacity: 0.8;
            transform: translateY(-50px) scale(1.2);
          }
          100% {
            opacity: 0;
            transform: translateY(-90px) scale(0.8);
          }
        }
      `}</style>
    </div>
  );
};

export default TapTab;