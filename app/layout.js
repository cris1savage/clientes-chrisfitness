import './globals.css';

export const metadata = {
  title: 'CF Clientes · Seguimiento',
  description: 'Panel de seguimiento de clientes — Chris Fitness',
  robots: { index: false, follow: false },
};

export const viewport = { themeColor: '#050708' };

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="bg-bg text-ink min-h-screen">
        {children}
      </body>
    </html>
  );
}
