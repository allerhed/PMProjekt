import type { ReactNode } from 'react';
import clsx from 'clsx';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export default function Card({ children, className, onClick, hoverable }: CardProps) {
  return (
    <div
      className={clsx(
        'bg-white rounded-lg border border-gray-200 shadow-sm',
        hoverable && 'hover:shadow-md hover:border-gray-300 transition-shadow cursor-pointer',
        onClick && 'cursor-pointer',
        className,
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('px-6 py-4 border-b border-gray-200', className)}>{children}</div>;
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('px-6 py-4', className)}>{children}</div>;
}

export function CardFooter({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('px-6 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg', className)}>{children}</div>;
}
