import { listCategories } from "../../data_access/index.js";

export function getCategories() {
  return listCategories();
}
