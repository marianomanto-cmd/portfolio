'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/', label: 'Libro', d: 'M4 5h16v14H4z M4 9h16' },
  { href: '/cargar', label: 'Cargar', d: 'M12 5v14 M5 12h14' },
  { href: '/escenarios', label: 'Escenarios', d: 'M4 18l5-6 4 4 7-9' },
  { href: '/asesor', label: 'Asesor', d: 'M4 5h16v11H9l-5 4z' },
] as const;

export default function BottomNav() {
  const path = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-ink/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-lg">
        {ITEMS.map((item) => {
          const active = path === item.href;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-1 py-3 text-[11px] transition-colors ${
                  active ? 'text-accent' : 'text-mut hover:text-white'
                }`}
              >
                <svg
                  width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.6"
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                >
                  <path d={item.d} />
                </svg>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
