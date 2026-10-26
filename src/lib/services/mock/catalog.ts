import type { Product } from "@/lib/types";

/**
 * DEMO catalog. Names, prices and stock are placeholders, not real SuperWalls
 * products or prices. Replace via the products service once real data exists.
 * Images are local placeholder illustrations in /public/products.
 */
const PLACEHOLDER_DESCRIPTION =
  "Placeholder product for the demo storefront. Real product details, ingredients and usage instructions will appear here once the catalog is provided.";

export const DEMO_PRODUCTS: Product[] = [
  {
    id: "demo-floor-cleaner",
    name: "Demo Floor Cleaner",
    tagline: "Everyday floor care",
    description: PLACEHOLDER_DESCRIPTION,
    pricePaise: 19900,
    compareAtPricePaise: 24900,
    unit: "1 L",
    images: [{ src: "/products/floor-cleaner.svg", alt: "Demo floor cleaner bottle" }],
    stock: 40,
    isDemo: true,
  },
  {
    id: "demo-glass-cleaner",
    name: "Demo Glass Cleaner",
    tagline: "Windows and mirrors",
    description: PLACEHOLDER_DESCRIPTION,
    pricePaise: 14900,
    unit: "500 mL",
    images: [{ src: "/products/glass-cleaner.svg", alt: "Demo glass cleaner spray bottle" }],
    stock: 25,
    isDemo: true,
  },
  {
    id: "demo-bathroom-cleaner",
    name: "Demo Bathroom Cleaner",
    tagline: "Tiles and fittings",
    description: PLACEHOLDER_DESCRIPTION,
    pricePaise: 17900,
    compareAtPricePaise: 21900,
    unit: "750 mL",
    images: [{ src: "/products/bathroom-cleaner.svg", alt: "Demo bathroom cleaner bottle" }],
    stock: 3,
    isDemo: true,
  },
  {
    id: "demo-dishwash-liquid",
    name: "Demo Dishwash Liquid",
    tagline: "Kitchen essentials",
    description: PLACEHOLDER_DESCRIPTION,
    pricePaise: 12900,
    unit: "500 mL",
    images: [{ src: "/products/dishwash-liquid.svg", alt: "Demo dishwash liquid pump bottle" }],
    stock: 60,
    isDemo: true,
  },
  {
    id: "demo-disinfectant-spray",
    name: "Demo Disinfectant Spray",
    tagline: "Quick surface spray",
    description: PLACEHOLDER_DESCRIPTION,
    pricePaise: 24900,
    compareAtPricePaise: 29900,
    unit: "400 mL",
    images: [{ src: "/products/disinfectant-spray.svg", alt: "Demo disinfectant spray can" }],
    stock: 0,
    isDemo: true,
  },
  {
    id: "demo-microfibre-cloths",
    name: "Demo Microfibre Cloth Pack",
    tagline: "Reusable cloths",
    description: PLACEHOLDER_DESCRIPTION,
    pricePaise: 9900,
    unit: "Pack of 3",
    images: [{ src: "/products/microfibre-cloths.svg", alt: "Demo pack of three microfibre cloths" }],
    stock: 80,
    isDemo: true,
  },
];
