import { cmsMetadata, renderCmsPage } from "@/lib/server/cms-page";

export const generateMetadata = () => cmsMetadata("shipping", "Shipping Policy");

export default function ShippingPage() {
  return renderCmsPage("shipping");
}
