import type { ReactNode } from 'react';
import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import type { FinancialData } from '../types/financial';

interface LayoutProps {
  title: string;
  subtitle?: string;
  data: FinancialData | null;
  isRefreshing: boolean;
  onRefresh: () => void;
  children: ReactNode;
}

export function Layout({
  title,
  subtitle,
  data,
  isRefreshing,
  onRefresh,
  children,
}: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gep-gray-light">
      <Sidebar
        isMobileMenuOpen={isMobileMenuOpen}
        onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
      />
      <main className="flex-1 flex flex-col min-w-0">
        <Header
          title={title}
          subtitle={subtitle}
          lastUpdated={data?.lastUpdated || null}
          source={data?.source}
          isRefreshing={isRefreshing}
          onRefresh={onRefresh}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        />
        <div className="flex-1 p-4 sm:p-6 md:p-8 overflow-x-hidden">{children}</div>
      </main>
    </div>
  );
}
