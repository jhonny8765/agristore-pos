import Image from "next/image";

/** Original Better Yield business artwork; provenance lives with the asset. */
export function StoreBrand() {
  return (
    <>
      <Image
        className="store-logo"
        src="/brand/better-yield-logo.jpg"
        alt=""
        width={1242}
        height={1241}
        unoptimized
      />
      <span>
        Better Yield <small>POINT OF SALE</small>
      </span>
    </>
  );
}
