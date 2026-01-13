import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Trivia Game - Live Interactive Quiz',
  description: 'Host and play live trivia games with friends, family, or colleagues. Real-time scoring, leaderboards, and fun!',
  keywords: ['trivia', 'quiz', 'game', 'multiplayer', 'live', 'interactive'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}
