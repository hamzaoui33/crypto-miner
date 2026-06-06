import { Pickaxe, Rocket, CheckCircle, Users } from "lucide-react";

export type TabId = "tap" | "boosts" | "tasks" | "friends";

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "tap", label: "Tap", icon: Pickaxe },
  { id: "boosts", label: "Boosts", icon: Rocket },
  { id: "tasks", label: "Tasks", icon: CheckCircle },
  { id: "friends", label: "Friends", icon: Users },
];

const BottomNav = ({ activeTab, onTabChange }: BottomNavProps) => {
  return (
    <div className="flex items-center justify-around px-2 py-2 bg-gray-950/90 backdrop-blur-md border-t border-white/5">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all duration-200 active:scale-95
              ${isActive
                ? "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                : "text-gray-500 hover:text-gray-300"
              }
            `}
          >
            <Icon className={`w-5 h-5 transition-all duration-200 ${isActive ? "drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]" : ""}`} />
            <span className={`text-[10px] font-medium tracking-wide ${isActive ? "text-amber-400" : ""}`}>
              {tab.label}
            </span>
            {isActive && (
              <div className="w-1 h-1 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default BottomNav;