import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pitch Under Pressure | NIT Warangal Startup Competition',
  description: 'Live pitch scoring, audience pressure-testing, and real-time event portal for NIT Warangal.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-gray-100 flex flex-col antialiased">
        {children}
      </body>
    </html>
  );
}
