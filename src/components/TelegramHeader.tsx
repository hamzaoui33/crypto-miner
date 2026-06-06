import { Settings } from "lucide-react";

const TelegramHeader = () => {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-gray-900/80 backdrop-blur-md border-b border-white/5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-sm font-bold text-black ring-2 ring-amber-500/30">
          C
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-white leading-tight">CryptoMiner</span>
          <span className="text-xs text-gray-400 leading-tight">@cryptominer_tma</span>
        </div>
      </div>
      <button className="p-2 rounded-xl hover:bg-white/5 transition-colors active:scale-95">
        <Settings className="w-5 h-5 text-gray-400" />
      </button>
    </div>
  );
};

export default TelegramHeader;