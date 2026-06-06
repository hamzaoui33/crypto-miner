import { useState } from "react";
import TelegramHeader from "@/components/TelegramHeader";
import BottomNav, { type TabId } from "@/components/BottomNav";
import TapTab from "@/components/tabs/TapTab";
import BoostsTab from "@/components/tabs/BoostsTab";
import TasksTab from "@/components/tabs/TasksTab";
import FriendsTab from "@/components/tabs/FriendsTab";

const tabComponents: Record<TabId, React.FC> = {
  tap: TapTab,
  boosts: BoostsTab,
  tasks: TasksTab,
  friends: FriendsTab,
};

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabId>("tap");
  const ActiveTabComponent = tabComponents[activeTab];

  return (
    <div className="h-[100dvh] w-full max-w-screen overflow-x-hidden bg-gradient-to-b from-gray-900 to-black text-white flex flex-col select-none">
      <TelegramHeader />
      <div className="flex flex-col flex-1 overflow-hidden">
        <ActiveTabComponent />
      </div>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;