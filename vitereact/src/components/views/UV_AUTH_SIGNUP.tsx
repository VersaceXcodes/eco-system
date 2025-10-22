import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import { z } from 'zod';
import axios from 'axios';

// API Constants
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// Zod schemas matching backend requirements
const signupRequestSchema = z.object({
  email: z.string().email().min(1).max(255),
  password: z.string().min(10).max(255),
  full_name: z.string().min(1).max(100)
});

// Define types from schemas
type SignupRequest = z.infer<typeof signupRequestSchema>;

// API functions
const api = {
  signup: async (data: SignupRequest) => {
    const response = await axios.post(`${API_BASE_URL}/api/auth/signup`, data);
    return response.data;
  },
  googleSignup: async (token: string, location: { lat: number; lng: number }) => {
    const response = await axios.post(`${API_BASE_URL}/api/auth/google`, { token, location });
    return response.data;
  },
  resendVerification: async (email: string) => {
    // This would be implemented in the backend
    console.log('Resending verification email to:', email);
    return { success: true };
  }
};

// Password strength calculation
const calculatePasswordStrength = (password: string) => {
  let strength = 0;
  
  // Length check (min 10 characters)
  if (password.length >= 10) strength += 2;
  
  // Number check
  if (/\d/.test(password)) strength += 1;
  
  // Symbol check
  if (/[^A-Za-z0-9]/.test(password)) strength += 1;
  
  // Mixed case check
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 1;
  
  return strength;
};

const getPasswordStrengthColor = (strength: number) => {
  if (strength <= 2) return 'bg-red-500';
  if (strength === 3) return 'bg-yellow-500';
  if (strength === 4) return 'bg-blue-500';
  return 'bg-green-500';
};

const UV_AUTH_SIGNUP: React.FC = () => {
  // Zustand store access - individual selectors only
  const isLoading = useAppStore(state => state.authentication_state.authentication_status.is_loading);
  const errorMessage = useAppStore(state => state.authentication_state.error_message);
  const signupUser = useAppStore(state => state.signup_user);
  const clearAuthError = useAppStore(state => state.clear_auth_error);
  const initializeAuth = useAppStore(state => state.initialize_auth);
  
  const navigate = useNavigate();
  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [isVerificationSent, setIsVerificationSent] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [resendTimeout, setResendTimeout] = useState<NodeJS.Timeout | null>(null);
  const [canResend, setCanResend] = useState(true);
  
  // React Query mutations
  const signupMutation = useMutation({
    mutationFn: (data: SignupRequest) => api.signup(data),
    onSuccess: (data) => {
      // After successful signup, we don't log in automatically
      // User needs to verify email first
      setIsVerificationSent(true);
      setVerificationEmail(email);
    },
    onError: (error: any) => {
      let errorMsg = 'Failed to create account. Please try again.';
      if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      } else if (error.message.includes('409')) {
        errorMsg = 'Email already registered. Please log in or use a different email.';
      }
      // In a real implementation, this would set the error in Zustand store
      // For now, we'll handle it directly
    }
  });
  
  const resendVerificationMutation = useMutation({
    mutationFn: api.resendVerification,
    onSuccess: () => {
      // Show success message
      setCanResend(false);
      if (resendTimeout) clearTimeout(resendTimeout);
      const timeout = setTimeout(() => setCanResend(true), 60000); // 60 seconds cooldown
      setResendTimeout(timeout);
    },
    onError: () => {
      // Error handled by mutation
    }
  });
  
  // Calculate password strength when password changes
  useEffect(() => {
    if (password) {
      setPasswordStrength(calculatePasswordStrength(password));
    } else {
      setPasswordStrength(0);
    }
  }, [password]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (resendTimeout) clearTimeout(resendTimeout);
    };
  }, [resendTimeout]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthError();
    
    // Validate password strength before submission
    if (passwordStrength < 3) {
      // In a real implementation, this would set an error in Zustand
      return;
    }
    
    try {
      // Validate data with Zod before sending to API
      const validatedData = signupRequestSchema.parse({
        email,
        password,
        full_name: fullName
      });
      
      // Call the API
      await signupMutation.mutateAsync(validatedData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Handle validation errors
        const firstError = error.errors[0];
        // In a real implementation, this would set the error in Zustand
      }
    }
  };
  
  const handleResendVerification = () => {
    if (!canResend || !verificationEmail) return;
    resendVerificationMutation.mutate(verificationEmail);
  };
  
  const handleGoogleSignup = () => {
    // In a real implementation, this would trigger Google OAuth flow
    // For demo purposes, we'll simulate an error
    // Clear any existing errors
    clearAuthError();
    
    // Simulate Google Sign-In
    console.log('Google Sign-Up initiated');
    
    // In production, this would redirect to Google OAuth
    // For demo, show error to indicate implementation needed
    // In a real implementation, this would set an error in Zustand
  };
  
  // Password requirements check
  const hasMinLength = password.length >= 10;
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const hasMixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  
  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg border border-gray-100">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 leading-tight">
              Create your EcoPulse account
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Join our community of environmental stewards
            </p>
          </div>
          
          {/* Error Display */}
          {(errorMessage || signupMutation.error) && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md" role="alert">
              <p className="text-sm">
                {errorMessage || signupMutation.error?.message || 'Failed to create account. Please try again.'}
              </p>
            </div>
          )}
          
          {/* Verification Sent Message */}
          {isVerificationSent ? (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md" role="status">
              <h3 className="font-medium">Verify your email address</h3>
              <p className="mt-1 text-sm">
                We sent a verification link to <span className="font-medium">{verificationEmail}</span>. 
                Please check your inbox and click the link to activate your account.
              </p>
              <div className="mt-3 flex flex-col space-y-2">
                <button
                  onClick={handleResendVerification}
                  disabled={!canResend || resendVerificationMutation.isPending}
                  className={`text-blue-600 hover:text-blue-500 font-medium text-sm transition-colors ${
                    !canResend ? 'cursor-not-allowed opacity-50' : ''
                  }`}
                >
                  {resendVerificationMutation.isPending ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-1.5 h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending...
                    </span>
                  ) : canResend ? (
                    'Resend verification email'
                  ) : (
                    'Resend email available in 60 seconds'
                  )}
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="text-blue-600 hover:text-blue-500 font-medium text-sm transition-colors"
                >
                  Return to login
                </button>
              </div>
            </div>
          ) : (
            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                    Full Name
                  </label>
                  <div className="mt-1">
                    <input
                      id="fullName"
                      name="fullName"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => {
                        clearAuthError();
                        setFullName(e.target.value);
                      }}
                      placeholder="Full Name"
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all duration-200"
                    />
                  </div>
                </div>
                
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email Address
                  </label>
                  <div className="mt-1">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => {
                        clearAuthError();
                        setEmail(e.target.value);
                      }}
                      placeholder="you@example.com"
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all duration-200"
                    />
                  </div>
                </div>
                
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <div className="mt-1 relative">
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={password}
                      onChange={(e) => {
                        clearAuthError();
                        setPassword(e.target.value);
                      }}
                      placeholder="Create a strong password"
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all duration-200"
                    />
                    
                    {/* Password strength meter */}
                    {password && (
                      <div className="absolute -bottom-1 left-0 right-0 h-1 rounded-b-md overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-300 ${getPasswordStrengthColor(passwordStrength)}`}
                          style={{ width: `${Math.min(passwordStrength * 25, 100)}%` }}
                        ></div>
                      </div>
                    )}
                  </div>
                  
                  {/* Password requirements */}
                  <div className="mt-2 space-y-1 text-xs">
                    <div className={`flex items-center ${hasMinLength ? 'text-green-600' : 'text-gray-500'}`}>
                      <svg className={`h-4 w-4 mr-1 ${hasMinLength ? 'text-green-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={hasMinLength ? "M5 13l4 4L19 7" : "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"} />
                      </svg>
                      At least 10 characters
                    </div>
                    <div className={`flex items-center ${hasNumber ? 'text-green-600' : 'text-gray-500'}`}>
                      <svg className={`h-4 w-4 mr-1 ${hasNumber ? 'text-green-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={hasNumber ? "M5 13l4 4L19 7" : "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"} />
                      </svg>
                      At least one number
                    </div>
                    <div className={`flex items-center ${hasSymbol ? 'text-green-600' : 'text-gray-500'}`}>
                      <svg className={`h-4 w-4 mr-1 ${hasSymbol ? 'text-green-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={hasSymbol ? "M5 13l4 4L19 7" : "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"} />
                      </svg>
                      At least one special character
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={signupMutation.isPending || passwordStrength < 3}
                  className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {signupMutation.isPending ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating account...
                    </span>
                  ) : (
                    'Create Account'
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Google SSO Option */}
          {!isVerificationSent && (
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or continue with</span>
                </div>
              </div>

              <div className="mt-6">
                <button
                  type="button"
                  onClick={handleGoogleSignup}
                  disabled={signupMutation.isPending}
                  className="w-full inline-flex justify-center py-2.5 px-4 border border-gray-300 shadow-sm text-sm font-medium text-gray-500 bg-white rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span className="ml-2">Sign up with Google</span>
                </button>
              </div>
            </div>
          )}

          {/* Login link for existing users */}
          {!isVerificationSent && (
            <div className="text-center mt-6">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <Link 
                  to="/login" 
                  className="font-medium text-blue-600 hover:text-blue-500 transition-colors"
                >
                  Sign in
                </Link>
              </p>
            </div>
          )}
          
          {/* Terms link */}
          <div className="text-center mt-4 text-xs text-gray-500">
            By signing up, you agree to our{' '}
            <Link to="/terms-privacy" className="text-blue-600 hover:text-blue-500">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/terms-privacy" className="text-blue-600 hover:text-blue-500">
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_AUTH_SIGNUP;