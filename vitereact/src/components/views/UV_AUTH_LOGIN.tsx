import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// Define TypeScript interfaces based on API specs
interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    full_name: string;
    expertise_level: 'beginner' | 'intermediate' | 'expert';
    credibility_score: number;
  };
}

interface AuthError {
  message: string;
  code: string;
  details?: any;
}

const UV_AUTH_LOGIN: React.FC = () => {
  // Local state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resendVerificationLoading, setResendVerificationLoading] = useState(false);
  
  // Zustand store - CRITICAL: Individual selectors only (no object destructuring)
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const isAuthLoading = useAppStore(state => state.authentication_state.authentication_status.is_loading);
  const authErrorMessage = useAppStore(state => state.authentication_state.error_message);
  const loginUser = useAppStore(state => state.login_user);
  const clearAuthError = useAppStore(state => state.clear_auth_error);
  
  // React Router hooks
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get redirect path from URL parameters or location state
  const getRedirectPath = () => {
    // Check URL parameters first (e.g., ?redirect_to=/map)
    const urlParams = new URLSearchParams(location.search);
    const redirectParam = urlParams.get('redirect_to');
    if (redirectParam) return redirectParam;
    
    // Check location state (from ProtectedRoute)
    if (location.state && (location.state as any).from) {
      return (location.state as any).from.pathname || '/';
    }
    
    // Default to dashboard
    return '/';
  };
  
  // React Query setup
  const queryClient = useQueryClient();
  
  const loginMutation = useMutation<LoginResponse, AuthError, LoginRequest>({
    mutationFn: async ({ email, password }) => {
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/auth/login`,
        { email, password }
      );
      return response.data;
    },
    onSuccess: (data) => {
      // Update Zustand store with login data
      loginUser(data.access_token, data.user);
      
      // Clear any previous errors
      clearAuthError();
      
      // Redirect to appropriate page
      navigate(getRedirectPath(), { replace: true });
    },
    onError: (error) => {
      let errorMessage = 'Invalid credentials. Please check your email and password.';
      
      // Handle different error scenarios
      if (error.response?.status === 401) {
        // Standard invalid credentials
        errorMessage = 'Invalid credentials. Please check your email and password.';
      } else if (error.response?.status === 403 && error.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
        // Unverified account
        errorMessage = 'Please verify your email address before logging in.';
      } else if (error.response?.status === 429) {
        // Account lockout/rate limiting
        errorMessage = 'Too many failed attempts. Please try again later or reset your password.';
      }
      
      // Set error in Zustand store for display
      // (Assuming there's a method in the store to set auth error)
      // This would be part of the store implementation
    }
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthError();
    loginMutation.mutate({ email, password });
  };
  
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    clearAuthError();
  };
  
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    clearAuthError();
  };
  
  const handleGoogleSSO = () => {
    // Implement Google SSO flow
    // This would typically open a popup or redirect to Google OAuth
    window.location.href = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/auth/google`;
  };
  
  const handleResendVerification = async () => {
    setResendVerificationLoading(true);
    try {
      await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/auth/verify-email/resend`,
        { email }
      );
      alert('Verification email resent! Please check your inbox.');
    } catch (error) {
      alert('Failed to resend verification email. Please try again.');
    } finally {
      setResendVerificationLoading(false);
    }
  };
  
  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isAuthLoading) {
      navigate(getRedirectPath(), { replace: true });
    }
  }, [isAuthenticated, isAuthLoading, navigate, getRedirectPath]);

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-blue-600 py-8 px-6 text-center">
            <h2 className="mt-2 text-3xl font-extrabold text-white leading-tight">
              Sign in to EcoPulse
            </h2>
            <p className="mt-2 text-sm text-blue-100">
              Contribute to environmental monitoring today
            </p>
          </div>
          
          {/* Form */}
          <div className="p-8">
            <form className="space-y-6" onSubmit={handleSubmit}>
              {/* Error Display */}
              {authErrorMessage && (
                <div 
                  className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md"
                  role="alert"
                  aria-live="polite"
                >
                  <p className="text-sm">{authErrorMessage}</p>
                </div>
              )}
              
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={handleEmailChange}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-base"
                  placeholder="your.email@example.com"
                />
              </div>
              
              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={handlePasswordChange}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-base pr-10"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m5.858 5.858l-3.29-3.29" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              
              {/* Forgot Password */}
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <a 
                    href="/forgot-password" 
                    className="font-medium text-blue-600 hover:text-blue-500 transition-colors"
                  >
                    Forgot your password?
                  </a>
                </div>
              </div>
              
              {/* Submit Button */}
              <div>
                <button
                  type="submit"
                  disabled={loginMutation.isPending || isAuthLoading}
                  className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {loginMutation.isPending || isAuthLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Signing in...
                    </>
                  ) : (
                    'Sign in'
                  )}
                </button>
              </div>
              
              {/* Google SSO */}
              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">Or continue with</span>
                  </div>
                </div>
                
                <div className="mt-6 grid grid-cols-1 gap-3">
                  <button
                    type="button"
                    onClick={handleGoogleSSO}
                    className="w-full inline-flex justify-center py-2.5 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20.283 10.356h-8.327v3.451h4.792c-.446 2.193-2.313 3.453-4.792 3.453a5.27 5.27 0 0 1-5.282-5.28 5.27 5.27 0 0 1 5.282-5.279c1.259 0 2.397.447 3.29 1.178l2.6-2.599c-1.584-1.484-3.615-2.436-5.89-2.436a8.908 8.908 0 0 0-8.934 8.934 8.907 8.907 0 0 0 8.934 8.934c4.467 0 8.529-3.249 8.529-8.934 0-.528-.081-1.097-.202-1.625z" fill="#4285F4"/>
                      <path d="M4.166 14.104a5.27 5.27 0 0 1 0-3.198V7.104H1.834A8.907 8.907 0 0 0 0 15.996c0 .648.055 1.275.163 1.89l3.003-2.386z" fill="#34A853"/>
                      <path d="M13.11 16.667a5.255 5.255 0 0 1-3.03 1.06 5.27 5.27 0 0 1-5.282-5.28 5.27 5.27 0 0 1 5.282-5.279c1.75 0 3.256.977 4.107 2.364l3.075-3.075a8.934 8.934 0 0 0-5.175-7.82 8.908 8.908 0 0 0-8.934 8.934 8.908 8.908 0 0 0 8.934 8.934c3.199 0 5.89-1.92 7.264-4.768l-3.075-3.075z" fill="#FBBC05"/>
                      <path d="M13.11 16.667c.86 1.787 2.59 3.135 4.62 3.135a8.908 8.908 0 0 0 8.934-8.934 8.908 8.908 0 0 0-8.934-8.934c-1.75 0-3.257.977-4.107 2.364l-3.075-3.075A8.934 8.934 0 0 0 1.834 7.104H4.166c.977 2.237 3.199 3.985 6.03 3.985z" fill="#EA4335"/>
                    </svg>
                    <span className="ml-2">Sign in with Google</span>
                  </button>
                </div>
              </div>
              
              {/* Unverified Account Handling */}
              {authErrorMessage?.includes('verify') && (
                <div className="mt-4 text-center">
                  <p className="text-sm text-gray-600 mb-2">
                    Your email address hasn't been verified yet.
                  </p>
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resendVerificationLoading}
                    className="text-blue-600 hover:text-blue-500 font-medium text-sm focus:outline-none focus:underline transition-colors disabled:opacity-50"
                  >
                    {resendVerificationLoading ? 'Sending...' : 'Resend verification email'}
                  </button>
                </div>
              )}
              
              {/* Sign Up Link */}
              <div className="text-center pt-4 border-t border-gray-200">
                <p className="text-base text-gray-600">
                  New to EcoPulse?{' '}
                  <a 
                    href="/signup" 
                    className="font-medium text-blue-600 hover:text-blue-500 transition-colors"
                  >
                    Create an account
                  </a>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_AUTH_LOGIN;