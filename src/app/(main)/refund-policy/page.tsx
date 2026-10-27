import { cmsMetadata, renderCmsPage } from "@/lib/server/cms-page";

export const generateMetadata = () => cmsMetadata("refund", "Refund and Cancellation Policy");

export default function RefundPolicyPage() {
  return renderCmsPage("refund");
}
