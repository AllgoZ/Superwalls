import { cmsMetadata, renderCmsPage } from "@/lib/server/cms-page";

export const generateMetadata = () => cmsMetadata("about", "About Us");

export default function AboutPage() {
  return renderCmsPage("about");
}
