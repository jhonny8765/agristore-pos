import { expect, type Locator } from "@playwright/test";

/** Exercise either a fixed native choice or an accessible searchable picker. */
export async function selectChoice(control: Locator, choice: string | { label?: string; value?: string }, options?: Parameters<Locator["selectOption"]>[1]) {
  control = control.and(control.page().locator("input:not([type=hidden]),select")).filter({visible:true});
  if (await control.evaluate(node => node.tagName) !== "INPUT") return control.selectOption(choice, options);
  const term = typeof choice === "string" ? choice : choice.label ?? choice.value ?? "";
  await control.fill(term);
  await control.click();
  const popup = control.locator("..").getByRole("option");
  await expect(popup).toHaveCount(1);
  await popup.click();
}
