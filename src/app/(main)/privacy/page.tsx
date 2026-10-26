import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-4 px-4 py-5 sm:px-6 md:pt-8">
      <h1 className="text-2xl font-extrabold text-ink">Privacy Policy</h1>
      <p className="rounded-xl bg-brand-yellow-soft px-3 py-2 text-sm text-ink">
        Placeholder page. SuperWalls will replace this with its actual privacy policy before launch.
      </p>
      <h2 className="text-lg font-bold text-ink">What this demo stores</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        This demo storefront keeps your cart, sample orders, saved addresses and demo profile in your
        browser&apos;s local storage on this device. Nothing is sent to a server, and clearing your browser
        data removes it.
      </p>
      <h2 className="text-lg font-bold text-ink">Once the backend is connected</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        The final policy will describe what personal data is collected (such as name, mobile number and
        delivery address), why it is used, how long it is kept, and how to request access or deletion.
      </p>
    </article>
  );
}
