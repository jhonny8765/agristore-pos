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
      <body><template id="design-contract" dangerouslySetInnerHTML={{__html:'<!-- pinned-20261103-exact THESIS: Reproduce the supplied POS screenshots. OWN-WORLD: Heavy Roboto sans, warm paper, forest rail and pale green selections. STORY: Find products, save original cash receipts and review stock without losing the record. FIRST VIEWPORT: 256px rail, 72px header, 40px headings, top-aligned register/detail, compact photo cards and ledgers. FORM: User-pinned eight-screen reference; no new concept. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance -->'}}/>{children}</body>
    </html>
  );
}
