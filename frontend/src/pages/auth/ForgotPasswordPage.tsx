import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../../components/layout/AuthLayout';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { authApi } from '../../services/auth.api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authApi.forgotPassword(email);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <AuthLayout>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Check your email</h2>
          <p className="text-sm text-gray-600 mb-6">
            If an account with that email exists, we've sent a password reset link.
          </p>
          <Link to="/login" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
            Back to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Reset your password</h2>
      <p className="text-sm text-gray-600 mb-6">
        Enter your email and we'll send you a reset link.
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="you@example.com"
        />

        <Button type="submit" loading={loading} className="w-full">
          Send reset link
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
