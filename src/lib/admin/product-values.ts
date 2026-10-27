import { paiseToRupeesInput } from "./money";

export interface ImageItem {
  src: string;
  alt: string;
}

export interface ProductFormValues {
  id?: string;
  name: string;
  sku: string;
  tagline: string;
  description: string;
  unit: string;
  categoryId: string | null;
  price: string;
  compareAt: string;
  images: ImageItem[];
  lowStockThreshold: string;
  isActive: boolean;
  isFeatured: boolean;
  seoTitle: string;
  seoDescription: string;
  stock?: number;
  reserved?: number;
}

export const EMPTY_PRODUCT: ProductFormValues = {
  name: "",
  sku: "",
  tagline: "",
  description: "",
  unit: "",
  categoryId: null,
  price: "",
  compareAt: "",
  images: [],
  lowStockThreshold: "5",
  isActive: false,
  isFeatured: false,
  seoTitle: "",
  seoDescription: "",
};

export function valuesFromDetail(product: {
  id: string;
  name: string;
  sku: string | null;
  tagline: string;
  description: string;
  unit: string;
  categoryId: string | null;
  pricePaise: number;
  compareAtPricePaise: number | null;
  images: ImageItem[];
  lowStockThreshold: number;
  status: string;
  isFeatured: boolean;
  seoTitle: string;
  seoDescription: string;
  stock: number;
  reserved: number;
}): ProductFormValues {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku ?? "",
    tagline: product.tagline,
    description: product.description,
    unit: product.unit,
    categoryId: product.categoryId,
    price: paiseToRupeesInput(product.pricePaise),
    compareAt: product.compareAtPricePaise ? paiseToRupeesInput(product.compareAtPricePaise) : "",
    images: product.images,
    lowStockThreshold: String(product.lowStockThreshold),
    isActive: product.status === "published",
    isFeatured: product.isFeatured,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    stock: product.stock,
    reserved: product.reserved,
  };
}

