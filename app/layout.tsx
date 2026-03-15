import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { darkModeScript } from '@/design-system/hooks/useDarkMode';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Qalbi - Find Love in the Gulf',
  description: 'The dating app for GCC. Connect with singles in Dubai, Riyadh, Doha, and beyond.',
  keywords: ['dating', 'GCC', 'UAE', 'Dubai', 'Saudi Arabia', 'Qatar', 'singles'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#f43f5e" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>💕</text></svg>" />
        {/* Inline script runs before paint — prevents flash of wrong theme */}
        <script dangerouslySetInnerHTML={{ __html: darkModeScript }} />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
