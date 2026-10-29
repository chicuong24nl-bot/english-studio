import type { PropsWithChildren } from "react";

import { Header } from "./header";
import { clerkConfigured } from "@/lib/clerk-config";

const AuthLayout = ({ children }: PropsWithChildren) => {
  return (
    <div className="flex min-h-screen flex-col">
      <Header clerkConfigured={clerkConfigured} />

      <main className="flex flex-1 flex-col items-center justify-center">
        {children}
      </main>
    </div>
  );
};

export default AuthLayout;
