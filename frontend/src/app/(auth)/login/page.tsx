'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { useAuth } from '@/providers/AuthProvider';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const ROLE_REDIRECT: Record<string, string> = {
  BUYER: '/dashboard',
  SELLER: '/seller/dashboard',
  SUPER_ADMIN: '/admin/dashboard',
};

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginFormValues) {
    setFormError(null);
    try {
      const user = await login(values);
      router.push(ROLE_REDIRECT[user.role] ?? '/dashboard');
    } catch {
      setFormError('Invalid email or password.');
    }
  }

  return (
    <div className="w-full max-w-[420px] rounded-modal border border-border bg-bg-surface p-8 shadow-[0_4px_20px_rgba(26,26,26,0.04)] sm:p-10">
      <h1 className="font-serif text-h2 leading-tight text-text-primary">Welcome Back</h1>
      <p className="mt-2 text-small text-text-muted">Log in to continue sourcing from Solomon Bharat.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 flex flex-col gap-4" noValidate>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="mb-0">
              Password
            </Label>
            <Link href="/forgot-password" className="text-caption text-accent-secondary hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="Your password"
            autoComplete="current-password"
            className="mt-1"
            error={errors.password?.message}
            {...register('password')}
          />
        </div>

        {formError && (
          <p className="text-small text-error" role="alert">
            {formError}
          </p>
        )}

        <Button type="submit" disabled={isSubmitting} size="lg" className="mt-2 w-full">
          {isSubmitting ? 'Logging in…' : 'Log In'}
        </Button>
      </form>

      <p className="mt-7 text-center text-small text-text-muted">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="font-medium text-accent-secondary hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
