import type { ProductsRepository } from "../contracts";
import { DEMO_PRODUCTS } from "./catalog";

export const mockProducts: ProductsRepository = {
  async list() {
    return DEMO_PRODUCTS;
  },
  async getById(id) {
    return DEMO_PRODUCTS.find((product) => product.id === id) ?? null;
  },
};
