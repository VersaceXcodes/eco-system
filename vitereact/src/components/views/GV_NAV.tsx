import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAppStore } from '@/store/main';

const GV_NAV: React.FC = () => {
  // CRITICAL: Individual selectors to prevent infinite loops
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const notificationQueue = useAppStore(state => state.ui_state.notification_queue);
  const activeRoute = useAppStore(state => state.navigation_state.current_route);
  const openSearchPanel = useAppStore(state => state.open_search_panel);
  const openUserMenu = useAppStore(state => state.open_user_menu);
  const navigateToRoute = useAppStore(state => state.navigate_to_route);
  const logoutUser = useAppStore(state => state.logout_user);

  const notificationUnreadCount = notificationQueue.filter(n => !n.read).length;
  
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openSearchPanel();
      }
      if (e.altKey && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        openUserMenu();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openSearchPanel, openUserMenu]);

  // Navigation items configuration
  const navItems = [
    { 
      label: 'Dashboard', 
      path: '/', 
      icon: '📊',
      active: activeRoute === '/' || activeRoute.startsWith('/dashboard')
    },
    { 
      label: 'Map', 
      path: '/map', 
      icon: '🗺️',
      active: activeRoute === '/map' || activeRoute.startsWith('/map')
    },
    { 
      label: 'Feed', 
      path: '/projects', 
      icon: '📰',
      active: activeRoute === '/projects' || activeRoute.startsWith('/projects')
    },
    { 
      label: 'Submit', 
      path: '/submit', 
      icon: '📸',
      active: activeRoute === '/submit' || activeRoute.startsWith('/submit')
    }
  ];

  // Determine if current route matches a navigation item
  const isActive = (path: string): boolean => {
    if (path === '/' && (activeRoute === '/' || activeRoute === '')) return true;
    return activeRoute.startsWith(path);
  };

  const handleNavigation = (path: string) => {
    navigateToRoute(path);
    // Close mobile menu after navigation
    setIsMobileMenuOpen(false);
  };

  const handleLogout = () => {
    logoutUser();
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <nav 
        className="fixed top-0 left-0 right-0 z-40 bg-white shadow-sm border-b border-gray-200"
        aria-label="Main navigation"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo and Desktop Navigation */}
            <div className="flex items-center">
              <Link 
                to="/" 
                className="flex-shrink-0 flex items-center"
                aria-label="EcoPulse Home"
              >
                <span className="text-2xl font-bold text-blue-600">EcoPulse</span>
              </Link>
              
              {/* Desktop Navigation Items */}
              <div className="hidden md:ml-8 md:flex md:items-center md:space-x-1">
                {navItems.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => handleNavigation(item.path)}
                    className={`${
                      isActive(item.path)
                        ? 'bg-blue-50 text-blue-600 font-medium'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    } px-4 py-2 rounded-md text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                    aria-current={isActive(item.path) ? 'page' : undefined}
                  >
                    <span className="flex items-center">
                      <span className="mr-2">{item.icon}</span>
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Search, Notifications, User Menu */}
            <div className="flex items-center space-x-4">
              {/* Search Icon */}
              <button
                onClick={() => openSearchPanel()}
                className="p-2 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                aria-label="Open search (Ctrl+K)"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>

              {/* Notifications */}
              <button
                onClick={() => {/* Would trigger notification panel */}}
                className="p-2 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors relative"
                aria-label={`Notifications (${notificationUnreadCount})`}
                aria-live="polite"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {notificationUnreadCount > 0 && (
                  <span 
                    className="absolute top-1 right-1 block h-4 w-4 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2"
                    aria-hidden="true"
                  >
                    {notificationUnreadCount}
                  </span>
                )}
              </button>

              {/* User Menu */}
              {isAuthenticated && currentUser ? (
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => openUserMenu()}
                    className="flex items-center space-x-2 p-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    aria-label="Open user menu (Alt+U)"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-800 font-medium">
                      {currentUser.full_name?.charAt(0) || 'U'}
                    </div>
                    <span className="hidden md:block text-sm font-medium text-gray-700">
                      {currentUser.full_name || 'User'}
                    </span>
                  </button>
                </div>
              ) : (
                <div className="hidden md:block">
                  <Link
                    to="/login"
                    className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                  >
                    Sign in
                  </Link>
                </div>
              )}

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                aria-expanded={isMobileMenuOpen}
                aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              >
                <svg 
                  className={`${
                    isMobileMenuOpen ? 'hidden' : 'block'
                  } h-6 w-6`} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <svg 
                  className={`${
                    isMobileMenuOpen ? 'block' : 'hidden'
                  } h-6 w-6`} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div 
            className="md:hidden absolute top-16 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 transition-all duration-300 ease-in-out"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
          >
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {navItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => handleNavigation(item.path)}
                  className={`${
                    isActive(item.path)
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  } block px-4 py-2 rounded-md w-full text-left transition-colors duration-200`}
                  aria-current={isActive(item.path) ? 'page' : undefined}
                >
                  <span className="flex items-center">
                    <span className="mr-3 text-xl">{item.icon}</span>
                    {item.label}
                  </span>
                </button>
              ))}
              
              {/* Mobile User Menu Items */}
              {isAuthenticated && currentUser ? (
                <div className="pt-3 border-t border-gray-200 mt-2">
                  <div className="px-4 py-2 text-gray-500 text-sm">
                    Signed in as
                  </div>
                  <div className="px-4 py-2 font-medium text-gray-900">
                    {currentUser.full_name || 'User'}
                  </div>
                  
                  <Link
                    to="/profile"
                    className="block px-4 py-2 text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-md transition-colors"
                  >
                    Profile
                  </Link>
                  <Link
                    to="/profile/settings"
                    className="block px-4 py-2 text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-md transition-colors"
                  >
                    Settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="block w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 hover:text-red-700 rounded-md transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <div className="pt-3 border-t border-gray-200 mt-2">
                  <Link
                    to="/login"
                    className="block px-4 py-2 text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-md transition-colors"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/signup"
                    className="block px-4 py-2 text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-md transition-colors"
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>
      
      {/* Overlay to close mobile menu when clicking outside */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black bg-opacity-25 md:hidden"
          aria-hidden="true"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
};

export default GV_NAV;