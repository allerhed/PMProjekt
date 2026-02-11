import clsx from 'clsx';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'gray' | 'red' | 'yellow' | 'green' | 'blue' | 'purple';
  size?: 'sm' | 'md';
}

const variantStyles = {
  gray: 'bg-gray-100 text-gray-700',
  red: 'bg-red-100 text-red-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  green: 'bg-green-100 text-green-700',
  blue: 'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
};

export default function Badge({ children, variant = 'gray', size = 'sm' }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center font-medium rounded-full',
        variantStyles[variant],
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
      )}
    >
      {children}
    </span>
  );
}
