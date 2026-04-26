// src/app/layout.tsx
import type { Metadata } from 'next';
import { Cinzel, Crimson_Text } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const cinzel = Cinzel({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '600', '700', '900'],
});

const crimson = Crimson_Text({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '600'],
  style: ['normal', 'italic'],
});

export const metadata: Metadata = {
  title: 'Chess Roguelite — Battle for the Board',
  description: 'Chess where pieces fight to the death in roguelite battles',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${crimson.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
