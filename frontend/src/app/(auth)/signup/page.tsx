'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { authService } from '@/modules/auth/services/auth.service';

const signupSchema = z.object({
  companyName: z.string().max(200).optional().or(z.literal('')),
  contactName: z.string().min(1, 'Full name is required').max(200),
  email: z.string().email('Enter a valid email address'),
  country: z.string().min(1, 'Country is required').max(100),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the Terms of Service' }) }),
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const [formError, setFormError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({ resolver: zodResolver(signupSchema) });

  async function onSubmit(values: SignupFormValues) {
    setFormError(null);
    if (values.password !== values.confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }
    try {
      await authService.signup({
        email: values.email,
        password: values.password,
        contactName: values.contactName,
        country: values.country,
        companyName: values.companyName || undefined,
      });
      setIsDone(true);
    } catch {
      setFormError('Could not create your account. The email may already be in use.');
    }
  }

  if (isDone) {
    return (
      <div className="w-full max-w-sm rounded-modal border border-border bg-bg-surface p-8 text-center shadow-sm">
        <h1 className="font-serif text-h2 text-text-primary">Check Your Email</h1>
        <p className="mt-3 text-small text-text-muted">
          We&apos;ve sent a verification link to your email address. Verify your account, then log in.
        </p>
        <Link href="/login" className="mt-6 inline-block text-small font-medium text-accent-secondary hover:underline">
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-modal border border-border bg-bg-surface p-8 shadow-sm">
      <h1 className="font-serif text-h2 text-text-primary">Create Your Buyer Account</h1>
      <p className="mt-2 text-small text-text-muted">Join Solomon Bharat to start sourcing wholesale.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 flex flex-col gap-4">
        <div>
          <Label htmlFor="companyName">Company Name</Label>
          <Input id="companyName" {...register('companyName')} />
        </div>

        <div>
          <Label htmlFor="contactName">Full Name</Label>
          <Input id="contactName" error={errors.contactName?.message} {...register('contactName')} />
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        </div>

        <div>
          <Label htmlFor="country">Country</Label>
          <Input id="country" error={errors.country?.message} {...register('country')} />
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password')}
          />
        </div>

        <div>
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
        </div>

        <label className="flex items-start gap-2 text-small text-text-muted">
          <input type="checkbox" {...register('acceptTerms')} className="mt-1 accent-accent-primary" />
          <span>
            I accept the{' '}
            <Link href="/terms" className="font-medium text-accent-secondary hover:underline">
              Terms of Service
            </Link>
          </span>
        </label>
        {errors.acceptTerms && <p className="-mt-2 text-caption text-error">{errors.acceptTerms.message}</p>}

        {formError && <p className="text-small text-error">{formError}</p>}

        <Button type="submit" disabled={isSubmitting} size="lg" className="mt-2 w-full">
          {isSubmitting ? 'Creating account…' : 'Create Account'}
        </Button>
      </form>

      <p className="mt-6 text-center text-small text-text-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-accent-secondary hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
