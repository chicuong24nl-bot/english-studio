import type { PropsWithChildren } from "react";

import { MobileHeader } from "@/components/mobile-header";
import { Sidebar } from "@/components/sidebar";
import { clerkConfigured } from "@/lib/clerk-config";

const MainLayout = ({ children }: PropsWithChildren) => {
  return (
    <>
      <MobileHeader clerkConfigured={clerkConfigured} />
      <Sidebar clerkConfigured={clerkConfigured} className="hidden lg:flex" />
      <main className="h-full pt-[50px] lg:pl-[256px] lg:pt-0">
        <div className="mx-auto h-full max-w-[1056px] pt-6">{children}</div>
      </main>
    </>
  );
};

export default MainLayout;
