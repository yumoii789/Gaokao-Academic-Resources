import type { Metadata } from "next";
import Link from "next/link";
import VisitTracker from "@/components/VisitTracker";
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
        <link rel="icon" type="image/png" href="/Gaokao-Academic-Resources/icon.png" />
        <link rel="manifest" href="/Gaokao-Academic-Resources/manifest.json" />
        <meta name="theme-color" content="#4f46e5" />
        <link rel="apple-touch-icon" href="/Gaokao-Academic-Resources/apple-touch-icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700;900&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: "{\"@context\":\"https://schema.org\",\"@type\":\"WebSite\",\"name\":\"小墨高考\",\"url\":\"https://yumoii789.github.io/Gaokao-Academic-Resources/\",\"description\":\"普通高考 · 春季高考 · 词汇工坊。权威真题、启发式 AI 助教、高效学习工具。\",\"inLanguage\":\"zh-CN\"}" }}
        />
        {children}
        <VisitTracker />
        <footer className='border-t border-slate-100 bg-white/60'>
          <div className='mx-auto max-w-5xl px-4 py-6 text-center text-xs text-slate-400'>
            <a
              href='https://github.com/yumoii789/Gaokao-Academic-Resources'
              target='_blank'
              rel='noreferrer'
              className='text-slate-500 hover:text-indigo-600 hover:underline'
            >
              GitHub 开源地址：yumoii789/Gaokao-Academic-Resources
            </a>
            <span className='mx-2'>·</span>
            <span>真题 PDF 来自公开仓库 deekur/gaokaomath 与 deekur/gaokaophysics</span>
            <span className='mx-2'>·</span>
            <Link href='/admin' className='text-slate-400 hover:text-indigo-600 hover:underline'>管理后台</Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
