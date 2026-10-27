import { cmsMetadata, renderCmsPage } from "@/lib/server/cms-page";

export const generateMetadata = () => cmsMetadata("contact", "Contact Us");

export default function ContactPage() {
  return renderCmsPage("contact");
}
