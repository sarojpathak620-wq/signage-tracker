import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/auth-context';
import { Navbar } from '@/components/layout/Navbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { PWAInstallBanner } from '@/components/layout/PWAInstallBanner';
import { InactivityWatcher } from '@/components/auth/InactivityWatcher';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const viewport: Viewport = {
  themeColor: '#0284c7',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'Signage Tracker',
  description: 'Mobile-friendly portal for tracking outdoor marketing signage of hospital units with live camera inspection and GPS verification.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Signage Tracker',
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased font-sans select-none sm:select-auto">
        <AuthProvider>
          <div className="flex flex-col min-h-screen">
            <Suspense fallback={null}>
              <Navbar />
            </Suspense>
            <Suspense fallback={null}>
              <BottomNav />
            </Suspense>
            <main className="flex-1 pb-24 md:pb-8">
              {children}
            </main>
            <PWAInstallBanner />
            <Suspense fallback={null}>
              <InactivityWatcher />
            </Suspense>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
