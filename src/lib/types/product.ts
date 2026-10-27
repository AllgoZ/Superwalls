/** All money values in the app are integer paise (1 INR = 100 paise). */
export type Paise = number;

export interface ProductImage {
  src: string;
  alt: string;
}

export interface Product {
  id: string;
  name: string;
  /** One-line summary used on cards. */
  tagline: string;
  description: string;
  pricePaise: Paise;
  /** Original price before a discount, shown struck through. */
  compareAtPricePaise?: Paise;
  /** Pack size label, e.g. "1 L". */
  unit: string;
  images: ProductImage[];
  /** Units available. 0 means out of stock. */
  stock: number;
  /** True while the catalog is placeholder data. */
  isDemo: boolean;
  /** Highlighted in the homepage "Featured products" section. */
  isFeatured?: boolean;
  /** Category (admin-managed). Null/undefined = uncategorised. */
  categoryId?: string | null;
  /** Optional search-engine title / description set in the admin panel. */
  seoTitle?: string;
  seoDescription?: string;
}

export type StockState = "in_stock" | "low_stock" | "out_of_stock";
