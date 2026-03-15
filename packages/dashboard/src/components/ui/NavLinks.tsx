'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { metricsApi } from '@/lib/api';

const navItems = [
  { href: '/', label: 'Dashboard', icon: '◈' },
  { href: '/products', label: 'Descripciones', icon: '✦' },
  { href: '/reviews', label: 'Reseñas', icon: '✉', badge: 'pendingReviews' },
  { href: '/alerts', label: 'Alertas de Stock', icon: '⚡' },
  { href: '/categorization', label: 'Categorización', icon: '◉' },
];

export default function NavLinks() {
  const [pendingReviews, setPendingReviews] = useState<number>(0);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await metricsApi.getDashboard();
        if (res.success) setPendingReviews(res.data.live.pending_reviews);
      } catch {}
    };
    fetch();
    const iv = setInterval(fetch, 30_000);
    return () => clearInterval(iv);
  }, []);

  return (
    <>
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-sm font-medium group"
        >
          <span className="text-base opacity-70 group-hover:opacity-100">{item.icon}</span>
          <span className="flex-1">{item.label}</span>
          {item.badge === 'pendingReviews' && pendingReviews > 0 && (
            <span className="bg-amber-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center leading-none">
              {pendingReviews > 99 ? '99+' : pendingReviews}
            </span>
          )}
        </Link>
      ))}
    </>
  );
}
