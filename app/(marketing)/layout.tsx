import type { PropsWithChildren } from "react";

import { Footer } from "./footer";
import { Header } from "./header";
import { clerkConfigured } from "@/lib/clerk-config";

const MarketingLayout = ({ children }: PropsWithChildren) => {
  return (
    <div className="flex min-h-screen flex-col">
      <Header clerkConfigured={clerkConfigured} />

      <main className="flex flex-1 flex-col items-center justify-center">
        {children}
      </main>

      <Footer />
    </div>
  );
};

export default MarketingLayout;
