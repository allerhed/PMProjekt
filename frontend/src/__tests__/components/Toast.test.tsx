import { render, screen, act } from '@testing-library/react';
import { ToastProvider, useToast } from '../../components/common/Toast';

function ToastTrigger({ message, type }: { message: string; type?: 'success' | 'error' | 'info' }) {
  const { showToast } = useToast();
  return <button onClick={() => showToast(message, type)}>Show Toast</button>;
}

function renderWithProvider(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe('Toast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders toast container with aria-live', () => {
    renderWithProvider(<div>content</div>);
    const container = document.querySelector('[aria-live="polite"]');
    expect(container).toBeInTheDocument();
  });

  it('shows a toast message when triggered', () => {
    renderWithProvider(<ToastTrigger message="Test toast" />);
    act(() => {
      screen.getByText('Show Toast').click();
    });
    expect(screen.getByText('Test toast')).toBeInTheDocument();
  });

  it('uses role="alert" for error toasts', () => {
    renderWithProvider(<ToastTrigger message="Error occurred" type="error" />);
    act(() => {
      screen.getByText('Show Toast').click();
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Error occurred');
  });

  it('uses role="status" for success toasts', () => {
    renderWithProvider(<ToastTrigger message="Success!" type="success" />);
    act(() => {
      screen.getByText('Show Toast').click();
    });
    expect(screen.getByRole('status')).toHaveTextContent('Success!');
  });

  it('uses role="status" for info toasts', () => {
    renderWithProvider(<ToastTrigger message="FYI" type="info" />);
    act(() => {
      screen.getByText('Show Toast').click();
    });
    expect(screen.getByRole('status')).toHaveTextContent('FYI');
  });

  it('toast close button has aria-label', () => {
    renderWithProvider(<ToastTrigger message="Closable" />);
    act(() => {
      screen.getByText('Show Toast').click();
    });
    expect(screen.getByLabelText('Close notification')).toBeInTheDocument();
  });

  it('throws when useToast is used outside provider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ToastTrigger message="fail" />)).toThrow(
      'useToast must be used within a ToastProvider',
    );
    spy.mockRestore();
  });
});
