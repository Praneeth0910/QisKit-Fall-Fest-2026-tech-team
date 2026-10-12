import type { Metadata, Viewport } from 'next';
import { ThemeProvider } from '@/components/shared/ThemeProvider';
import { Navbar } from '@/components/shared/Navbar';
import { LoadScreen } from '@/components/shared/LoadScreen';
import { SmoothScrollProvider } from '@/components/shared/SmoothScrollProvider';
import { JsonLd } from '@/components/shared/JsonLd';
import {
  SITE_CONFIG,
  generateWebSiteSchema,
  generateOrganizationSchema,
  generateEventSeriesSchema,
} from '@/config/seo';
import { OAuthRedirectHandler } from '@/components/shared/OAuthRedirectHandler';
import { DeadlineToast } from '@/components/shared/DeadlineToast';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { AnalyticsProvider } from '@/components/shared/AnalyticsProvider';
import './globals.css'; // Global styles

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F5F3F0' },
    { media: '(prefers-color-scheme: dark)', color: '#3A0B10' },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_CONFIG.primaryDomain),
  title: {
    default: `${SITE_CONFIG.brandName} | SRM University-AP - A Decade of Quantum on Cloud`,
    template: `%s | ${SITE_CONFIG.brandName}`,
  },
  description: SITE_CONFIG.description,
  keywords: [
    'Qiskit Fall Fest SRMAP 2026',
    'Qiskit Fall Fest 2026',
    'QFF SRMAP 2026',
    'SRM University-AP Quantum Computing',
    'IBM Quantum',
    'Quantum Hackathon India',
    'Qiskit 1.0 Masterclass',
    'Amaravati Quantum Summit',
    'Decade of Quantum on Cloud',
  ],
  authors: [{ name: SITE_CONFIG.brandName, url: SITE_CONFIG.primaryDomain }],
  creator: 'SRM University-AP & IBM Quantum',
  publisher: 'SRM University-AP',
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-48.png', sizes: '48x48', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/manifest.json',
  openGraph: {
    title: `${SITE_CONFIG.brandName} | SRM University-AP`,
    description: SITE_CONFIG.description,
    url: SITE_CONFIG.primaryDomain,
    siteName: SITE_CONFIG.brandName,
    locale: SITE_CONFIG.locale,
    type: 'website',
    images: [
      {
        url: `${SITE_CONFIG.primaryDomain}/og-image.webp`,
        width: 1200,
        height: 630,
        alt: `${SITE_CONFIG.brandName} - SRM University-AP x IBM Quantum`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: SITE_CONFIG.social.twitterHandle,
    creator: SITE_CONFIG.social.twitterCreator,
    title: `${SITE_CONFIG.brandName} | SRM University-AP`,
    description: SITE_CONFIG.description,
    images: [`${SITE_CONFIG.primaryDomain}/og-image.webp`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'ImpHmHcChqS0XzVkf0aleBq0z7bdm9VO274Mj3mMQGY',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <JsonLd id="schema-website" schema={generateWebSiteSchema()} />
        <JsonLd id="schema-organization" schema={generateOrganizationSchema()} />
        <JsonLd id="schema-event-series" schema={generateEventSeriesSchema()} />
      </head>
      <body className="antialiased selection:bg-burgundy selection:text-ivory" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <SmoothScrollProvider>
            <AnalyticsProvider />
            <OAuthRedirectHandler />
            <LoadScreen />
            <DeadlineToast />
            <Navbar />
            {children}
            <Analytics />
            <SpeedInsights />
          </SmoothScrollProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
