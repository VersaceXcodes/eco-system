import React, { useEffect } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  useLocation 
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';

/* Imported Views */
import GV_NAV from '@/components/views/GV_NAV.tsx';
import GV_FOOTER from '@/components/views/GV_FOOTER.tsx';
import GV_SEARCH from '@/components/views/GV_SEARCH.tsx';
import GV_NOTIFICATIONS from '@/components/views/GV_NOTIFICATIONS.tsx';
import GV_USER_MENU from '@/components/views/GV_USER_MENU.tsx';
import UV_AUTH_SIGNUP from '@/components/views/UV_AUTH_SIGNUP.tsx';
import UV_AUTH_LOGIN from '@/components/views/UV_AUTH_LOGIN.tsx';
import UV_AUTH_VERIFICATION from '@/components/views/UV_AUTH_VERIFICATION.tsx';
import UV_PROFILE_SETUP from '@/components/views/UV_PROFILE_SETUP.tsx';
import UV_PROFILE_SETTINGS from '@/components/views/UV_PROFILE_SETTINGS.tsx';
import UV_PROFILE_PRIVACY from '@/components/views/UV_PROFILE_PRIVACY.tsx';
import UV_OBS_SUBMISSION_WIZARD from '@/components/views/UV_OBS_SUBMISSION_WIZARD.tsx';
import UV_OBS_ID_ASSISTANT from '@/components/views/UV_OBS_ID_ASSISTANT.tsx';
import UV_HABITAT_SCORING from '@/components/views/UV_HABITAT_SCORING.tsx';
import UV_BATCH_SUBMISSION from '@/components/views/UV_BATCH_SUBMISSION.tsx';
import UV_MAP_VIEW from '@/components/views/UV_MAP_VIEW.tsx';
import UV_DASHBOARD from '@/components/views/UV_DASHBOARD.tsx';
import UV_PROJECT_FEED from '@/components/views/UV_PROJECT_FEED.tsx';
import UV_OBS_DETAIL from '@/components/views/UV_OBS_DETAIL.tsx';
import UV_VERIFICATION_QUEUE from '@/components/views/UV_VERIFICATION_QUEUE.tsx';
import UV_DISPUTE_RESOLUTION from '@/components/views/UV_DISPUTE_RESOLUTION.tsx';
import UV_CREDIBILITY_SCORE from '@/components/views/UV_CREDIBILITY_SCORE.tsx';
import UV_SPECIES_SPOTLIGHT from '@/components/views/UV_SPECIES_SPOTLIGHT.tsx';
import UV_HABITAT_GUIDE from '@/components/views/UV_HABITAT_GUIDE.tsx';
import UV_OBS_EXPIRATION from '@/components/views/UV_OBS_EXPIRATION.tsx';
import UV_GEOFENCE_WARNING from '@/components/views/UV_GEOFENCE_WARNING.tsx';
import UV_TEMPORAL_VALIDATION from '@/components/views/UV_TEMPORAL_VALIDATION.tsx';
import UV_CONFLICT_DETECTION from '@/components/views/UV_CONFLICT_DETECTION.tsx';
import UV_ERROR_STATES from '@/components/views/UV_ERROR_STATES.tsx';
import UV_HELP_CENTER from '@/components/views/UV_HELP_CENTER.tsx';
import UV_TERMS_PRIVACY from '@/components/views/UV_TERMS_PRIVACY.tsx';
import UV_OFFLINE_MODE from '@/components/views/UV_OFFLINE_MODE.tsx';

/* Components */
const LoadingSpinner: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

// CRITICAL: Correct Zustand selector pattern - NO object destructuring
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const isLoading = useAppStore(state => state.authentication_state.authentication_status.is_loading);
  
  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

// Determine if current route is an auth route
const useIsAuthRoute = () => {
  const location = useLocation();
  const authRoutes = ['/login', '/signup', '/verify-email', '/forgot-password', '/reset-password'];
  return authRoutes.some(route => location.pathname.startsWith(route));
};

const App: React.FC = () => {
  const isLoading = useAppStore(state => state.authentication_state.authentication_status.is_loading);
  const initializeAuth = useAppStore(state => state.initialize_auth);
  
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);
  
  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  // Create query client with standard configuration
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        retry: 1,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="App min-h-screen flex flex-col bg-gray-50">
          {/* Main Content Area */}
          <main className="flex-1">
            <Routes>
              {/* Public Auth Routes - No navigation components */}
              <Route path="/signup" element={<UV_AUTH_SIGNUP />} />
              <Route path="/login" element={<UV_AUTH_LOGIN />} />
              <Route path="/verify-email" element={<UV_AUTH_VERIFICATION />} />
              <Route path="/forgot-password" element={<UV_AUTH_LOGIN />} /> {/* Using login as placeholder */}
              <Route path="/reset-password" element={<UV_AUTH_LOGIN />} /> {/* Using login as placeholder */}
              <Route path="/terms-privacy" element={<UV_TERMS_PRIVACY />} />
              <Route path="/help-center" element={<UV_HELP_CENTER />} />
              
              {/* Protected Application Routes */}
              <Route 
                path="/" 
                element={
                  <ProtectedRoute>
                    <UV_DASHBOARD />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/map" 
                element={
                  <ProtectedRoute>
                    <UV_MAP_VIEW />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/submit" 
                element={
                  <ProtectedRoute>
                    <UV_OBS_SUBMISSION_WIZARD />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/verification-queue" 
                element={
                  <ProtectedRoute>
                    <UV_VERIFICATION_QUEUE />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/projects" 
                element={
                  <ProtectedRoute>
                    <UV_PROJECT_FEED />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/observation/:observation_id" 
                element={
                  <ProtectedRoute>
                    <UV_OBS_DETAIL />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/species" 
                element={
                  <ProtectedRoute>
                    <UV_SPECIES_SPOTLIGHT />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/guides" 
                element={
                  <ProtectedRoute>
                    <UV_HABITAT_GUIDE />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/profile" 
                element={
                  <ProtectedRoute>
                    <UV_PROFILE_SETTINGS />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/batch-submit" 
                element={
                  <ProtectedRoute>
                    <UV_BATCH_SUBMISSION />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/disputes" 
                element={
                  <ProtectedRoute>
                    <UV_DISPUTE_RESOLUTION />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/habitat-scoring" 
                element={
                  <ProtectedRoute>
                    <UV_HABITAT_SCORING />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/credibility-score" 
                element={
                  <ProtectedRoute>
                    <UV_CREDIBILITY_SCORE />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/observation-expiration" 
                element={
                  <ProtectedRoute>
                    <UV_OBS_EXPIRATION />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/geofence-warning" 
                element={
                  <ProtectedRoute>
                    <UV_GEOFENCE_WARNING />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/temporal-validation" 
                element={
                  <ProtectedRoute>
                    <UV_TEMPORAL_VALIDATION />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/conflict-detection" 
                element={
                  <ProtectedRoute>
                    <UV_CONFLICT_DETECTION />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/error-states" 
                element={
                  <ProtectedRoute>
                    <UV_ERROR_STATES />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/offline-mode" 
                element={
                  <ProtectedRoute>
                    <UV_OFFLINE_MODE />
                  </ProtectedRoute>
                } 
              />
              
              {/* Catch-all route */}
              <Route 
                path="*" 
                element={
                  <Navigate to={isAuthenticated ? "/" : "/login"} replace />
                } 
              />
            </Routes>
          </main>
          
          {/* Global Components Overlay */}
          <GV_SEARCH />
          <GV_NOTIFICATIONS />
          <GV_USER_MENU />
          
          {/* Footer - Always visible */}
          <GV_FOOTER />
          
          {/* Conditional Navigation */}
          <div className="fixed top-0 left-0 right-0 z-40">
            <ProtectedRoute>
              <GV_NAV />
            </ProtectedRoute>
          </div>
        </div>
      </Router>
    </QueryClientProvider>
  );
};

export default App;