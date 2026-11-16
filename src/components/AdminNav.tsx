'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Webhook } from 'lucide-react';

export function AdminNav() {
  const pathname = usePathname();

  const items = [
    { href: '/admin', label: 'Resumen y KPIs', icon: LayoutDashboard, exact: true },
    { href: '/admin/alumnos', label: 'Alumnos y Membresías', icon: Users, exact: false },
    { href: '/admin/integraciones', label: 'Pasarelas, GHL e IA', icon: Webhook, exact: false },
  ];

  return (
    <nav className="adm-nav" aria-label="Navegación de administración">
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + '/');
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={16} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
