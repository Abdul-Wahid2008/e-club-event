import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

const OG_TITLE = 'The Pitch League — NIT Warangal';
const OG_DESCRIPTION = 'Register solo or as a team (no deadline, no cap) for NIT Warangal\'s live startup pitch arena. Auto-assigned domain & pool, real-time judging, and rival teams grilling you with pressure Q&A.';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: 'The Pitch League | NIT Warangal Startup Competition',
  description: OG_DESCRIPTION,
  icons: {
    icon: '/favicon-64.png',
    apple: '/logo-icon-optimized.png',
  },
  openGraph: {
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: OG_TITLE,
    description: OG_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  return (
    <html lang="en" className={`dark ${inter.variable} ${spaceGrotesk.variable}`}>
      <head>
        {/* PERFORMANCE: every page makes a cross-origin request to the
            Supabase project domain (auth check, portal data, or the
            homepage's live countdown timer) as soon as client JS runs.
            Without a hint, the browser doesn't start that connection's
            DNS/TCP/TLS handshake until JS actually issues the fetch --
            preconnecting here lets the browser open it in parallel with
            the initial HTML/JS download instead of serially after. Field
            data (Vercel Speed Insights) showed real users on this event's
            network experiencing multi-second handshake costs on the FIRST
            connection to a new destination -- this at least overlaps that
            cost with other page-load work instead of adding it on top. */}
        {supabaseUrl && <link rel="preconnect" href={supabaseUrl} crossOrigin="anonymous" />}
        {supabaseUrl && <link rel="dns-prefetch" href={supabaseUrl} />}
      </head>
      <body className="min-h-screen bg-bg-base text-text-primary flex flex-col antialiased">
        <div className="atmosphere" aria-hidden="true">
          <span className="orb orb-1" />
          <span className="orb orb-2" />
          <span className="orb orb-3" />
        </div>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
