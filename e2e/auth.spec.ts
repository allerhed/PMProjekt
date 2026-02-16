import { test, expect } from '@playwright/test';

test.describe('Authentication flow', () => {
  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login');

    // Page title
    await expect(page).toHaveTitle('TaskProof');

    // Login form elements
    await expect(page.getByText('Sign in to your account')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();

    // Navigation links
    await expect(page.getByText('Forgot password?')).toBeVisible();
    await expect(page.getByText('Register')).toBeVisible();
  });

  test('register page renders correctly', async ({ page }) => {
    await page.goto('/register');

    await expect(page.getByLabel('Organization Name')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /register|create|sign up/i })).toBeVisible();
  });

  test('forgot password page renders correctly', async ({ page }) => {
    await page.goto('/forgot-password');

    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: /reset|send/i })).toBeVisible();
  });

  test('login page redirects to login when accessing protected routes', async ({ page }) => {
    await page.goto('/projects');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('nonexistent@example.com');
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Should show some error message (network error or invalid credentials)
    await expect(page.locator('.bg-red-50, [role="alert"]')).toBeVisible({ timeout: 10_000 });
  });

  test('navigation between auth pages works', async ({ page }) => {
    await page.goto('/login');

    // Navigate to register
    await page.getByText('Register').click();
    await expect(page).toHaveURL(/\/register/);

    // Navigate back to login
    await page.getByText(/sign in|login/i).click();
    await expect(page).toHaveURL(/\/login/);

    // Navigate to forgot password
    await page.getByText('Forgot password?').click();
    await expect(page).toHaveURL(/\/forgot-password/);
  });
});

test.describe('PWA', () => {
  test('manifest is accessible', async ({ page }) => {
    const response = await page.goto('/manifest.webmanifest');
    expect(response?.status()).toBe(200);

    const manifest = await response?.json();
    expect(manifest.name).toBe('TaskProof');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  test('has theme-color meta tag', async ({ page }) => {
    await page.goto('/login');
    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
    expect(themeColor).toBe('#2563eb');
  });

  test('has apple-touch-icon', async ({ page }) => {
    await page.goto('/login');
    const icon = page.locator('link[rel="apple-touch-icon"]');
    await expect(icon).toHaveAttribute('href', '/pwa-192x192.png');
  });
});
