import { render, screen } from '@testing-library/react';
import Spinner, { FullPageSpinner } from '../../components/ui/Spinner';

describe('Spinner', () => {
  it('renders with status role and loading label', () => {
    render(<Spinner />);
    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute('aria-label', 'Loading');
  });

  it('renders default medium size', () => {
    render(<Spinner />);
    const svg = screen.getByRole('status').querySelector('svg');
    expect(svg).toHaveClass('h-8', 'w-8');
  });

  it('renders small size', () => {
    render(<Spinner size="sm" />);
    const svg = screen.getByRole('status').querySelector('svg');
    expect(svg).toHaveClass('h-4', 'w-4');
  });

  it('renders large size', () => {
    render(<Spinner size="lg" />);
    const svg = screen.getByRole('status').querySelector('svg');
    expect(svg).toHaveClass('h-12', 'w-12');
  });

  it('accepts custom className', () => {
    render(<Spinner className="text-red-500" />);
    const svg = screen.getByRole('status').querySelector('svg');
    expect(svg).toHaveClass('text-red-500');
  });
});

describe('FullPageSpinner', () => {
  it('renders a large spinner in a centered container', () => {
    render(<FullPageSpinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    const svg = screen.getByRole('status').querySelector('svg');
    expect(svg).toHaveClass('h-12', 'w-12');
  });
});
