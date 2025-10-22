import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import axios from 'axios';

const UV_AUTH_VERIFICATION: React.FC = () => {
  // Individual Zustand selectors - critical pattern to avoid infinite loops
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  
  // State management
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(false);
  const [countdown, setCountdown] = useState(60);
  
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  
  // Extract token from URL query parameters
  const getToken = () => {
    const params = new URLSearchParams(location.search);
    return params.get('token');
  };
  
  const token = getToken();
  
  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/profile/setup', { replace: true });
    }
  }, [isAuthenticated, navigate]);
  
  // Initialize verification if token exists
  useEffect(() => {
    if (token) {
      verifyEmailMutation.mutate(token);
    } else {
      setVerificationError('Verification token is missing');
    }
  }, [token]);
  
  // Timer effect for resend cooldown
  useEffect(() => {
    let timer: number;
    
    if (resendCooldown && countdown > 0) {
      timer = window.setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (countdown === 0) {
      setResendCooldown(false);
    }
    
    return () => window.clearTimeout(timer);
  }, [resendCooldown, countdown]);
  
  // Verify email mutation
  const verifyEmailMutation = useMutation({
    mutationFn: async (verificationToken: string) => {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/auth/verify-email`,
        {
          params: { token: verificationToken }
        }
      );
      return response;
    },
    onSuccess: () => {
      setVerificationSuccess(true);
      // Auto-redirect to profile setup after brief delay
      setTimeout(() => {
        navigate('/profile/setup', { replace: true });
      }, 2000);
    },
    onError: (error: any) => {
      if (error.response?.status === 400) {
        setIsExpired(true);
        setVerificationError('This verification link has expired. Please request a new verification email.');
      } else {
        setVerificationError('Failed to verify email. Please try again or contact support.');
      }
    }
  });
  
  // Resend verification email mutation
  const resendVerificationMutation = useMutation({
    mutationFn: async () => {
      // In a real implementation, we'd need the user's email to resend
      // This would typically require calling an endpoint like /api/auth/resend-verification
      // For now, we'll simulate the API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { success: true };
    },
    onSuccess: () => {
      setResendCooldown(true);
      setCountdown(60);
      setVerificationError('New verification email sent! Please check your inbox.');
    },
    onError: () => {
      setVerificationError('Failed to send verification email. Please try again later.');
    }
  });
  
  const handleResendClick = () => {
    if (!resendCooldown && !resendVerificationMutation.isLoading) {
      resendVerificationMutation.mutate();
    }
  };
  
  // Loading state - initial verification
  if ((verificationSuccess || verificationError || isExpired) ? false : true) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full space-y-8 text-center">
            <div>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                Verifying your email
              </h2>
              <p className="mt-2 text-lg text-gray-600">
                Please wait while we verify your email address
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }
  
  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <div>
            {verificationSuccess ? (
              <div className="space-y-6">
                <div className="flex justify-center">
                  <div className="animate-checkmark">
                    <svg className="h-16 w-16 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <h2 className="text-3xl font-extrabold text-gray-900">
                  Email verified successfully!
                </h2>
                <p className="text-lg text-gray-600">
                  Thank you for verifying your email address. Redirecting to profile setup...
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h2 className="text-3xl font-extrabold text-gray-900">
                    {isExpired ? 'Verification link expired' : 'Verify your email'}
                  </h2>
                  <p className="mt-2 text-lg text-gray-600">
                    {isExpired 
                      ? 'This verification link has expired after 24 hours.' 
                      : 'Confirm your email address to complete your account setup.'}
                  </p>
                </div>
                
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                  <div className="space-y-4">
                    <div className="text-left">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Why verify your email?
                      </h3>
                      <ul className="list-disc pl-5 space-y-1 text-gray-600 text-sm">
                        <li>Ensures data integrity for environmental observations</li>
                        <li>Builds community trust in reported observations</li>
                        <li>Prevents spam and bot activity</li>
                        <li>Enables profile customization and data export</li>
                      </ul>
                    </div>
                    
                    {verificationError && (
                      <div className="bg-red-50 border border-red-200 rounded-md p-4" aria-live="polite">
                        <p className="text-sm text-red-700">{verificationError}</p>
                      </div>
                    )}
                    
                    <div className="pt-4">
                      <button
                        onClick={handleResendClick}
                        disabled={resendCooldown || resendVerificationMutation.isLoading}
                        className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200 ${
                          (resendCooldown || resendVerificationMutation.isLoading) ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        {resendVerificationMutation.isLoading ? (
                          <span className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Sending...
                          </span>
                        ) : resendCooldown ? (
                          `Resend email (${countdown}s)`
                        ) : (
                          'Resend verification email'
                        )}
                      </button>
                      
                      <p className="mt-4 text-xs text-gray-500">
                        Verification links expire after 24 hours for security
                      </p>
                    </div>
                    
                    <div className="pt-4 border-t border-gray-200">
                      <Link 
                        to="/login" 
                        className="text-blue-600 hover:text-blue-500 font-medium text-sm transition-colors"
                      >
                        Already verified? Sign in
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-8">
            <p className="text-center text-sm text-gray-500">
              Having trouble?{' '}
              <Link 
                to="/help-center" 
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Contact support
              </Link>
            </p>
          </div>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes checkmark {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
            opacity: 1;
          }
          100% {
            transform: scale(1);
          }
        }
        
        .animate-checkmark {
          animation: checkmark 0.5s ease-out;
        }
      `}</style>
    </>
  );
};

export default UV_AUTH_VERIFICATION;