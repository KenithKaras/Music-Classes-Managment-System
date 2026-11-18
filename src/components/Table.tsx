import React from 'react';

export interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export const Table: React.FC<TableProps> = ({ children, className = '' }) => {
  return (
    <div className={`overflow-x-auto rounded-2xl border border-slate-200 dark:border-[#1f2a3d] bg-white dark:bg-[#111a2b] shadow-2xs ${className}`}>
      <table className="min-w-full divide-y divide-slate-200 dark:divide-[#1f2a3d] text-left text-sm text-slate-700 dark:text-slate-300">
        {children}
      </table>
    </div>
  );
};

export interface CardListProps<T> {
  items: T[];
  renderCard: (item: T, index: number) => React.ReactNode;
  emptyState?: React.ReactNode;
  className?: string;
}

export function CardList<T>({
  items,
  renderCard,
  emptyState,
  className = '',
}: CardListProps<T>): React.ReactElement {
  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div className={`space-y-3 sm:hidden ${className}`}>
      {items.map((item, index) => (
        <React.Fragment key={index}>{renderCard(item, index)}</React.Fragment>
      ))}
    </div>
  );
}
