import { useState } from "react";
import { Copy, UserPlus, Users, Gift, CheckCheck } from "lucide-react";
import { triggerHaptic } from "@/utils/haptics";

const inviteLink = "t.me/CryptoMinerBot?start=ref_abc123";

const FriendsTab = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink);
    triggerHaptic("medium");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col flex-1 gap-6 px-4 py-6 overflow-y-auto select-none">
      <div className="flex flex-col items-center gap-1 pt-2">
        <h1 className="text-xl font-bold text-white">Invite Friends</h1>
        <p className="text-xs text-gray-500">Grow your network, earn more</p>
      </div>

      <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/15 flex items-center justify-center mx-auto mb-3">
          <Gift className="w-7 h-7 text-amber-400" />
        </div>
        <h3 className="text-base font-semibold text-white mb-1">
          You both get 5,000 coins!
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed">
          Invite friends to get bonuses! You and your friend both receive{" "}
          <span className="text-amber-400 font-bold">5,000 coins</span> when
          they join.
        </p>
      </div>

      <button
        onClick={handleCopy}
        className={`w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-sm font-bold transition-all active:scale-[0.98] ${
          copied
            ? "bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.3)]"
            : "bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_20px_rgba(251,191,36,0.25)]"
        }`}
        style={{
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {copied ? (
          <>
            <CheckCheck className="w-5 h-5" />
            Link Copied!
          </>
        ) : (
          <>
            <Copy className="w-5 h-5" />
            Copy Invite Link
          </>
        )}
      </button>

      <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-center">
        <p className="text-xs text-gray-500 truncate">{inviteLink}</p>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-500" />
          Your Referrals
        </h2>
        <div className="flex flex-col items-center justify-center py-10 px-4 rounded-2xl bg-white/[0.02] border border-dashed border-white/10">
          <div className="w-16 h-16 rounded-full bg-gray-800/60 flex items-center justify-center mb-3">
            <UserPlus className="w-7 h-7 text-gray-600" />
          </div>
          <p className="text-sm font-medium text-gray-400 mb-1">
            No referrals yet
          </p>
          <p className="text-xs text-gray-600 text-center max-w-[200px]">
            You haven&apos;t invited anyone yet. Share your link to start
            earning!
          </p>
        </div>
      </div>
    </div>
  );
};

export default FriendsTab;