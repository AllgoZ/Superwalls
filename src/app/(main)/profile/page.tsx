import type { Metadata } from "next";
import { ProfileView } from "@/components/profile/profile-view";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6 md:pt-8">
      <h1 className="mb-5 text-2xl font-extrabold text-ink">Profile</h1>
      <ProfileView />
    </div>
  );
}
