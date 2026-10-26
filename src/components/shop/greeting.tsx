"use client";

import { useProfile } from "@/lib/hooks/use-session";

/** Friendly one-line greeting; uses the first name when a (demo) profile is signed in. */
export function Greeting() {
  const profile = useProfile();
  const firstName = profile.data?.fullName.split(" ")[0];

  return (
    <p className="min-h-5 text-sm font-medium text-white/85">
      {firstName ? `Hello, ${firstName}` : "Welcome to SuperWalls"}
    </p>
  );
}
