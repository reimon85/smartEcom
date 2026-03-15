import type { Metadata } from 'next';
import ThemeToggle from '@/components/ui/ThemeToggle';
import NavLinks from '@/components/ui/NavLinks';
import DemoBanner from '@/components/ui/DemoBanner';
import './globals.css';

export const metadata: Metadata = {
  title: 'SmartEcom AI Pipeline',
  description: 'AI automation pipeline for e-commerce operations',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <DemoBanner />
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="w-64 bg-slate-900 text-white flex flex-col flex-shrink-0">
            <div className="p-6 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-sm font-bold">
                  SE
                </div>
                <div>
                  <div className="font-semibold text-sm">SmartEcom</div>
                  <div className="text-xs text-slate-400">AI Pipeline</div>
                </div>
              </div>
            </div>

            <nav className="flex-1 p-4 space-y-1">
              <div className="flex justify-end mb-2 px-1">
                <ThemeToggle />
              </div>
              <NavLinks />
            </nav>

            <div className="p-4 border-t border-slate-700">
              <div className="text-xs text-slate-500">
                <div className="font-medium text-slate-400 mb-1">Model</div>
                <div>GPT-4o-mini</div>
                <div className="mt-2 font-medium text-slate-400 mb-1">API</div>
                <div className="truncate">
                  {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}
                </div>
              </div>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-auto dark:bg-slate-900">
            <div className="p-8 max-w-7xl">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
