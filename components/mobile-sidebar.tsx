import { Menu } from "lucide-react";

import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

import { Sidebar } from "./sidebar";

type MobileSidebarProps = {
  clerkConfigured: boolean;
};

export const MobileSidebar = ({ clerkConfigured }: MobileSidebarProps) => {
  return (
    <Sheet>
      <SheetTrigger>
        <Menu className="text-white" />
      </SheetTrigger>

      <SheetContent className="z-[100] p-0" side="left">
        <Sidebar clerkConfigured={clerkConfigured} />
      </SheetContent>
    </Sheet>
  );
};
