import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Co Jest Grane? - Zgadnij piosenkę po fragmencie! Darmowa gra muzyczna online",
  description: "Zagraj w Co Jest Grane - darmową grę muzyczną online! Rozpoznaj piosenkę po krótkim fragmencie. Polskie i zagraniczne hity, bajki, gry. 4 tryby: klasyczny, piano, beat, od tyłu. Ranking graczy, osiągnięcia i codzienne wyzwania. Sprawdź się!",
  keywords: "co jest grane, zgadnij piosenkę, gra muzyczna, heardle po polsku, polskie piosenki, quiz muzyczny, zgadywanie piosenek, rozpoznaj piosenkę, gra online za darmo, muzyczny quiz, heardle polska, zagadki muzyczne, odgadnij piosenkę, gra z piosenkami, muzyka quiz, darmowa gra przeglądarkowa",
  authors: [{ name: "Jogis", url: "https://www.youtube.com/@Jogiss" }],
  robots: "index, follow",
  alternates: {
    canonical: "https://co-jest-grane.pl",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon.png", type: "image/png" },
    ],
    apple: "/icon.png",
  },
  manifest: "/manifest.json",
  applicationName: "Co Jest Grane?",
  openGraph: {
    type: "website",
    url: "https://co-jest-grane.pl",
    title: "Co Jest Grane? 🎵 Zgadnij piosenkę po fragmencie!",
    description: "Rozpoznasz piosenkę po krótkim fragmencie? 🎧 Zagraj za darmo! Polskie hity, zagraniczne, bajki i gry. 4 tryby, ranking i codzienne wyzwania!",
    siteName: "Co Jest Grane?",
    locale: "pl_PL",
  },
  twitter: {
    card: "summary",
    title: "Co Jest Grane? 🎵 Zgadnij piosenkę po fragmencie!",
    description: "Rozpoznasz piosenkę po krótkim fragmencie? 🎧 Zagraj za darmo! Polskie hity, zagraniczne, bajki i gry. 4 tryby, ranking i codzienne wyzwania!",
  },
  other: {
    "apple-mobile-web-app-title": "Co Jest Grane",
    "msapplication-TileColor": "#4f46e5",
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Co Jest Grane?",
  alternateName: "Co Jest Grane",
  url: "https://co-jest-grane.pl",
};

const appSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Co Jest Grane?",
  url: "https://co-jest-grane.pl",
  description:
    "Darmowa gra muzyczna online - zgadnij piosenkę po krótkim fragmencie! Polskie i zagraniczne hity, bajki, gry. 4 tryby gry, ranking graczy i codzienne wyzwania.",
  applicationCategory: "GameApplication",
  genre: "Music",
  inLanguage: "pl-PL",
  operatingSystem: "All",
  browserRequirements: "Requires JavaScript. Requires HTML5 Audio.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "PLN",
  },
  author: {
    "@type": "Person",
    name: "Jogis",
    url: "https://www.youtube.com/@Jogiss",
  },
  potentialAction: {
    "@type": "PlayAction",
    target: "https://co-jest-grane.pl",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <head>
        {/* Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />

        {/* Schema.org structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }}
        />
      </head>
      <body className="bg-slate-950 text-slate-100 antialiased">
        {children}

        {/* Google Analytics */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-0P816BXZDE"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-0P816BXZDE');
          `}
        </Script>
      </body>
    </html>
  );
}
