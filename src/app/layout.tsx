import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL('https://yumoii789.github.io/Gaokao-Academic-Resources'),
  title: "小墨高考 — AI驱动的学业提升平台",
  description: "普通高考 · 春季高考 · 词汇工坊。权威真题、启发式 AI 助教、高效学习工具。",
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    siteName: '小墨高考',
    title: '小墨高考 — AI驱动的学业提升平台',
    description: '普通高考 · 春季高考 · 词汇工坊。权威真题、启发式 AI 助教、高效学习工具。',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: '小墨高考 — AI驱动的学业提升平台' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '小墨高考 — AI驱动的学业提升平台',
    description: '普通高考 · 春季高考 · 词汇工坊。权威真题、启发式 AI 助教、高效学习工具。',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700;900&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
