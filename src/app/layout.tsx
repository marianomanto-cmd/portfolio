import type { Metadata, Viewport } from 'next';
import BottomNav from '@/components/BottomNav';
import './globals.css';

export const metadata: Metadata = {
  title: 'Corte',
  description: 'Libro líquido personal. FIMA y broker, sin unificar las cuentas.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#0a0b0d',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body>
        <main className="mx-auto min-h-screen w-full max-w-lg px-4 pt-5">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
