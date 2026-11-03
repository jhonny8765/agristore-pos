import type { Metadata, Viewport } from "next";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import "@fontsource-variable/roboto";
import "./globals.css";
export const metadata: Metadata = {
  title: "Better Yield POS",
  description: "Cash checkout and inventory for your agricultural stores.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Better Yield POS" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#173e32",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body><template id="design-contract" dangerouslySetInnerHTML={{__html:'<!-- pinned-20261103-updated THESIS: Follow the four updated POS layouts supplied by the owner. OWN-WORLD: Heavy Roboto, warm paper, forest rail and sage selections; retain the real logo. STORY: Find products, enter peso line discounts, choose 30/60/90-day credit and inspect account history using actual records. FIRST VIEWPORT: 256px rail, 64px header, 38px headings; catalog/current-sale columns, chart beside attention, broad customer register and invoice/detail account. FORM: Supplied-comp preservation task; concept generation is inapplicable. Later no-limit and warning-only decisions override obsolete sample controls. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance -->'}}/>{children}</body>
    </html>
  );
}
