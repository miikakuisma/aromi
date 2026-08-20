import { createSerwistRoute } from "@serwist/turbopack";

// Vercel asettaa commitin tunnisteen, joten offline-sivu esisäilötään
// uudelleen jokaisella julkaisulla. Paikallisesti riittää kiinteä arvo.
const revision = process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    additionalPrecacheEntries: [{ url: "/~offline", revision }],
    swSrc: "app/sw.ts",
    useNativeEsbuild: true,
  });
