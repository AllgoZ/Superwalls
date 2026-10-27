import type { Metadata } from "next";

// Every admin page depends on the signed-in staff member, so navigation blocks on the server by design.
export const instant = false;

export const metadata: Metadata = {
  title: { default: "SuperWalls Admin", template: "%s | SuperWalls Admin" },
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Admin area. It sits inside the root layout (fonts, toaster) but renders none of the storefront chrome:
 * its own shell lives in the (panel) group, and the login page has none at all.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <div className="admin-root min-h-screen">{children}</div>;
}
