import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import axios from 'axios';

// Define types based on requirements
interface CredibilityComponent {
  id: string;
  name: string;
  value: number;
  description: string;
  weight: number;
}

interface CredibilityHistoryItem {
  date: string;
  score: number;
  change_reason?: string;
}

interface CredibilityScoreResponse {
  current_score: number;
  components: CredibilityComponent[];
  history: CredibilityHistoryItem[];
  improvement_suggestions: string[];
  explanation: string;
  is_new_user: boolean;
}

// API function to fetch credibility data
const fetchCredibilityData = async (): Promise<CredibilityScoreResponse> => {
  const userId = useAppStore.getState().authentication_state.current_user?.id;
  
  if (!userId) {
    throw new Error('User not authenticated');
  }

  const response = await axios.get(
    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/users/${userId}/credibility`
  );
  
  return response.data;
};

const UV_CREDIBILITY_SCORE: React.FC = () => {
  // Individual Zustand selectors - CRITICAL for avoiding infinite loops
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const credibilityScore = useAppStore(state => state.user_profile_state.credibility_score);
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  
  // Local state for score comparison
  const [previousScore, setPreviousScore] = useState<number | null>(null);
  const [showImprovementTips, setShowImprovementTips] = useState(false);
  
  // Initialize query client
  const queryClient = useQueryClient();
  
  // Fetch credibility data with React Query
  const { 
    data, 
    isLoading, 
    isError,
    refetch 
  } = useQuery({
    queryKey: ['credibilityData', currentUser?.id],
    queryFn: fetchCredibilityData,
    staleTime: 60000,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: isAuthenticated && !!currentUser?.id
  });

  // Effect to track score changes
  useEffect(() => {
    if (data?.current_score !== undefined && previousScore !== null) {
      const scoreChange = data.current_score - previousScore;
      
      // Show improvement tips if score dropped significantly
      if (scoreChange < -5) {
        setShowImprovementTips(true);
        
        // Auto-hide after 30 seconds
        const timer = setTimeout(() => {
          setShowImprovementTips(false);
        }, 30000);
        
        return () => clearTimeout(timer);
      }
    }
    
    if (data?.current_score !== undefined) {
      setPreviousScore(data.current_score);
    }
  }, [data?.current_score, previousScore]);

  // Determine score category for styling and messaging
  const getScoreCategory = (score: number) => {
    if (score <= 20) return { category: 'beginner', label: 'Beginner', color: 'text-red-600 bg-red-50' };
    if (score <= 60) return { category: 'intermediate', label: 'Intermediate', color: 'text-yellow-600 bg-yellow-50' };
    return { category: 'expert', label: 'Expert', color: 'text-green-600 bg-green-50' };
  };

  // Get score category for current score
  const scoreCategory = data?.current_score ? getScoreCategory(data.current_score) : null;
  
  // Determine if user is new (based on whether they have a low score with explanation)
  const isNewUser = data?.is_new_user || (data?.current_score !== undefined && data.current_score <= 20 && !previousScore);

  // Loading state component
  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
      <p className="text-gray-600">Loading credibility score...</p>
    </div>
  );

  // Error state component
  const renderError = () => (
    <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
      <h3 className="text-lg font-medium text-red-900 mb-2">Error loading credibility data</h3>
      <p className="text-red-700 mb-4">We couldn't retrieve your credibility score. Please try again later.</p>
      <button
        onClick={() => refetch()}
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        Try Again
      </button>
    </div>
  );

  // Main content rendering
  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Breadcrumb navigation */}
          <nav className="flex items-center space-x-2 text-sm mb-8">
            <Link to="/" className="text-gray-600 hover:text-gray-900">Home</Link>
            <span className="text-gray-400">/</span>
            <Link to="/profile" className="text-gray-600 hover:text-gray-900">Profile</Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-900 font-medium">Credibility Score</span>
          </nav>

          {/* Header section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Credibility Score</h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Your reputation score reflects the reliability of your contributions to the EcoPulse community.
              Higher scores grant access to verification privileges and community trust.
            </p>
          </div>

          {/* Main content grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left column - Main score display */}
            <div className="lg:col-span-2">
              {/* Score card */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden mb-8">
                <div className="p-6 lg:p-8">
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-semibold text-gray-900 mb-2">Your Current Credibility Score</h2>
                    <p className="text-gray-600">
                      Based on {data?.components.length || 0} factors affecting your contribution reliability
                    </p>
                  </div>

                  {/* Score display */}
                  <div className="flex flex-col items-center mb-8">
                    {isLoading ? (
                      renderLoading()
                    ) : isError ? (
                      renderError()
                    ) : data ? (
                      <>
                        <div className="relative w-48 h-48 mb-4">
                          {/* Background circle */}
                          <svg className="w-full h-full" viewBox="0 0 100 100">
                            <circle
                              cx="50"
                              cy="50"
                              r="45"
                              fill="none"
                              stroke={scoreCategory?.color || 'gray'}
                              strokeWidth="8"
                              className="opacity-20"
                            />
                            {/* Score arc */}
                            <circle
                              cx="50"
                              cy="50"
                              r="45"
                              fill="none"
                              stroke={scoreCategory?.color || 'gray'}
                              strokeWidth="8"
                              strokeDasharray={`${data.current_score * 2.8} 283`}
                              strokeLinecap="round"
                              transform="rotate(-90 50 50)"
                            />
                          </svg>
                          {/* Score value */}
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className={`text-5xl font-bold ${scoreCategory?.color}`}>
                              {data.current_score}
                            </span>
                            <span className="text-sm font-medium text-gray-500 mt-1">
                              / 100
                            </span>
                          </div>
                        </div>

                        <div className="text-center">
                          <span className={`inline-block px-4 py-1 rounded-full text-sm font-medium ${scoreCategory?.color}`}>
                            {scoreCategory?.label} Contributor
                          </span>
                          <p className="mt-2 text-gray-600">
                            {scoreCategory?.category === 'beginner' && 
                              'As a new contributor, your score will increase as your observations are verified.'}
                            {scoreCategory?.category === 'intermediate' && 
                              'You\'re building a reliable reputation. Keep contributing accurate observations!'}
                            {scoreCategory?.category === 'expert' && 
                              'Your contributions are highly trusted by the community. Thank you!'}
                          </p>
                        </div>
                      </>
                    ) : null}
                  </div>

                  {/* Score explanation */}
                  {data && (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-6">
                      <h3 className="font-semibold text-gray-900 mb-2">Why this score?</h3>
                      <p className="text-gray-700">{data.explanation}</p>
                      
                      {isNewUser && (
                        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                          <h4 className="font-medium text-blue-800 mb-1">New Contributor Information</h4>
                          <p className="text-blue-700 text-sm">
                            All new users start with a score between 0-20. Your score will increase as:
                          </p>
                          <ul className="mt-2 list-disc list-inside text-blue-700 text-sm space-y-1">
                            <li>Your observations are verified by experts</li>
                            <li>Your identifications match expert validation</li>
                            <li>You participate in community verification</li>
                          </ul>
                        </div>
                      )}
                      
                      {showImprovementTips && data.improvement_suggestions.length > 0 && (
                        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md animate-fade-in">
                          <h4 className="font-medium text-yellow-800 mb-1">Improvement Opportunities</h4>
                          <ul className="mt-2 list-disc list-inside text-yellow-700 text-sm space-y-1">
                            {data.improvement_suggestions.map((suggestion, index) => (
                              <li key={index}>{suggestion}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Verification privileges info */}
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Verification Privileges</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className={`p-4 rounded-lg ${data?.current_score >= 20 ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                        <div className="flex items-center mb-2">
                          {data?.current_score >= 20 ? (
                            <span className="text-green-500 mr-2">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                          ) : (
                            <span className="text-gray-400 mr-2">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </span>
                          )}
                          <span className="font-medium">Tier 1 Verification</span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {data?.current_score >= 20 
                            ? 'You can verify community observations matching your expertise.' 
                            : 'Reach score 20+ to verify observations (current minimum: 5 verified observations)'}
                        </p>
                      </div>
                      
                      <div className={`p-4 rounded-lg ${data?.current_score >= 70 ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                        <div className="flex items-center mb-2">
                          {data?.current_score >= 70 ? (
                            <span className="text-green-500 mr-2">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                          ) : (
                            <span className="text-gray-400 mr-2">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </span>
                          )}
                          <span className="font-medium">Tier 2 Verification</span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {data?.current_score >= 70 
                            ? 'You can resolve disputes and validate expert-level observations.' 
                            : 'Reach score 70+ for expert verification privileges'}
                        </p>
                      </div>
                    </div>
                    
                    {data?.current_score < 20 && (
                      <div className="mt-4">
                        <Link
                          to="/verification-queue"
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium inline-flex items-center"
                        >
                          <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Learn how to increase your credibility score
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Score components breakdown */}
              {data?.components && data.components.length > 0 && (
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                  <div className="p-6 lg:p-8">
                    <h2 className="text-2xl font-semibold text-gray-900 mb-6">Score Components</h2>
                    
                    <div className="space-y-6">
                      {data.components.map((component) => (
                        <div key={component.id} className="border-b border-gray-200 pb-6 last:border-b-0 last:pb-0">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-medium text-gray-900">{component.name}</h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              component.value >= 70 ? 'bg-green-100 text-green-800' :
                              component.value >= 40 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {component.value}/100
                            </span>
                          </div>
                          
                          <p className="text-gray-600 mb-3 text-sm">{component.description}</p>
                          
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div 
                              className={`h-2.5 rounded-full ${
                                component.value >= 70 ? 'bg-green-600' :
                                component.value >= 40 ? 'bg-yellow-500' :
                                'bg-red-600'
                              }`}
                              style={{ width: `${component.value}%` }}
                            ></div>
                          </div>
                          
                          <div className="mt-2 text-xs text-gray-500 flex justify-between">
                            <span>Low impact ({component.weight}%)</span>
                            <span>High impact</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right column - History and Resources */}
            <div>
              {/* Historical trend card */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden mb-8">
                <div className="p-6 lg:p-8">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-6">Score History</h2>
                  
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  ) : isError ? (
                    <div className="text-center py-8 text-red-600 text-sm">
                      Failed to load history data
                    </div>
                  ) : data?.history && data.history.length > 0 ? (
                    <div className="space-y-6">
                      {data.history.slice(-5).reverse().map((item, index) => (
                        <div key={index} className="flex items-start">
                          <div className="flex-1">
                            <div className="flex justify-between items-baseline mb-1">
                              <span className="font-medium text-gray-900">{new Date(item.date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}</span>
                              <span className={`text-lg font-bold ${
                                index === 0 ? 'text-green-600' : 
                                item.score > data.history[index - 1]?.score ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {item.score}
                              </span>
                            </div>
                            
                            {item.change_reason && (
                              <p className="text-gray-600 text-sm">{item.change_reason}</p>
                            )}
                            
                            <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-blue-600" 
                                style={{ 
                                  width: `${item.score}%`,
                                  transition: 'width 0.3s ease-in-out'
                                }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <svg className="h-12 w-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No history yet</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Your score history will appear here as you contribute to EcoPulse.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Resources card */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="p-6 lg:p-8">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-6">Resources to Improve</h2>
                  
                  {isLoading ? (
                    <div className="space-y-4">
                      <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ) : isError ? null : data ? (
                    <div className="space-y-4">
                      {data.improvement_suggestions.length > 0 ? (
                        data.improvement_suggestions.map((suggestion, index) => (
                          <div key={index} className="flex items-start">
                            <div className="flex-shrink-0">
                              <svg className="h-5 w-5 text-blue-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <p className="ml-3 text-gray-700 text-sm">{suggestion}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-600 text-sm">
                          Great job! Your contributions are highly valued by the community.
                        </p>
                      )}
                      
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <h3 className="font-medium text-gray-900 mb-3">Recommended Actions</h3>
                        
                        <ul className="space-y-2">
                          <li>
                            <Link
                              to="/verification-queue"
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium inline-flex items-center"
                            >
                              <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                              </svg>
                              Verify observations to build credibility
                            </Link>
                          </li>
                          <li>
                            <Link
                              to="/observations"
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium inline-flex items-center"
                            >
                              <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                              </svg>
                              Submit accurate observations
                            </Link>
                          </li>
                          <li>
                            <Link
                              to="/disputes"
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium inline-flex items-center"
                            >
                              <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                              </svg>
                              Participate in dispute resolution
                            </Link>
                          </li>
                          <li>
                            <Link
                              to="/guides"
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium inline-flex items-center"
                            >
                              <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                              </svg>
                              Review habitat scoring guides
                            </Link>
                          </li>
                        </ul>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* Call to action section */}
          <div className="mt-12 bg-white rounded-xl shadow-lg border border-gray-100 p-6 lg:p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Build Your Credibility</h2>
            <p className="text-gray-600 max-w-3xl mx-auto mb-6">
              Your credibility score helps maintain the quality of data in EcoPulse. Higher scores 
              enable you to verify observations, resolve disputes, and gain community trust.
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link
                to="/submit"
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Submit Observation
              </Link>
              <Link
                to="/verification-queue"
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                Verify Observations
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_CREDIBILITY_SCORE;