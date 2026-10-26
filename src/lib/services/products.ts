import type { Product } from "@/lib/types";
import { repositories } from "./repositories";

export function getProducts(): Promise<Product[]> {
  return repositories.products.list();
}

export function getProductById(id: string): Promise<Product | null> {
  return repositories.products.getById(id);
}
