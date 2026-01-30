import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CV Reformatter — ESN',
  description: 'Reformatage de CV pour consultants ESN - DreamIT / Rupturae',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-background">
        {children}
      </body>
    </html>
  );
}
