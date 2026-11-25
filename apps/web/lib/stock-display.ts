import Decimal from "decimal.js";
import {money,type Product} from "@agristore/domain";

const ExactQuantity=Decimal.clone({precision:40});

export function stockCost(product:Pick<Product,'costPending'>,cost:number):string{
  return product.costPending?'Cost unconfirmed':`Cost: ${money(cost)}`;
}

/** Sum all lots exactly. Bulk stock is shown in its base measure so a small
 * loose sale cannot disappear through rounding a sack equivalent. */
export function productStock(
  product: Product,
  stock: ReadonlyMap<string, string>,
) {
  const base = [...stock.entries()].reduce(
    (sum, [key, quantity]) =>
      key.startsWith(product.id + ":") ? sum.plus(quantity) : sum,
    new ExactQuantity(0),
  );
  const unit = product.units[0];
  if (product.baseUnit === "kg" || product.baseUnit === "liter" || !unit)
    return { quantity: base.toFixed(), unit: product.baseUnit };
  const count = base.div(unit.factor);
  return count.isInteger()
    ? { quantity: count.toFixed(), unit: unit.name.toLowerCase() }
    : { quantity: base.toFixed(), unit: product.baseUnit };
}
