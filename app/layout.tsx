import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const title = "Escena IA | Clasificador de escenas naturales";
const description =
  "Clasifica fotografías de edificios, bosques, glaciares, montañas, mar y calles con un modelo EfficientNetV2B0 de 94.63% de exactitud.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const socialImage = `${origin}/og.png`;

  return {
    title,
    description,
    applicationName: "Escena IA",
    openGraph: {
      title,
      description,
      type: "website",
      locale: "es_PE",
      url: origin,
      siteName: "Escena IA",
      images: [
        {
          url: socialImage,
          width: 1729,
          height: 910,
          alt: "Escena IA, clasificación inteligente de escenas naturales",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialImage],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <script src="/vendor/tf.min.js" defer />
      </head>
      <body>{children}</body>
    </html>
  );
}
