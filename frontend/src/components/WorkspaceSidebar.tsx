'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface WorkspaceNavItem {
  href: string;
  label: string;
}

export interface WorkspaceSidebarProps {
  readonly items: WorkspaceNavItem[];
}

export function WorkspaceSidebar({ items }: WorkspaceSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-bg-surface px-3 py-8">
      <nav className="flex flex-col gap-0.5">
        {items.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-sans transition-colors ${
                isActive
                  ? 'bg-fill-subtle font-semibold text-text-primary'
                  : 'font-normal text-text-muted hover:bg-fill-subtle/60 hover:text-text-primary'
              }`}
            >
              {item.label}
              {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent-primary" aria-hidden="true" />}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
