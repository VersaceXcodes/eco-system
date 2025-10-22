import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import axios from 'axios';

// Define TypeScript interfaces matching API responses
interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  expertise_level: string;
  credibility_score: number;
  avatar_url: string | null;
  is_verified_expert: boolean;
}

interface StorageUsage {
  used_mb: number;
  limit_mb: number;
  percentage: number;
}

// API functions
const fetchUserProfile = async (): Promise<UserProfile> => {
  const userId = useAppStore.getState().authentication_state.current_user?.id;
  if (!userId) throw new Error('No user ID available');
  
  const response = await axios.get(`/api/users/${userId}`);
  return {
    id: response.data.id,
    full_name: response.data.full_name,
    email: response.data.email,
    expertise_level: response.data.expertise_level,
    credibility_score: response.data.credibility_score,
    avatar_url: response.data.avatar_url,
    is_verified_expert: response.data.verification_status === 'expert'
  };
};

const fetchStorageUsage = async (): Promise<StorageUsage> => {
  const response = await axios.get('/api/user_storage_usage');
  return {
    used_mb: response.data.used_mb,
    limit_mb: response.data.limit_mb,
    percentage: (response.data.used_mb / response.data.limit_mb) * 100
  };
};

const logoutUser = async () => {
  await axios.post('/api/auth/logout');
};

// Constants for UI configuration
const MENU_ITEMS = {
  primary: [
    { id: 'observations', label: 'My Observations', path: '/observations', icon: 'list' },
    { id: 'profile', label: 'Profile Settings', path: '/profile', icon: 'settings' },
    { id: 'submit', label: 'Submit Observation', path: '/submit', icon: 'plus-circle', roles: ['community_scientist', 'field_researcher', 'municipal_planner', 'educator'] },
    { id: 'verification', label: 'Verification Queue', path: '/verification-queue', icon: 'check-circle', roles: ['field_researcher'] },
  ],
  secondary: [
    { id: 'help', label: 'Help Center', path: '/help-center', icon: 'help-circle' },
    { id: 'terms', label: 'Terms & Privacy', path: '/terms-privacy', icon: 'file-text' },
  ]
};

const GV_USER_MENU: React.FC = () => {
  // Individual Zustand selectors - NO OBJECT DESTRUCTURING
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const verifiedObservations = useAppStore(state => state.observation_state.verified_observations);
  const verificationQueue = useAppStore(state => state.verification_state.verification_queue);
  
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  // Local state
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Data fetching with React Query
  const { 
    data: userProfile, 
    isLoading: isProfileLoading,
    error: profileError,
    refetch: refetchProfile 
  } = useQuery<UserProfile, Error>({
    queryKey: ['userProfile'],
    queryFn: fetchUserProfile,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    retry: 1
  });
  
  const { 
    data: storageUsage, 
    isLoading: isStorageLoading,
    error: storageError 
  } = useQuery<StorageUsage, Error>({
    queryKey: ['storageUsage'],
    queryFn: fetchStorageUsage,
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
    retry: 1
  });
  
  const { 
    mutate: handleLogout, 
    isLoading: isLogoutLoading 
  } = useMutation({
    mutationFn: logoutUser,
    onSuccess: () => {
      // Clear Zustand store through global action
      useAppStore.getState().logout_user();
      queryClient.clear();
      navigate('/login', { replace: true });
    },
    onError: (error) => {
      console.error('Logout failed:', error);
      // Even if API call fails, clear local state
      useAppStore.getState().logout_user();
      queryClient.clear();
      navigate('/login', { replace: true });
    }
  });
  
  // Toggle menu handlers
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
    if (!isMenuOpen) setMobileMenuOpen(true);
  };
  
  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };
  
  // Calculate user's observation count
  const userObservationCount = isAuthenticated && currentUser
    ? verifiedObservations.filter(o => o.user_id === currentUser.id).length
    : 0;
  
  // Determine if verification queue has pending items for current user
  const hasPendingVerifications = isAuthenticated && currentUser && isProfileLoading === false && userProfile?.is_verified_expert
    ? verificationQueue.some(item => 
        item.submitter_id !== currentUser.id && 
        (item.verification_tier === 1 || item.verification_tier === 2)
      )
    : false;
  
  // Handle window click to close mobile menu
  useEffect(() => {
    const handleWindowClick = (e: MouseEvent) => {
      if (mobileMenuOpen && !(e.target instanceof Element && e.target.closest('.mobile-menu-trigger'))) {
        setMobileMenuOpen(false);
      }
    };
    
    window.addEventListener('click', handleWindowClick);
    return () => window.removeEventListener('click', handleWindowClick);
  }, [mobileMenuOpen]);
  
  // Handle escape key to close menus
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
        setMobileMenuOpen(false);
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);
  
  // Render avatar with fallback
  const renderAvatar = () => {
    if (userProfile?.avatar_url) {
      return (
        <img 
          src={userProfile.avatar_url} 
          alt={`${userProfile.full_name}'s avatar`} 
          className="h-8 w-8 rounded-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
            const parent = (e.target as HTMLImageElement).parentNode;
            if (parent) {
              (parent as HTMLElement).innerHTML = `
                <div class="h-8 w-8 rounded-full bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                  <span class="text-blue-700 font-medium text-sm">${userProfile.full_name.charAt(0)}</span>
                </div>
              `;
            }
          }}
        />
      );
    }
    
    return (
      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <span className="text-blue-700 font-medium text-sm">
          {userProfile?.full_name ? userProfile.full_name.charAt(0) : '?'}
        </span>
      </div>
    );
  };
  
  // Render loading state
  const renderLoadingState = () => (
    <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg py-1 z-50 border border-gray-200">
      <div className="px-4 py-3 text-sm text-gray-500">Loading...</div>
      <div className="border-t border-gray-100"></div>
      <div className="px-4 py-2 text-xs text-gray-400">Fetching profile data</div>
    </div>
  );
  
  // Render error state with retry option
  const renderErrorState = (error: Error | null, onRetry: () => void) => (
    <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg py-1 z-50 border border-gray-200">
      <div className="px-4 py-3 text-sm text-red-600">Error loading data</div>
      <div className="border-t border-gray-100"></div>
      <div className="px-4 py-2 text-xs text-gray-500 mb-2">
        {error?.message || 'Failed to load user data'}
      </div>
      <button
        onClick={onRetry}
        className="w-full px-4 py-2 text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-md transition-colors"
      >
        Retry
      </button>
    </div>
  );
  
  // Render authenticated menu
  const renderAuthenticatedMenu = () => {
    if (isProfileLoading) return renderLoadingState();
    if (profileError) return renderErrorState(profileError, refetchProfile);
    if (!userProfile) return null;
    
    return (
      <div 
        className={`absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg py-1 z-50 border border-gray-200 ${
          isMenuOpen ? 'block' : 'hidden'
        }`}
        role="menu"
        aria-orientation="vertical"
      >
        {/* Profile Summary */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center">
            {renderAvatar()}
            <div className="ml-3">
              <div className="font-medium text-gray-900 text-sm">{userProfile.full_name}</div>
              <div className="text-xs text-gray-500 truncate">{userProfile.email}</div>
              <div className="mt-1 flex items-center">
                <div className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                  {userProfile.credibility_score}/100
                </div>
                <span className="ml-1 text-xs text-gray-500">credibility</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Quick Links */}
        <div className="py-1">
          {MENU_ITEMS.primary.map(item => {
            // Skip items not applicable to user's role
            if (item.roles && !item.roles.includes(currentUser?.role || '')) return null;
            
            return (
              <Link
                key={item.id}
                to={item.path}
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors group relative"
                role="menuitem"
                onClick={() => {
                  setIsMenuOpen(false);
                  setMobileMenuOpen(false);
                }}
              >
                <span className="mr-3 text-gray-400 group-hover:text-blue-600">
                  {item.icon === 'check-circle' && hasPendingVerifications && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                  )}
                  {/* Icon would be implemented with Lucide here */}
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d={item.id === 'verification' ? 
                      'M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z' : 
                      'M4 6a2 2 0 012-2h8a2 2 0 012 2v2h2a1 1 0 010 2h-2v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-8zm4 4a2 2 0 100-4 2 2 0 000 4z'
                    } clipRule="evenodd" />
                  </svg>
                </span>
                {item.label}
                {item.id === 'verification' && hasPendingVerifications && (
                  <span className="ml-auto bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded">
                    {hasPendingVerifications}
                  </span>
                )}
              </Link>
            );
          })}
          
          <div className="border-t border-gray-100 my-1"></div>
          
          {MENU_ITEMS.secondary.map(item => (
            <Link
              key={item.id}
              to={item.path}
              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
              role="menuitem"
              onClick={() => {
                setIsMenuOpen(false);
                setMobileMenuOpen(false);
              }}
            >
              <span className="mr-3 text-gray-400">
                {/* Icon would be implemented with Lucide here */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-1 1v4a1 1 0 00.293.707l2.828 2.829a1 1 0 001.415-1.415l-2.829-2.828A1 1 0 0012 12V7a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </span>
              {item.label}
            </Link>
          ))}
          
          <div className="border-t border-gray-100 my-1"></div>
          
          {/* Storage Usage */}
          {storageUsage && (
            <div className="px-4 py-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600">Storage</span>
                <span className={`${
                  storageUsage.percentage > 90 ? 'text-red-600' : 
                  storageUsage.percentage > 75 ? 'text-yellow-600' : 
                  'text-green-600'
                }`}>
                  {storageUsage.used_mb.toFixed(1)}MB/{storageUsage.limit_mb}MB
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div 
                  className={`h-1.5 rounded-full ${
                    storageUsage.percentage > 90 ? 'bg-red-600' : 
                    storageUsage.percentage > 75 ? 'bg-yellow-500' : 
                    'bg-green-500'
                  }`}
                  style={{ width: `${storageUsage.percentage}%` }}
                ></div>
              </div>
            </div>
          )}
          
          {/* Logout */}
          <button
            onClick={() => handleLogout()}
            disabled={isLogoutLoading}
            className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            role="menuitem"
          >
            <span className="mr-3 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 7a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm1 3a1 1 0 00-1 1v8a1 1 0 102 0V9a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </span>
            {isLogoutLoading ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      </div>
    );
  };
  
  // Render unauthenticated state
  const renderUnauthenticatedState = () => (
    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-50 border border-gray-200">
      <Link
        to="/login"
        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        role="menuitem"
      >
        Sign In
      </Link>
      <Link
        to="/signup"
        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        role="menuitem"
      >
        Sign Up
      </Link>
    </div>
  );
  
  return (
    <>
      <div className="relative inline-block text-left z-50">
        {/* Desktop Menu Button */}
        <button
          onClick={toggleMenu}
          className="hidden md:flex items-center text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md p-1 transition-colors"
          aria-expanded="false"
          aria-haspopup="true"
          aria-label="User menu"
        >
          {isAuthenticated ? (
            <div className="flex items-center">
              <div className="h-8 w-8 rounded-full overflow-hidden mr-2">
                {isProfileLoading ? (
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-50 to-indigo-100 animate-pulse"></div>
                ) : (
                  renderAvatar()
                )}
              </div>
              <span className="text-sm font-medium text-gray-700">{userProfile?.full_name || ''}</span>
            </div>
          ) : (
            <div className="text-gray-700">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}
        </button>
        
        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden flex items-center text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md p-1 transition-colors mobile-menu-trigger"
          aria-expanded={mobileMenuOpen}
          aria-haspopup="true"
          aria-label="Mobile user menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        
        {/* Authenticated User Menu */}
        {isAuthenticated && isMenuOpen && renderAuthenticatedMenu()}
        
        {/* Unauthenticated Menu */}
        {!isAuthenticated && isMenuOpen && renderUnauthenticatedState()}
      </div>
      
      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-25 z-40 md:hidden" aria-hidden="true"></div>
      )}
      
      {/* Mobile Menu Drawer */}
      <div className={`fixed inset-y-0 right-0 max-w-xs w-full bg-white shadow-xl transform transition-transform duration-300 ease-in-out z-50 md:hidden ${
        mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Account</h3>
              <button
                onClick={closeMobileMenu}
                className="text-gray-500 hover:text-gray-700 focus:outline-none"
                aria-label="Close menu"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* Menu Content */}
          <div className="flex-1 overflow-y-auto py-4">
            {isAuthenticated ? (
              <>
                {/* Profile Summary for Mobile */}
                <div className="px-4 mb-4">
                  <div className="flex items-center">
                    <div className="h-12 w-12 rounded-full overflow-hidden mr-3">
                      {renderAvatar()}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{userProfile?.full_name}</div>
                      <div className="text-xs text-gray-500">{userProfile?.email}</div>
                      <div className="mt-1 flex items-center">
                        <div className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                          {userProfile?.credibility_score}/100
                        </div>
                        <span className="ml-1 text-xs text-gray-500">credibility</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="border-t border-gray-200"></div>
                
                {/* Menu Items */}
                <div className="mt-4">
                  {MENU_ITEMS.primary.map(item => {
                    if (item.roles && !item.roles.includes(currentUser?.role || '')) return null;
                    
                    return (
                      <Link
                        key={item.id}
                        to={item.path}
                        className="flex items-center px-4 py-2.5 text-base text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors group relative"
                        onClick={closeMobileMenu}
                      >
                        <span className="mr-3 text-gray-400 group-hover:text-blue-600">
                          {item.icon === 'check-circle' && hasPendingVerifications && (
                            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                          )}
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d={item.id === 'verification' ? 
                              'M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z' : 
                              'M4 6a2 2 0 012-2h8a2 2 0 012 2v2h2a1 1 0 010 2h-2v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-8zm4 4a2 2 0 100-4 2 2 0 000 4z'
                            } clipRule="evenodd" />
                          </svg>
                        </span>
                        {item.label}
                        {item.id === 'verification' && hasPendingVerifications && (
                          <span className="ml-auto bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded">
                            {hasPendingVerifications}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                  
                  <div className="border-t border-gray-200 my-2"></div>
                  
                  {MENU_ITEMS.secondary.map(item => (
                    <Link
                      key={item.id}
                      to={item.path}
                      className="flex items-center px-4 py-2.5 text-base text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                      onClick={closeMobileMenu}
                    >
                      <span className="mr-3 text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-1 1v4a1 1 0 00.293.707l2.828 2.829a1 1 0 001.415-1.415l-2.829-2.828A1 1 0 0012 12V7a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </span>
                      {item.label}
                    </Link>
                  ))}
                  
                  <div className="border-t border-gray-200 my-2"></div>
                  
                  {/* Storage Usage for Mobile */}
                  {storageUsage && (
                    <div className="px-4 pt-2">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Storage</span>
                        <span className={`${
                          storageUsage.percentage > 90 ? 'text-red-600' : 
                          storageUsage.percentage > 75 ? 'text-yellow-600' : 
                          'text-green-600'
                        }`}>
                          {storageUsage.used_mb.toFixed(1)}MB/{storageUsage.limit_mb}MB
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            storageUsage.percentage > 90 ? 'bg-red-600' : 
                            storageUsage.percentage > 75 ? 'bg-yellow-500' : 
                            'bg-green-500'
                          }`}
                          style={{ width: `${storageUsage.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  
                  <div className="border-t border-gray-200 mt-2"></div>
                  
                  <button
                    onClick={() => {
                      handleLogout();
                      closeMobileMenu();
                    }}
                    disabled={isLogoutLoading}
                    className="flex w-full items-center px-4 py-2.5 text-base text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                  >
                    <span className="mr-3 text-gray-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 7a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm1 3a1 1 0 00-1 1v8a1 1 0 102 0V9a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </span>
                    {isLogoutLoading ? 'Signing out...' : 'Sign out'}
                  </button>
                </div>
              </>
            ) : (
              <div className="px-4 py-6 text-center">
                <p className="text-gray-500 mb-4">Please sign in to access your account</p>
                <div className="space-y-3">
                  <Link
                    to="/login"
                    className="block w-full px-4 py-3 text-base text-center text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                    onClick={closeMobileMenu}
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/signup"
                    className="block w-full px-4 py-3 text-base text-center text-blue-600 bg-white border border-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    onClick={closeMobileMenu}
                  >
                    Sign Up
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default GV_USER_MENU;