import { useBugReporter } from './BugReporterProvider';

interface BugReportButtonProps {
  className?: string;
  label?: string;
  badgeCount?: number;
}

export default function BugReportButton({ className, label, badgeCount }: BugReportButtonProps) {
  const { openReportModal, isCapturing } = useBugReporter();

  return (
    <button
      onClick={openReportModal}
      disabled={isCapturing}
      data-bug-reporter-exclude
      className={className}
      title="Report a bug (Ctrl+Shift+B)"
    >
      {isCapturing ? (
        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <BeetleIcon className="w-5 h-5" />
      )}
      {label && <span>{label}</span>}
      {badgeCount !== undefined && badgeCount > 0 && (
        <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}
    </button>
  );
}

export function BeetleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      {/* Antennae */}
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 6.5L6 3M16 6.5L18 3" />
      {/* Head */}
      <circle cx="12" cy="7" r="2.5" />
      {/* Body */}
      <ellipse cx="12" cy="14.5" rx="5" ry="6.5" />
      {/* Center line */}
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v12" />
      {/* Body stripes */}
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h8M7.5 15h9" />
      {/* Legs */}
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 11L4 9.5M7 14.5L3.5 14M7.5 17.5L4.5 19M16.5 11L20 9.5M17 14.5L20.5 14M16.5 17.5L19.5 19" />
    </svg>
  );
}
