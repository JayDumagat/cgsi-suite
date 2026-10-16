import { SidebarProvider, useSidebar } from "@/context/SidebarContext";
import { cn } from "@/utils";
import { Outlet, useLocation } from "react-router";
import AppHeader from "./AppHeader";
import AppSidebar from "./AppSidebar";
import Backdrop from "./Backdrop";

const LayoutContent: React.FC = () => {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const { pathname } = useLocation();
  const showSidebar = pathname.replace(/\/+$/, "") !== "/apps";

  return (
    <div className="min-h-screen xl:flex">
      {showSidebar && <AppSidebar />}
      {showSidebar && <Backdrop />}

      <div
        className={cn(
          "flex-1 transition-[margin] duration-300 ease-in-out",
          showSidebar &&
            (isExpanded || isHovered ? "xl:ms-72.5" : "xl:ms-22.5"),
          isMobileOpen ? "ms-0" : "",
        )}
      >
        <AppHeader showSidebarToggle={showSidebar} />
        <main className="mx-auto max-w-(--breakpoint-2xl) p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

const AppLayout: React.FC = () => {
  return (
    <SidebarProvider>
      <LayoutContent />
    </SidebarProvider>
  );
};

export default AppLayout;
