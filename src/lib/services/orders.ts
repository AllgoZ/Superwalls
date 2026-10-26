import type { CreateOrderInput, Order } from "@/lib/types";
import { repositories } from "./repositories";

export function getOrders(): Promise<Order[]> {
  return repositories.orders.list();
}

export function getOrderById(id: string): Promise<Order | null> {
  return repositories.orders.getById(id);
}

export function createOrder(input: CreateOrderInput): Promise<Order> {
  return repositories.orders.create(input);
}
