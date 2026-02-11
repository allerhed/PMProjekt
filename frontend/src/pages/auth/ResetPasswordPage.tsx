import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/layout/AuthLayout';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { authApi } from '../../services/auth.api';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function validate(): boolean {
    const errors: Record<string, string> = {};

    if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }
    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!validate()) return;

    if (!token) {
      setError('Invalid or missing reset token');
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <AuthLayout>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Password reset successful</h2>
          <p className="text-sm text-gray-600 mb-6">
            Your password has been updated. You can now sign in with your new password.
          </p>
          <Button onClick={() => navigate('/login')}>
            Sign in
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Set new password</h2>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="New Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          required
          autoComplete="new-password"
          helpText="Min 8 characters with uppercase, lowercase, number, and special character"
        />

        <Input
          label="Confirm New Password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={fieldErrors.confirmPassword}
          required
          autoComplete="new-password"
        />

        <Button type="submit" loading={loading} className="w-full">
          Reset password
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
