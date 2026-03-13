import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cuba Internet Monitor',
  description: 'Monitoreo en tiempo real del estado de internet en Cuba',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', background: '#0f172a', color: '#e2e8f0' }}>
        {children}
      </body>
    </html>
  );
}
