import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/layout/AuthLayout';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { useAuthStore } from '../../stores/authStore';

export default function RegisterPage() {
  const [form, setForm] = useState({
    organizationName: '',
    subdomain: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};

    if (form.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(form.password)) {
      errors.password = 'Password must contain an uppercase letter';
    } else if (!/[a-z]/.test(form.password)) {
      errors.password = 'Password must contain a lowercase letter';
    } else if (!/[0-9]/.test(form.password)) {
      errors.password = 'Password must contain a number';
    } else if (!/[^a-zA-Z0-9]/.test(form.password)) {
      errors.password = 'Password must contain a special character';
    }

    if (form.password !== form.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (form.subdomain && !/^[a-z0-9-]+$/.test(form.subdomain)) {
      errors.subdomain = 'Only lowercase letters, numbers, and hyphens';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!validate()) return;

    setLoading(true);
    try {
      await register({
        organizationName: form.organizationName,
        subdomain: form.subdomain,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
      });
      navigate('/projects', { replace: true });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Create your account</h2>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Organization Name"
          value={form.organizationName}
          onChange={(e) => updateField('organizationName', e.target.value)}
          required
          placeholder="Acme Construction"
        />

        <Input
          label="Subdomain"
          value={form.subdomain}
          onChange={(e) => updateField('subdomain', e.target.value.toLowerCase())}
          error={fieldErrors.subdomain}
          required
          placeholder="acme"
          helpText="Your unique identifier"
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="First Name"
            value={form.firstName}
            onChange={(e) => updateField('firstName', e.target.value)}
            required
          />
          <Input
            label="Last Name"
            value={form.lastName}
            onChange={(e) => updateField('lastName', e.target.value)}
            required
          />
        </div>

        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => updateField('email', e.target.value)}
          required
          autoComplete="email"
          placeholder="you@example.com"
        />

        <Input
          label="Password"
          type="password"
          value={form.password}
          onChange={(e) => updateField('password', e.target.value)}
          error={fieldErrors.password}
          required
          autoComplete="new-password"
          helpText="Min 8 characters with uppercase, lowercase, number, and special character"
        />

        <Input
          label="Confirm Password"
          type="password"
          value={form.confirmPassword}
          onChange={(e) => updateField('confirmPassword', e.target.value)}
          error={fieldErrors.confirmPassword}
          required
          autoComplete="new-password"
        />

        <Button type="submit" loading={loading} className="w-full">
          Create Account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        Already have an account?{' '}
        <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
