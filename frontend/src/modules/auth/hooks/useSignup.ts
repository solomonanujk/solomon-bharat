import { useMutation } from '@tanstack/react-query';
import { authService } from '../services/auth.service';
import { SignupInput } from '../types';

export function useSignup() {
  return useMutation({
    mutationFn: (input: SignupInput) => authService.signup(input),
  });
}
