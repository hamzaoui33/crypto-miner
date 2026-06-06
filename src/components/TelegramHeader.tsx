import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { getTelegramUser, isInsideTelegram } from "@/utils/telegram";

const TelegramHeader = () => {
  const [firstName, setFirstName] = useState("CryptoMiner");
  const [username, setUsername] = useState("@cryptominer_tma");
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!isInsideTelegram()) {
      // Fallback to mock data when running outside Telegram
      return;
    }

    const user = getTelegramUser();
    if (user) {
      setFirstName(user.first_name || "User");
      setUsername(user.username ? `@${user.username}` : "@cryptominer_tma");
      setPhotoUrl(user.photo_url);
    }
  }, []);

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-gray-900/80 backdrop-blur-md border-b border-white/5">
      <div className="flex items-center gap-3">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={firstName}
            className="w-9 h-9 rounded-full object-cover ring-2 ring-amber-500/30"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-sm font-bold text-black ring-2 ring-amber-500/30">
            {firstName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-white leading-tight">
            {firstName}
          </span>
          <span className="text-xs text-gray-400 leading-tight">
            {username}
          </span>
        </div>
      </div>
      <button
        className="p-2 rounded-xl hover:bg-white/5 transition-colors active:scale-95"
        onClick={() => {
          // TODO: Open settings modal
        }}
      >
        <Settings className="w-5 h-5 text-gray-400" />
      </button>
    </div>
  );
};

export default TelegramHeader;
