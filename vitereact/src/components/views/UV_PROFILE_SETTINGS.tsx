import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import axios from 'axios';

// Define types based on API schemas
interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  expertise_level: 'beginner' | 'intermediate' | 'expert';
  primary_location: {
    lat: number;
    lng: number;
    address: string;
  } | null;
  interests: string[];
  credibility_score: number;
  data_privacy_settings: {
    share_anonymized: boolean;
    private_observations_visible: boolean;
  };
}

interface UpdateUserProfileInput {
  full_name?: string;
  expertise_level?: 'beginner' | 'intermediate' | 'expert';
  primary_location?: {
    lat: number;
    lng: number;
    address: string;
  };
  interests?: string[];
  data_privacy_settings?: {
    share_anonymized: boolean;
    private_observations_visible: boolean;
  };
}

// API functions
const fetchUserProfile = async (userId: string): Promise<UserProfile> => {
  const response = await axios.get(`/api/users/${userId}`);
  return response.data;
};

const updateUserProfile = async ({
  userId,
  updates
}: {
  userId: string;
  updates: UpdateUserProfileInput;
}): Promise<UserProfile> => {
  const response = await axios.patch(`/api/users/${userId}`, updates);
  return response.data;
};

// Constants
const EXPERTISE_LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'expert', label: 'Expert' }
] as const;

const INTEREST_TAGS = [
  'birds', 'insects', 'mammals', 'reptiles', 'amphibians',
  'plants', 'fungi', 'marine', 'freshwater', 'forest',
  'grassland', 'wetland', 'desert', 'urban', 'coastal'
];

const UV_PROFILE_SETTINGS: React.FC = () => {
  // Zustand store access (individual selectors only)
  const userId = useAppStore(state => state.authentication_state.current_user?.id);
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  
  // Local state for UI
  const [activeSection, setActiveSection] = useState<'account' | 'location' | 'expertise' | 'interests' | 'privacy'>('account');
  const [showExpertiseConfirm, setShowExpertiseConfirm] = useState(false);
  const [pendingExpertiseChange, setPendingExpertiseChange] = useState<'beginner' | 'intermediate' | 'expert' | null>(null);
  
  // Form state for sections
  const [accountForm, setAccountForm] = useState({
    full_name: '',
    email: ''
  });
  const [locationForm, setLocationForm] = useState({
    lat: 0,
    lng: 0,
    address: '',
    location_precision_meters: 500
  });
  const [expertiseForm, setExpertiseForm] = useState({
    expertise_level: 'beginner' as const
  });
  const [interestsForm, setInterestsForm] = useState({
    interests: [] as string[],
    searchQuery: ''
  });
  const [privacyForm, setPrivacyForm] = useState({
    share_anonymized: true,
    private_observations_visible: true
  });
  
  // Navigation
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Fetch user profile
  const { data: userProfile, isLoading, error } = useQuery<UserProfile, Error>({
    queryKey: ['userProfile', userId],
    queryFn: () => fetchUserProfile(userId || ''),
    enabled: !!userId && isAuthenticated,
    staleTime: 60000,
    refetchOnWindowFocus: false
  });

  // Update profile mutation
  const updateProfileMutation = useMutation<UserProfile, Error, UpdateUserProfileInput>({
    mutationFn: (updates) => updateUserProfile({ userId: userId || '', updates }),
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(['userProfile', userId], updatedProfile);
      
      // Update Zustand store if needed (implementation depends on store structure)
      // Example: updateUserInStore(updatedProfile);
      
      // Reset form states to new values
      if (activeSection === 'account') {
        setAccountForm({
          full_name: updatedProfile.full_name,
          email: updatedProfile.email
        });
      } else if (activeSection === 'location' && updatedProfile.primary_location) {
        setLocationForm(prev => ({
          ...prev,
          lat: updatedProfile.primary_location.lat,
          lng: updatedProfile.primary_location.lng,
          address: updatedProfile.primary_location.address
        }));
      } else if (activeSection === 'expertise') {
        setExpertiseForm({ expertise_level: updatedProfile.expertise_level });
      } else if (activeSection === 'interests') {
        setInterestsForm(prev => ({ ...prev, interests: updatedProfile.interests }));
      } else if (activeSection === 'privacy') {
        setPrivacyForm({
          share_anonymized: updatedProfile.data_privacy_settings.share_anonymized,
          private_observations_visible: updatedProfile.data_privacy_settings.private_observations_visible
        });
      }
    },
    onError: (error) => {
      console.error('Profile update failed:', error);
      // Error handling would be implemented here
    }
  });

  // Initialize form states when profile loads
  useEffect(() => {
    if (userProfile) {
      // Account section
      setAccountForm({
        full_name: userProfile.full_name,
        email: userProfile.email
      });
      
      // Location section
      if (userProfile.primary_location) {
        setLocationForm({
          lat: userProfile.primary_location.lat,
          lng: userProfile.primary_location.lng,
          address: userProfile.primary_location.address,
          location_precision_meters: 500 // Default buffer
        });
      }
      
      // Expertise section
      setExpertiseForm({
        expertise_level: userProfile.expertise_level
      });
      
      // Interests section
      setInterestsForm(prev => ({
        ...prev,
        interests: userProfile.interests
      }));
      
      // Privacy section
      setPrivacyForm({
        share_anonymized: userProfile.data_privacy_settings.share_anonymized,
        private_observations_visible: userProfile.data_privacy_settings.private_observations_visible
      });
    }
  }, [userProfile]);

  // Handle account form changes
  const handleAccountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAccountForm(prev => ({ ...prev, [name]: value }));
  };

  // Handle location form changes
  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLocationForm(prev => ({ ...prev, [name]: value }));
  };

  // Handle expertise change with confirmation
  const handleExpertiseChange = (newLevel: 'beginner' | 'intermediate' | 'expert') => {
    if (expertiseForm.expertise_level !== newLevel) {
      if (
        expertiseForm.expertise_level === 'expert' && 
        newLevel !== 'expert' &&
        userProfile?.credibility_score && 
        userProfile.credibility_score < 70
      ) {
        // Only show confirmation if lowering from expert
        setPendingExpertiseChange(newLevel);
        setShowExpertiseConfirm(true);
      } else {
        // No confirmation needed
        setExpertiseForm({ expertise_level: newLevel });
      }
    }
  };

  // Handle interest search
  const filteredInterests = INTEREST_TAGS.filter(tag =>
    tag.toLowerCase().includes(interestsForm.searchQuery.toLowerCase())
  );

  // Toggle interest selection
  const toggleInterest = (interest: string) => {
    setInterestsForm(prev => {
      const isSelected = prev.interests.includes(interest);
      return {
        ...prev,
        interests: isSelected
          ? prev.interests.filter(i => i !== interest)
          : [...prev.interests, interest]
      };
    });
  };

  // Handle privacy settings change
  const handlePrivacyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setPrivacyForm(prev => ({ ...prev, [name]: checked }));
  };

  // Save account changes
  const handleSaveAccount = () => {
    updateProfileMutation.mutate({
      full_name: accountForm.full_name,
      email: accountForm.email
    });
  };

  // Save location changes
  const handleSaveLocation = () => {
    updateProfileMutation.mutate({
      primary_location: {
        lat: locationForm.lat,
        lng: locationForm.lng,
        address: locationForm.address
      }
    });
  };

  // Confirm and save expertise change
  const confirmExpertiseChange = () => {
    if (pendingExpertiseChange) {
      setExpertiseForm({ expertise_level: pendingExpertiseChange });
      updateProfileMutation.mutate({
        expertise_level: pendingExpertiseChange
      });
      setShowExpertiseConfirm(false);
      setPendingExpertiseChange(null);
    }
  };

  // Save interest changes
  const handleSaveInterests = () => {
    updateProfileMutation.mutate({
      interests: interestsForm.interests
    });
  };

  // Save privacy changes
  const handleSavePrivacy = () => {
    updateProfileMutation.mutate({
      data_privacy_settings: {
        share_anonymized: privacyForm.share_anonymized,
        private_observations_visible: privacyForm.private_observations_visible
      }
    });
  };

  // Reset form to original values
  const handleCancel = () => {
    if (userProfile) {
      if (activeSection === 'account') {
        setAccountForm({
          full_name: userProfile.full_name,
          email: userProfile.email
        });
      } else if (activeSection === 'location' && userProfile.primary_location) {
        setLocationForm({
          lat: userProfile.primary_location.lat,
          lng: userProfile.primary_location.lng,
          address: userProfile.primary_location.address,
          location_precision_meters: 500
        });
      } else if (activeSection === 'expertise') {
        setExpertiseForm({ expertise_level: userProfile.expertise_level });
      } else if (activeSection === 'interests') {
        setInterestsForm(prev => ({ ...prev, interests: userProfile.interests }));
      } else if (activeSection === 'privacy') {
        setPrivacyForm({
          share_anonymized: userProfile.data_privacy_settings.share_anonymized,
          private_observations_visible: userProfile.data_privacy_settings.private_observations_visible
        });
      }
    }
  };

  // Handle geolocation
  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocationForm(prev => ({
            ...prev,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            address: 'Current location'
          }));
        },
        (error) => {
          console.error('Geolocation error:', error);
          // User would see appropriate error message
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      console.error('Geolocation not supported');
      // User would see browser compatibility message
    }
  };

  if (!isAuthenticated) {
    return null; // Redirect handled by effect, but prevent rendering
  }

  if (isLoading || !userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="text-red-600 text-lg font-medium">Error loading profile</div>
        <button 
          onClick={() => navigate('/')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Main Container */}
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* Header */}
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
              <Link 
                to="/" 
                className="text-gray-600 hover:text-gray-900 flex items-center"
              >
                <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                </svg>
                Back to Dashboard
              </Link>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 sm:px-0">
            {/* Credibility Score Banner */}
            <div className="mb-8 bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="text-white">
                    <h2 className="text-xl font-semibold">Credibility Score</h2>
                    <p className="mt-1 opacity-90">Your verification reliability score</p>
                  </div>
                  <div className="text-3xl font-bold text-white bg-blue-700 bg-opacity-30 px-4 py-2 rounded-lg">
                    {userProfile.credibility_score}/100
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" 
                    style={{ width: `${userProfile.credibility_score}%` }}
                  ></div>
                </div>
                <p className="mt-2 text-sm text-gray-600">
                  {userProfile.credibility_score >= 80 
                    ? 'Excellent credibility - your verifications carry significant weight' 
                    : userProfile.credibility_score >= 60
                      ? 'Good credibility - your verifications are generally reliable'
                      : 'Credibility could be improved - verify more observations to increase your score'}
                </p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="mb-6 border-b border-gray-200">
              <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                {['account', 'location', 'expertise', 'interests', 'privacy'].map((section) => (
                  <button
                    key={section}
                    onClick={() => setActiveSection(section as typeof activeSection)}
                    className={`${
                      activeSection === section
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200`}
                  >
                    {section.charAt(0).toUpperCase() + section.slice(1)}
                  </button>
                ))}
              </nav>
            </div>

            {/* Account Section */}
            {activeSection === 'account' && (
              <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Account Details</h2>
                  <p className="mt-1 text-sm text-gray-500">Manage your personal information</p>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        id="full_name"
                        name="full_name"
                        value={accountForm.full_name}
                        onChange={handleAccountChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                        placeholder="Your full name"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={accountForm.email}
                        onChange={handleAccountChange}
                        disabled
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Email can only be changed through account verification
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={updateProfileMutation.isPending}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveAccount}
                      disabled={updateProfileMutation.isPending || 
                               accountForm.full_name === userProfile.full_name}
                      className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                    >
                      {updateProfileMutation.isPending ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        </span>
                      ) : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Location Section */}
            {activeSection === 'location' && (
              <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Location Preferences</h2>
                  <p className="mt-1 text-sm text-gray-500">Set your primary location and privacy settings</p>
                </div>
                <div className="p-6">
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Primary Location
                    </label>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="md:col-span-2">
                        <input
                          type="text"
                          value={locationForm.address}
                          readOnly
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                          placeholder="Location will appear here"
                        />
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={handleUseCurrentLocation}
                          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                          </svg>
                          Use Current Location
                        </button>
                      </div>
                    </div>
                    
                    <p className="text-xs text-gray-500">
                      Your location helps provide relevant species suggestions and affects data quality.
                      All location data is anonymized and blurred by default in sensitive zones.
                    </p>
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Location Precision Buffer
                    </label>
                    <input
                      type="range"
                      min="100"
                      max="1000"
                      step="100"
                      value={locationForm.location_precision_meters}
                      onChange={(e) => setLocationForm(prev => ({
                        ...prev,
                        location_precision_meters: Number(e.target.value)
                      }))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="flex justify-between mt-1 text-xs text-gray-500">
                      <span>100m (High Precision)</span>
                      <span>{locationForm.location_precision_meters}m</span>
                      <span>1000m (Maximum Privacy)</span>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      Larger buffers provide more privacy by obscuring your exact location.
                      Recommended: 500m for general use, 1000m for sensitive ecological zones.
                    </p>
                  </div>

                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={updateProfileMutation.isPending}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveLocation}
                      disabled={updateProfileMutation.isPending}
                      className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                    >
                      {updateProfileMutation.isPending ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        </span>
                      ) : 'Save Location Settings'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Expertise Section */}
            {activeSection === 'expertise' && (
              <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Expertise Level</h2>
                  <p className="mt-1 text-sm text-gray-500">Set your knowledge level for species identification</p>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {EXPERTISE_LEVELS.map((level) => (
                      <div
                        key={level.value}
                        className={`rounded-lg border p-4 cursor-pointer transition-all duration-200 ${
                          expertiseForm.expertise_level === level.value
                            ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => handleExpertiseChange(level.value)}
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-gray-900 capitalize">{level.label}</h3>
                          {expertiseForm.expertise_level === level.value && (
                            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        
                        {level.value === 'beginner' && (
                          <p className="mt-2 text-sm text-gray-600">
                            Basic knowledge of common species. Suitable for casual observations.
                          </p>
                        )}
                        {level.value === 'intermediate' && (
                          <p className="mt-2 text-sm text-gray-600">
                            Good knowledge of regional species. Can identify most common organisms.
                          </p>
                        )}
                        {level.value === 'expert' && (
                          <p className="mt-2 text-sm text-gray-600">
                            Specialized knowledge. Can identify rare species and taxonomic variations.
                          </p>
                        )}
                        
                        {userProfile.credibility_score < 70 && level.value === 'expert' && (
                          <p className="mt-2 text-xs text-red-600">
                            Requires credibility score of 70+ to maintain expert status
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-6">
                    <h3 className="text-sm font-medium text-gray-900 mb-2">What this means</h3>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                      <li>
                        <strong>Beginner:</strong> Get basic ID suggestions, limited verification capabilities
                      </li>
                      <li>
                        <strong>Intermediate:</strong> Access to more detailed ID tools, can verify beginner observations
                      </li>
                      <li>
                        <strong>Expert:</strong> Full verification privileges, access to expert resources and reference materials
                      </li>
                    </ul>
                  </div>

                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={updateProfileMutation.isPending}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveLocation}
                      disabled={updateProfileMutation.isPending || 
                               expertiseForm.expertise_level === userProfile.expertise_level}
                      className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                    >
                      {updateProfileMutation.isPending ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        </span>
                      ) : 'Save Expertise Level'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Interests Section */}
            {activeSection === 'interests' && (
              <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Interest Tags</h2>
                  <p className="mt-1 text-sm text-gray-500">Select your areas of interest for personalized content</p>
                </div>
                <div className="p-6">
                  <div className="mb-6">
                    <label htmlFor="interest-search" className="block text-sm font-medium text-gray-700 mb-2">
                      Find Interests
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        id="interest-search"
                        value={interestsForm.searchQuery}
                        onChange={(e) => setInterestsForm(prev => ({ ...prev, searchQuery: e.target.value }))}
                        className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                        placeholder="Search interests..."
                      />
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                    {filteredInterests.map((interest) => {
                      const isSelected = interestsForm.interests.includes(interest);
                      return (
                        <button
                          key={interest}
                          type="button"
                          onClick={() => toggleInterest(interest)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            isSelected
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {interest.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2 mb-6">
                    {interestsForm.interests.map((interest) => (
                      <span
                        key={interest}
                        className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                      >
                        {interest.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        <button
                          type="button"
                          onClick={() => toggleInterest(interest)}
                          className="ml-2 inline-flex text-blue-600 hover:text-blue-800"
                        >
                          <span className="sr-only">Remove interest</span>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={updateProfileMutation.isPending}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveInterests}
                      disabled={updateProfileMutation.isPending}
                      className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                    >
                      {updateProfileMutation.isPending ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        </span>
                      ) : 'Save Interest Tags'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Privacy Section */}
            {activeSection === 'privacy' && (
              <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Privacy Settings</h2>
                  <p className="mt-1 text-sm text-gray-500">Control how your data is shared and displayed</p>
                </div>
                <div className="p-6">
                  <div className="space-y-6">
                    <div className="flex items-start p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center h-5">
                        <input
                          id="share_anonymized"
                          name="share_anonymized"
                          type="checkbox"
                          checked={privacyForm.share_anonymized}
                          onChange={handlePrivacyChange}
                          className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                        />
                      </div>
                      <div className="ml-3">
                        <label htmlFor="share_anonymized" className="font-medium text-gray-700">
                          Share anonymized data
                        </label>
                        <p className="text-sm text-gray-500">
                          Allow researchers to use your observations in aggregate studies while protecting your identity
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center h-5">
                        <input
                          id="private_observations_visible"
                          name="private_observations_visible"
                          type="checkbox"
                          checked={privacyForm.private_observations_visible}
                          onChange={handlePrivacyChange}
                          className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                        />
                      </div>
                      <div className="ml-3">
                        <label htmlFor="private_observations_visible" className="font-medium text-gray-700">
                          Keep private observations visible to me
                        </label>
                        <p className="text-sm text-gray-500">
                          Private observations will only be visible in your personal dashboard and not in public feeds
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={handleCancel}
                        disabled={updateProfileMutation.isPending}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSavePrivacy}
                        disabled={updateProfileMutation.isPending}
                        className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                      >
                        {updateProfileMutation.isPending ? (
                          <span className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Saving...
                          </span>
                        ) : 'Save Privacy Settings'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Expertise Change Confirmation Modal */}
            {showExpertiseConfirm && (
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg max-w-md w-full p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Confirm Expertise Level Change</h3>
                  <p className="text-gray-600 mb-4">
                    Lowering your expertise level from Expert will reduce your verification privileges. 
                    Are you sure you want to proceed?
                  </p>
                  <p className="text-sm text-yellow-600 bg-yellow-50 p-3 rounded-md mb-4">
                    <strong>Note:</strong> Your credibility score ({userProfile.credibility_score}/100) is below the recommended threshold of 70 for expert status. 
                    This change may affect your ability to verify observations.
                  </p>
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowExpertiseConfirm(false);
                        setPendingExpertiseChange(null);
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={confirmExpertiseChange}
                      className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700"
                    >
                      Confirm Change
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 mt-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <p className="text-sm text-gray-500 mb-2 md:mb-0">
                &copy; {new Date().getFullYear()} EcoPulse. All rights reserved.
              </p>
              <div className="flex space-x-4">
                <Link to="/terms-privacy" className="text-sm text-gray-500 hover:text-gray-700">
                  Terms of Service
                </Link>
                <Link to="/help-center" className="text-sm text-gray-500 hover:text-gray-700">
                  Help Center
                </Link>
                <Link to="/profile" className="text-sm text-gray-500 hover:text-gray-700">
                  Contact Support
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default UV_PROFILE_SETTINGS;