import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import { 
  MapPinIcon, 
  BookmarkIcon, 
  ShareIcon, 
  ArrowRightIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Zod Schemas for API responses
const speciesFactSchema = z.object({
  id: z.string(),
  common_name: z.string(),
  scientific_name: z.string(),
  facts: z.array(z.string()),
  image_url: z.string().url(),
  seasonality: z.string().optional(),
  habitat_type: z.string().optional(),
  conservation_status: z.string().optional(),
  is_local_relevant: z.boolean().optional()
});

const localSightingSchema = z.object({
  observation_id: z.string(),
  location: z.object({
    lat: z.number(),
    lng: z.number()
  }),
  timestamp: z.string().datetime(),
  user_id: z.string().optional(),
  verification_status: z.enum(['pending', 'verified', 'disputed']).optional()
});

const similarSpeciesSchema = z.object({
  id: z.string(),
  common_name: z.string(),
  scientific_name: z.string(),
  distinguishing_features: z.string(),
  image_url: z.string().url().optional()
});

const speciesSpotlightResponseSchema = z.object({
  species: speciesFactSchema,
  local_sightings: z.array(localSightingSchema),
  similar_species: z.array(similarSpeciesSchema),
  seasonal_relevance: z.string().optional(),
  location_relevance: z.boolean().optional()
});

// TypeScript types
type SpeciesFact = z.infer<typeof speciesFactSchema>;
type LocalSighting = z.infer<typeof localSightingSchema>;
type SimilarSpecies = z.infer<typeof similarSpeciesSchema>;
type SpeciesSpotlightResponse = z.infer<typeof speciesSpotlightResponseSchema>;

// Helper function to get species ID from URL params or default to spotlight
const getSpeciesId = (params: { species_id?: string }, location: { search: string }) => {
  const searchParams = new URLSearchParams(location.search);
  return params.species_id || searchParams.get('species_id') || 'daily';
};

const UV_SPECIES_SPOTLIGHT: React.FC = () => {
  // Access URL parameters and navigation
  const { species_id: urlSpeciesId } = useParams<{ species_id?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Zustand store access (individual selectors only!)
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const saveSpeciesSpotlight = useAppStore(state => state.save_species_spotlight);
  const removeSavedSpotlight = useAppStore(state => state.remove_saved_spotlight);
  
  // Determine species ID to fetch
  const speciesId = useMemo(() => getSpeciesId({ species_id: urlSpeciesId }, location), [urlSpeciesId, location]);
  
  // State for UI interactions
  const [activeTab, setActiveTab] = useState<'facts' | 'map' | 'comparison'>('facts');
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Query client for cache management
  const queryClient = useQueryClient();
  
  // Fetch species spotlight data
  const { 
    data: spotlightData, 
    isLoading, 
    isError,
    error,
    refetch 
  } = useQuery<SpeciesSpotlightResponse, Error>({
    queryKey: ['species-spotlight', speciesId],
    queryFn: async () => {
      const endpoint = speciesId === 'daily' 
        ? `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/species/spotlight`
        : `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/species/${speciesId}`;
      
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch species spotlight: ${response.status}`);
      }
      
      const data = await response.json();
      return speciesSpotlightResponseSchema.parse(data);
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    retry: 1
  });
  
  // Check if species is saved
  const isSaved = useAppStore(state => 
    state.educational_content_state.saved_spotlights.includes(spotlightData?.species.id || '')
  );
  
  // Handle saving species spotlight
  const handleSaveToggle = useCallback(async () => {
    if (!isAuthenticated) {
      // Redirect to login with redirect back to current page
      navigate(`/login?redirect_to=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    
    if (!spotlightData?.species.id) return;
    
    setIsSaving(true);
    try {
      if (isSaved) {
        await removeSavedSpotlight(spotlightData.species.id);
      } else {
        await saveSpeciesSpotlight(spotlightData.species.id);
      }
      
      // Invalidate queries that might depend on saved content
      queryClient.invalidateQueries({ queryKey: ['saved-spotlights'] });
    } catch (err) {
      console.error('Failed to update saved spotlight:', err);
      // Error handling would be implemented here with user notification
    } finally {
      setIsSaving(false);
    }
  }, [isAuthenticated, spotlightData?.species.id, isSaved, navigate, saveSpeciesSpotlight, removeSavedSpotlight, queryClient]);
  
  // Generate social share URL
  const generateShareUrl = useCallback((platform: 'twitter' | 'facebook' | 'instagram') => {
    if (!spotlightData?.species) return '#';
    
    const baseUrl = window.location.origin;
    const pageUrl = encodeURIComponent(`${baseUrl}/species?species_id=${spotlightData.species.id}`);
    const text = encodeURIComponent(`Check out this amazing species: ${spotlightData.species.common_name}!`);
    
    switch (platform) {
      case 'twitter':
        return `https://twitter.com/intent/tweet?url=${pageUrl}&text=${text}`;
      case 'facebook':
        return `https://www.facebook.com/sharer/sharer.php?u=${pageUrl}`;
      case 'instagram':
        // Instagram doesn't support direct sharing of web pages, so we'd typically use their mobile SDK
        // This is a simplified approach for web
        return `https://www.instagram.com/?url=${pageUrl}`;
      default:
        return pageUrl;
    }
  }, [spotlightData?.species]);
  
  // Handle sharing
  const handleShare = useCallback((platform: 'twitter' | 'facebook' | 'instagram') => {
    const shareUrl = generateShareUrl(platform);
    if (shareUrl !== '#') {
      window.open(shareUrl, '_blank', 'width=600,height=400');
      setShowShareMenu(false);
    }
  }, [generateShareUrl]);
  
  // Determine if we should show "First to report" CTA
  const shouldShowFirstToReport = useMemo(() => {
    return spotlightData?.local_sightings.length === 0 && 
           !isLoading && 
           !!spotlightData?.species;
  }, [spotlightData, isLoading]);
  
  // Determine seasonal relevance explanation
  const seasonalRelevance = useMemo(() => {
    if (spotlightData?.seasonal_relevance) {
      return spotlightData.seasonal_relevance;
    }
    
    if (spotlightData?.species.seasonality) {
      return `This species is typically visible during ${spotlightData.species.seasonality}.`;
    }
    
    return 'This species is currently relevant in your area based on recent observations.';
  }, [spotlightData]);
  
  // Render loading state
  if (isLoading) {
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="animate-pulse">
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="bg-gray-200 border-2 border-dashed rounded-xl w-full h-96" />
                <div className="p-8">
                  <div className="h-8 bg-gray-200 rounded w-3/4 mb-4" />
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-6" />
                  <div className="space-y-4">
                    <div className="h-4 bg-gray-200 rounded w-full" />
                    <div className="h-4 bg-gray-200 rounded w-5/6" />
                    <div className="h-4 bg-gray-200 rounded w-4/5" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }
  
  // Render error state
  if (isError) {
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="p-8 text-center">
                <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto" />
                <h2 className="text-2xl font-bold text-gray-900 mt-4 mb-2">Error Loading Species Spotlight</h2>
                <p className="text-gray-600 mb-6">{error.message}</p>
                <button
                  onClick={() => refetch()}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }
  
  // Main render for successful data load
  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumb */}
          <nav className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-2 text-sm">
              <Link to="/" className="text-blue-600 hover:text-blue-800">Home</Link>
              <span className="text-gray-400">/</span>
              <span className="text-gray-600">Species Spotlight</span>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowShareMenu(!showShareMenu)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                aria-label="Share species spotlight"
              >
                <ShareIcon className="h-4 w-4 mr-2" />
                Share
              </button>
              
              {showShareMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 border border-gray-200">
                  <button
                    onClick={() => handleShare('twitter')}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Twitter
                  </button>
                  <button
                    onClick={() => handleShare('facebook')}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Facebook
                  </button>
                  <button
                    onClick={() => handleShare('instagram')}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Instagram
                  </button>
                </div>
              )}
            </div>
          </nav>
          
          {/* Main Content */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {/* Hero Section */}
            <div className="relative h-96">
              {spotlightData?.species.image_url ? (
                <img
                  src={spotlightData.species.image_url}
                  alt={spotlightData.species.common_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-500 text-xl">No image available</span>
                </div>
              )}
              
              {/* Seasonality Badge */}
              {spotlightData?.species.seasonality && (
                <div className="absolute top-4 right-4 bg-white bg-opacity-90 px-3 py-1 rounded-full text-sm font-medium shadow">
                  {spotlightData.species.seasonality}
                </div>
              )}
              
              {/* Conservation Status */}
              {spotlightData?.species.conservation_status && (
                <div className="absolute bottom-4 left-4 bg-white bg-opacity-90 px-3 py-1 rounded-full text-sm font-medium shadow flex items-center">
                  <span className={`w-2 h-2 rounded-full mr-2 ${
                    spotlightData.species.conservation_status.toLowerCase().includes('endangered') 
                      ? 'bg-red-500' 
                      : spotlightData.species.conservation_status.toLowerCase().includes('threatened')
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                  }`}></span>
                  {spotlightData.species.conservation_status}
                </div>
              )}
            </div>
            
            {/* Species Info Section */}
            <div className="p-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
                <div>
                  <h1 className="text-4xl font-bold text-gray-900 mb-2">
                    {spotlightData?.species.common_name}
                  </h1>
                  <p className="text-xl text-gray-600 italic">
                    {spotlightData?.species.scientific_name}
                  </p>
                </div>
                
                <div className="flex items-center space-x-4 mt-4 md:mt-0">
                  <button
                    onClick={handleSaveToggle}
                    disabled={isSaving}
                    className={`flex items-center px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                      isSaved 
                        ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    aria-label={isSaved ? "Remove from saved" : "Save for later"}
                  >
                    {isSaving ? (
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <BookmarkIcon className={`h-5 w-5 mr-2 ${isSaved ? 'fill-current' : ''}`} />
                    )}
                    {isSaved ? 'Saved' : 'Save'}
                  </button>
                  
                  <button
                    onClick={() => navigate(`/submit?category=${encodeURIComponent(spotlightData?.species.common_name || '')}`)}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all duration-200"
                  >
                    <ArrowRightIcon className="h-5 w-5 mr-2" />
                    Report Sighting
                  </button>
                </div>
              </div>
              
              {/* Tabs Navigation */}
              <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                  <button
                    onClick={() => setActiveTab('facts')}
                    className={`${
                      activeTab === 'facts'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                  >
                    Facts & Ecology
                  </button>
                  <button
                    onClick={() => setActiveTab('map')}
                    className={`${
                      activeTab === 'map'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                  >
                    Local Sightings
                  </button>
                  <button
                    onClick={() => setActiveTab('comparison')}
                    className={`${
                      activeTab === 'comparison'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                  >
                    Similar Species
                  </button>
                </nav>
              </div>
              
              {/* Tab Content */}
              <div>
                {activeTab === 'facts' && (
                  <div>
                    <div className="mb-6">
                      <h2 className="text-2xl font-bold text-gray-900 mb-3">Ecology Facts</h2>
                      <ul className="list-disc pl-5 space-y-2 text-gray-700">
                        {spotlightData?.species.facts.map((fact, index) => (
                          <li key={index} className="leading-relaxed">{fact}</li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-md">
                      <h3 className="font-semibold text-blue-800 flex items-center">
                        <MapPinIcon className="h-5 w-5 mr-2" />
                        Location Relevance
                      </h3>
                      <p className="mt-1 text-blue-700">
                        {spotlightData?.location_relevance 
                          ? "This species has been observed in your area recently." 
                          : "While not commonly seen in your exact location, this species may still be relevant due to migration patterns or similar habitats."}
                      </p>
                      <p className="mt-2 text-sm text-blue-600 italic">
                        {seasonalRelevance}
                      </p>
                    </div>
                    
                    {shouldShowFirstToReport && (
                      <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                        <div className="flex items-start">
                          <ExclamationTriangleIcon className="h-6 w-6 text-yellow-500 mt-1 mr-3 flex-shrink-0" />
                          <div>
                            <h3 className="text-lg font-medium text-yellow-800">Be the first to report this species!</h3>
                            <p className="mt-2 text-yellow-700">
                              No one has reported seeing {spotlightData?.species.common_name} in this area yet. 
                              Your observation could be the first and help scientists track its range!
                            </p>
                            <div className="mt-4">
                              <button
                                onClick={() => navigate(`/submit?category=${encodeURIComponent(spotlightData?.species.common_name || '')}`)}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                              >
                                Report This Species
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {activeTab === 'map' && (
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Recent Sightings</h2>
                    
                    {spotlightData?.local_sightings.length === 0 ? (
                      <div className="text-center py-12 bg-gray-50 rounded-lg">
                        <MapPinIcon className="h-12 w-12 text-gray-400 mx-auto" />
                        <h3 className="mt-2 text-lg font-medium text-gray-900">No recent sightings</h3>
                        <p className="mt-1 text-gray-500">
                          Be the first to report this species in your area!
                        </p>
                        <div className="mt-6">
                          <button
                            onClick={() => navigate(`/submit?category=${encodeURIComponent(spotlightData?.species.common_name || '')}`)}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            Report a Sighting
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="h-96 rounded-lg overflow-hidden border border-gray-200">
                        <MapContainer 
                          center={[37.7749, -122.4194]} 
                          zoom={12} 
                          style={{ height: '100%', width: '100%' }}
                        >
                          <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                          />
                          {spotlightData.local_sightings.map((sighting) => (
                            <Marker 
                              key={sighting.observation_id} 
                              position={[sighting.location.lat, sighting.location.lng]}
                            >
                              <Popup>
                                <div className="p-2">
                                  <p className="font-medium">{spotlightData.species.common_name}</p>
                                  <p className="text-sm text-gray-600">
                                    {new Date(sighting.timestamp).toLocaleDateString()}
                                  </p>
                                  {sighting.verification_status && (
                                    <p className={`text-xs mt-1 ${
                                      sighting.verification_status === 'verified' ? 'text-green-600' : 'text-yellow-600'
                                    }`}>
                                      {sighting.verification_status === 'verified' ? 'Verified' : 'Pending'}
                                    </p>
                                  )}
                                </div>
                              </Popup>
                            </Marker>
                          ))}
                        </MapContainer>
                      </div>
                    )}
                    
                    <div className="mt-4 text-sm text-gray-500">
                      <p>
                        Sightings shown: {spotlightData?.local_sightings.length} | 
                        Last updated: {new Date().toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}
                
                {activeTab === 'comparison' && (
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Similar Species</h2>
                    
                    {spotlightData?.similar_species.length === 0 ? (
                      <div className="text-center py-12 bg-gray-50 rounded-lg">
                        <div className="text-gray-400 text-5xl mb-4">🔍</div>
                        <h3 className="text-lg font-medium text-gray-900">No similar species found</h3>
                        <p className="mt-1 text-gray-500">
                          This species appears to be unique in its classification.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {spotlightData.similar_species.map((species) => (
                          <div 
                            key={species.id} 
                            className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                          >
                            <div className="h-48 bg-gray-200 flex items-center justify-center">
                              {species.image_url ? (
                                <img
                                  src={species.image_url}
                                  alt={species.common_name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-gray-500">No image</span>
                              )}
                            </div>
                            <div className="p-4">
                              <h3 className="text-lg font-semibold text-gray-900">
                                {species.common_name}
                              </h3>
                              <p className="text-gray-600 italic text-sm mb-2">
                                {species.scientific_name}
                              </p>
                              <p className="text-gray-700">
                                <span className="font-medium">Key differences:</span>{' '}
                                {species.distinguishing_features}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* Educational Action Section */}
            <div className="bg-gray-50 border-t border-gray-200 p-8">
              <div className="max-w-3xl mx-auto text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Help Protect This Species
                </h2>
                <p className="text-gray-600 mb-6">
                  Your observations contribute to conservation efforts and help scientists understand 
                  species distribution and population trends. Every sighting makes a difference!
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                  <button
                    onClick={() => navigate(`/guides?habitat_type=${encodeURIComponent(spotlightData?.species.habitat_type || '')}`)}
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    Learn Habitat Protection
                  </button>
                  <button
                    onClick={() => navigate(`/challenges`)}
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Join Conservation Challenges
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Educational Resources Footer */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                Verified Information
              </h3>
              <p className="text-gray-600">
                All species information is verified by our expert network and updated regularly 
                based on the latest scientific research.
              </p>
            </div>
            
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <MapPinIcon className="h-5 w-5 text-blue-500 mr-2" />
                Location-Based
              </h3>
              <p className="text-gray-600">
                Content is tailored to your region to provide the most relevant information for 
                your local ecosystem.
              </p>
            </div>
            
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <BookmarkIcon className="h-5 w-5 text-purple-500 mr-2" />
                Educational Resources
              </h3>
              <p className="text-gray-600">
                Access guides, activity sheets, and lesson plans designed for educators and students 
                of all ages.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_SPECIES_SPOTLIGHT;