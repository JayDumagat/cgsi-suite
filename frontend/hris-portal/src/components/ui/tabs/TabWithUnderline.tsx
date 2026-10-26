import { useState } from "react";

interface TabButtonProps {
  id: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
  role?: "tab";
  tabIndex?: number;
  ariaControls?: string;
  className?: string;
}

export const TabButton: React.FC<TabButtonProps> = ({
  id,
  label,
  isActive,
  onClick,
  role,
  tabIndex,
  ariaControls,
  className = "",
}) => {
  return (
    <button
      id={id}
      type="button"
      role={role}
      aria-selected={role === "tab" ? isActive : undefined}
      aria-controls={ariaControls}
      tabIndex={tabIndex}
      className={`inline-flex items-center border-b-2 px-2.5 py-2 text-sm font-medium transition-colors duration-200 ease-in-out ${
        isActive
          ? "border-brand-500 text-brand-500 dark:border-brand-400 dark:text-brand-400"
          : "border-transparent bg-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      } ${className}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
};

interface TabContentProps {
  id: string;
  title: string;
  isActive: boolean;
}

const TabContent: React.FC<TabContentProps> = ({ title, isActive }) => {
  if (!isActive) return null;

  return (
    <div>
      <h3 className="mb-1 text-xl font-medium text-gray-800 dark:text-white/90">
        {title}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {title} ipsum dolor sit amet consectetur. Non vitae facilisis urna
        tortor placerat egestas donec. Faucibus diam gravida enim elit lacus a.
        Tincidunt fermentum condimentum quis et a et tempus. Tristique urna nisi
        nulla elit sit libero scelerisque ante.
      </p>
    </div>
  );
};

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "notification", label: "Notification" },
  { id: "analytics", label: "Analytics" },
  { id: "customers", label: "Customers" },
];

const TabWithUnderline: React.FC = () => {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="rounded-xl border border-gray-200 p-6 dark:border-gray-800">
      <div className="border-b border-gray-200 dark:border-gray-800">
        <nav className="-mb-px flex custom-scrollbar space-x-2 overflow-x-auto">
          {tabs.map((tab) => (
            <TabButton
              key={tab.id}
              id={tab.id}
              label={tab.label}
              isActive={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            />
          ))}
        </nav>
      </div>

      <div className="pt-4 dark:border-gray-800">
        {tabs.map((tab) => (
          <TabContent
            key={tab.id}
            id={tab.id}
            title={tab.label}
            isActive={activeTab === tab.id}
          />
        ))}
      </div>
    </div>
  );
};

export default TabWithUnderline;
