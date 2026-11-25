"use client";

import { useId, useState, type ReactNode } from "react";
import Decimal from "decimal.js";
import { productSetup, type ProductSetup } from "../lib/product-setup";
import { Button } from "./ui/button";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

const sellingSetups = {
  sack: { label: "Sacks", base: "kg", unit: "Sack", factor: "50" },
  bag: { label: "Bags", base: "kg", unit: "Bag", factor: "" },
  sealed: { label: "Sealed Items/Packs", base: "piece", unit: "Pack", factor: "1" },
  container: { label: "Container", base: "liter", unit: "Container", factor: "" },
  gallon: { label: "Gallon", base: "liter", unit: "Gallon", factor: "" },
  liter: { label: "Liters", base: "liter", unit: "Liter", factor: "1" },
  bottle: { label: "Bottle", base: "liter", unit: "Bottle", factor: "" },
  meter: { label: "Meters", base: "meter", unit: "Meter", factor: "1" },
  weight: { label: "Loose kilos only", base: "kg", unit: "Kilo", factor: "1" },
  custom: { label: "Others", base: "piece", unit: "", factor: "1" },
} as const;
type SetupMode = keyof typeof sellingSetups;
const retailDefaults: Record<string, string> = { kg: "Kilo", liter: "Liter", meter: "Meter", piece: "Piece" };

export function ProductSetupForm({
  disabled,
  onSave,
}: {
  disabled: boolean;
  onSave: (product: ProductSetup) => Promise<Error | undefined>;
}) {
  const [mode, setMode] = useState<SetupMode | "">("");
  const [base, setBase] = useState("kg");
  const [unit, setUnit] = useState("Sack");
  const [factor, setFactor] = useState("50");
  const [loose, setLoose] = useState(false);
  const [retail, setRetail] = useState("Kilo");
  const [prices, setPrices] = useState({
    price: "",
    cost: "",
    basePrice: "",
    baseCost: "",
  });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const errorId = useId();
  const measurement =
    base === "kg" ? "kg" : base === "liter" ? "liter" : base === "meter" ? "meter" : "piece";
  const adjustableBase = mode === "custom" || mode === "bag" || mode === "bottle" || mode === "container";
  const fixedConversion = mode === "weight" || mode === "meter" || mode === "liter";
  let packed = false;
  try {
    const quantity = new Decimal(factor);
    packed = quantity.gt(0) && !quantity.eq(1);
  } catch {}

  function choose(next: SetupMode | "") {
    const setup = next ? sellingSetups[next] : sellingSetups.sack;
    setMode(next);
    setBase(setup.base);
    setUnit(setup.unit);
    setFactor(setup.factor);
    setLoose(false);
    setRetail(retailDefaults[setup.base]);
    setPrices({ price: "", cost: "", basePrice: "", baseCost: "" });
    setError("");
  }
  function priceField(
    key: keyof typeof prices,
    label: string,
    positive = false,
  ) {
    return (
      <Field label={label}>
        <input
          name={key}
          type="number"
          min={positive ? "0.01" : "0"}
          step="0.01"
          required
          value={prices[key]}
          onChange={(e) => setPrices({ ...prices, [key]: e.target.value })}
        />
      </Field>
    );
  }
  return (
    <form
      className="product-setup"
      aria-label="Add a product"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        setSaved("");
        try {
          const product = productSetup(new FormData(form));
          setError("");
          const failure = await onSave(product);
          if (failure) throw failure;
          form.reset();
          choose(mode);
          setSaved(
            `${product.name} added with its configured selling units and prices.`,
          );
        } catch (failure) {
          const message =
            failure instanceof Error
              ? failure.message
              : "Check the selling units and prices.";
          setError(
            /duplicate key/i.test(message) && /sku/i.test(message)
              ? "This SKU already exists. Use a different SKU or update the existing product's price."
              : message,
          );
        }
      }}
    >
      <fieldset className="product-setup-fields form-grid" disabled={disabled}>
        <p className="setup-wide setup-help">Adding a product creates no stock. Record an actual delivery or reviewed opening count separately. Enter zero cost only when the actual cost is confirmed as zero.</p>
        <Field label="Product name">
          <input name="name" required />
        </Field>
        <Field label="SKU / barcode">
          <input name="sku" required />
        </Field>
        <Field label="Category">
          <select name="category">
            {[
              "Feeds",
              "Fertilizers",
              "Seeds",
              "Tools",
              "Soil care",
              "Animal care",
              "Other",
            ].map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </Field>
        <Field label="How customers buy this product">
          <select
            required
            value={mode}
            onChange={(e) => choose(e.target.value as SetupMode | "")}
          >
            <option value="">Choose a selling setup</option>
            {Object.entries(sellingSetups).map(([key, setup]) => (
              <option key={key} value={key}>{setup.label}</option>
            ))}
          </select>
        </Field>
        {mode && (
          <>
            {adjustableBase ? (
              <Field label="Stock measured in">
                <select
                  name="baseUnit"
                  value={base}
                  onChange={(e) => {
                    setBase(e.target.value);
                    setRetail(retailDefaults[e.target.value]);
                    setFactor("");
                    setLoose(false);
                    setPrices({
                      price: "",
                      cost: "",
                      basePrice: "",
                      baseCost: "",
                    });
                  }}
                >
                  <option value="kg">Kilograms</option>
                  <option value="liter">Liters</option>
                  <option value="meter">Meters</option>
                  <option value="piece">Pieces</option>
                </select>
              </Field>
            ) : (
              <input type="hidden" name="baseUnit" value={base} />
            )}
            <Field label="Main selling unit name">
              <input
                name="unit"
                value={unit}
                required
                maxLength={40}
                onChange={(e) => setUnit(e.target.value)}
              />
            </Field>
            {!fixedConversion ? (
              <Field
                label={`Number of ${measurement} in one ${unit || "selling unit"}`}
              >
                <input
                  name="factor"
                  type="number"
                  min={base === "piece" ? "1" : "0.000001"}
                  step={base === "piece" ? "1" : "0.000001"}
                  value={factor}
                  required
                  onChange={(e) => {
                    setFactor(e.target.value);
                    if (Number(e.target.value) === 1) setLoose(false);
                  }}
                />
              </Field>
            ) : (
              <input type="hidden" name="factor" value="1" />
            )}
            {priceField(
              "price",
              `Price per ${unit || "selling unit"} (₱)`,
              true,
            )}
            {priceField("cost", `Cost per ${unit || "selling unit"} (₱)`)}
            {packed && (
              <label className="checkbox setup-wide">
                <input
                  type="checkbox"
                  name="loose"
                  checked={loose}
                  onChange={(e) => setLoose(e.target.checked)}
                />
                Add Retail Price
              </label>
            )}
            {packed && loose && (
              <>
                <Field label="Retail selling unit name">
                  <input name="retailName" required maxLength={40} value={retail} onChange={e => setRetail(e.target.value)}/>
                </Field>
                <p className="setup-help">1 {retail || "retail unit"} = 1 {measurement}.</p>
                {priceField("basePrice", `Price per ${retail || "retail unit"} (₱)`, true)}
                {priceField("baseCost", `Cost per ${retail || "retail unit"} (₱)`)}
              </>
            )}
            <p className="setup-wide setup-summary">
              Stock conversion: 1 {unit || "selling unit"} = {factor || "…"}{" "}
              {measurement}.

            </p>
            <Field label={`Low-stock alert (${measurement})`}>
              <input
                name="minimum"
                type="number"
                min="0"
                step="0.000001"
                defaultValue="0"
              />
            </Field>
            <label className="checkbox">
              <input name="expiry" type="checkbox" />
              Track lots and expiration
            </label>
          </>
        )}
        {error && (
          <p className="quantity-error setup-wide" role="alert" id={errorId}>
            {error}
          </p>
        )}
        <Button className="setup-wide" disabled={!mode}>
          Add product
        </Button>
      </fieldset>
      {saved && (
        <p className="setup-feedback" role="status">
          {saved}
        </p>
      )}
    </form>
  );
}
