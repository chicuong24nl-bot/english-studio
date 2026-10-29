"use client";
import { useState } from "react";

import {
  ClerkLoaded,
  ClerkLoading,
  SignInButton,
  Show,
  UserButton,
} from "@clerk/nextjs";
import { Loader } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import Banner from "@/components/banner";
import { Button } from "@/components/ui/button";
import { links } from "@/config";
import { cn } from "@/lib/utils";

const AccountActions = () => {
  return (
    <>
      <ClerkLoading>
        <Loader className="h-5 w-5 animate-spin text-muted-foreground" />
      </ClerkLoading>
      <ClerkLoaded>
        <Show when="signed-in">
          <UserButton />
        </Show>
        <Show when="signed-out">
          <SignInButton mode="modal">
            <Button size="lg" variant="ghost">Login</Button>
          </SignInButton>
        </Show>
      </ClerkLoaded>
    </>
  );
};

type HeaderProps = {
  clerkConfigured: boolean;
};

export const Header = ({ clerkConfigured }: HeaderProps) => {
  const [hideBanner, setHideBanner] = useState(true);

  return (
    <>
      <Banner hide={hideBanner} setHide={setHideBanner} />

      <header
        className={cn(
          "h-20 w-full border-b-2 border-slate-200 px-4",
          !hideBanner ? "mt-20 sm:mt-16 lg:mt-10" : "mt-0"
        )}
      >
        <div className="mx-auto flex h-full items-center justify-between lg:max-w-screen-lg">
          <Link
            href="/"
            prefetch
            className="flex items-center gap-x-3 pb-7 pl-4 pt-8"
          >
            <h1 className="text-2xl font-extrabold tracking-wide text-green-600">
              Libraria
            </h1>
          </Link>

          <div className="flex gap-x-3">
            {clerkConfigured ? <AccountActions /> : <span className="pt-3 text-sm font-bold text-slate-500">Local preview</span>}
            {clerkConfigured && (
              <Link
                href={links.sourceCode}
                target="_blank"
                rel="noreferrer noopener"
                className="pt-3"
              >
                <Image
                  src="/github.svg"
                  alt="Source Code"
                  height={20}
                  width={20}
                />
              </Link>
            )}
          </div>
        </div>
      </header>
    </>
  );
};
