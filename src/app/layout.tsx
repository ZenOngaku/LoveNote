import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { ThemeSync } from '@/components/ThemeSync'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/hooks/useAuth'

// 字体（拉丁字符使用 Geist，中文自动回退到系统字体）
const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

// 页面元信息
export const metadata: Metadata = {
  title: 'LoveNote · 情侣共享记事本',
  description:
    'LoveNote —— 一款简约温柔的情侣共享记事本：邀请码配对、共享笔记实时同步、私人笔记独立空间。基于 Next.js + Supabase 构建。',
  applicationName: 'LoveNote',
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">💗</text></svg>',
  },
}

// 移动端视口配置：禁止缩放抖动，适配刘海屏安全区域
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#FFF7F8',
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {/* 首帧防闪烁：HTML 解析前按已存主题预设 <html class="dark"> */}
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('lovenote-wallpaper-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />

        {/* 全局鉴权状态 Provider */}
        <AuthProvider>{children}</AuthProvider>

        {/* 主题同步：把壁纸主题映射为全局 .dark（含 meta theme-color） */}
        <ThemeSync />

        {/* 全局 Toast 提示（成功/错误/警告） */}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  )
}
