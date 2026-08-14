import { listCategories } from "../repositories/index.js";

export function getCategories() {
  return listCategories();
}
