import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import axios from 'axios';
import { z } from 'zod';

// Define Zod schemas for type safety
const geofenceRuleSchema = z.object({
  zone_id: z.string(),
  iucn_category: z.string(),
  geometry: z.string(),
  buffer_zone_size: z.number(),
  blur_radius: z.number()
});

const geofenceRulesResponseSchema = z.object({
  rules: z.array(geofenceRuleSchema),
  default_blur_radius: z.number()
});

const confirmationStatusSchema = z.object({
  confirmed: z.boolean(),
  timestamp: z.string()
}).nullable();

// Type definitions
type GeofenceRule = z.infer<typeof geofenceRuleSchema>;
type GeofenceRulesResponse = z.infer<typeof geofenceRulesResponseSchema>;
type ConfirmationStatus = z.infer<typeof confirmationStatusSchema>;

const UV_GEOFENCE_WARNING: React.FC = () => {
  // URL parameter access
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  
  // Get URL parameters with validation
  const latitude = parseFloat(searchParams.get('latitude') || '0');
  const longitude = parseFloat(searchParams.get('longitude') || '0');
  const speciesId = searchParams.get('species_id') || undefined;
  const observationId = searchParams.get('observation_id') || '';
  
  // Validate coordinates
  if (isNaN(latitude) || isNaN(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-red-50">
          <div className="max-w-md w-full space-y-6 p-6 bg-white rounded-xl shadow-lg border border-red-100">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-red-900 mb-2">Invalid Coordinates</h2>
              <p className="text-red-700">
                The location coordinates provided are invalid. Please go back and try again.
              </p>
            </div>
            <button
              onClick={() => navigate(-1)}
              className="w-full py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Go Back
            </button>
          </div>
        </div>
      </>
    );
  }

  // Global state access - CRITICAL: Individual selectors only
  const userPrimaryLocation = useAppStore(state => state.user_profile_state.primary_location);
  const observationDraft = useAppStore(state => 
    state.observation_state.active_submissions.find(obs => obs.id === observationId)
  );
  const mapCenter = useAppStore(state => state.map_state.map_center);
  const updateObservationDraft = useAppStore(state => state.update_observation_draft);
  const addNotification = useAppStore(state => state.add_notification);

  // Local state
  const [blurRadius, setBlurRadius] = useState<number>(500);
  const [isInProtectedZone, setIsInProtectedZone] = useState<boolean>(false);
  const [isInBufferZone, setIsInBufferZone] = useState<boolean>(false);
  const [selectedZone, setSelectedZone] = useState<GeofenceRule | null>(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState<boolean>(false);
  const [confirmationStatus, setConfirmationStatus] = useState<ConfirmationStatus>(null);
  const [showWarningOverlay, setShowWarningOverlay] = useState<boolean>(true);
  const [takedownRequested, setTakedownRequested] = useState<boolean>(false);

  // Initialize with URL parameter if available
  useEffect(() => {
    const statusParam = searchParams.get('confirmation_status');
    if (statusParam) {
      try {
        const status = JSON.parse(decodeURIComponent(statusParam));
        if (status.confirmed !== undefined && status.timestamp) {
          setConfirmationStatus(status);
        }
      } catch (e) {
        console.error('Invalid confirmation status:', e);
      }
    }
  }, [searchParams]);

  // Fetch geofence rules using React Query
  const { data: geofenceRules, isLoading, error } = useQuery({
    queryKey: ['geofenceRules', latitude, longitude],
    queryFn: async () => {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/geofence/rules`,
        {
          params: { latitude, longitude },
          headers: {
            'Authorization': `Bearer ${useAppStore.getState().authentication_state.auth_token}`
          }
        }
      );
      
      // Validate response with Zod
      return geofenceRulesResponseSchema.parse(response.data);
    },
    enabled: !!latitude && !!longitude,
    staleTime: 60000,
    refetchOnWindowFocus: false,
    retry: 1
  });

  // Process geofence rules and determine zone status
  useEffect(() => {
    if (geofenceRules && geofenceRules.rules.length > 0) {
      // Find the most relevant zone (closest or highest priority)
      const relevantZone = geofenceRules.rules[0]; // Simplified for example
      
      // Calculate distances and determine zone status
      const distanceToZone = calculateDistance(
        { lat: latitude, lng: longitude },
        { lat: mapCenter.lat, lng: mapCenter.lng }
      );
      
      if (distanceToZone <= relevantZone.buffer_zone_size) {
        setIsInBufferZone(true);
        setIsInProtectedZone(false);
      } else if (distanceToZone <= relevantZone.buffer_zone_size + 1000) { // Placeholder threshold
        setIsInProtectedZone(true);
        setIsInBufferZone(false);
      }
      
      setSelectedZone(relevantZone);
      setBlurRadius(relevantZone.blur_radius || geofenceRules.default_blur_radius);
    }
  }, [geofenceRules, latitude, longitude, mapCenter]);

  // Helper function to calculate distance between coordinates
  const calculateDistance = (pointA: { lat: number; lng: number }, pointB: { lat: number; lng: number }): number => {
    // Simplified distance calculation for example
    const R = 6371; // Earth's radius in km
    const dLat = deg2rad(pointB.lat - pointA.lat);
    const dLon = deg2rad(pointB.lng - pointA.lng);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(pointA.lat)) * Math.cos(deg2rad(pointB.lat)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c; // Distance in km
  };
  
  const deg2rad = (deg: number): number => {
    return deg * (Math.PI/180);
  };

  // Handle continue to submission with modified coordinates
  const handleContinue = () => {
    if (!observationDraft || !selectedZone) return;
    
    // Apply coordinate blurring
    const blurredCoordinates = applyCoordinateBlurring(
      { lat: latitude, lng: longitude },
      blurRadius
    );
    
    // Update observation draft with blurred coordinates
    updateObservationDraft({
      ...observationDraft,
      location: blurredCoordinates,
      location_precision_meters: blurRadius,
      is_private: true // Always make observations in protected zones private
    });
    
    // Navigate to next step in submission process
    navigate(`/submit${observationDraft.category ? `?category=${observationDraft.category}` : ''}`);
  };

  // Apply coordinate blurring algorithm
  const applyCoordinateBlurring = (coordinates: { lat: number; lng: number }, radius: number) => {
    // Simplified blurring algorithm for demonstration
    // In production, this would use more sophisticated spatial algorithms
    const earthCircumference = 40075; // km at equator
    const degreesPerKm = 360 / earthCircumference;
    
    const latOffset = (radius / 111) * (Math.random() - 0.5);
    const lngOffset = (radius / (111 * Math.cos(coordinates.lat * Math.PI / 180))) * (Math.random() - 0.5);
    
    return {
      lat: parseFloat((coordinates.lat + latOffset).toFixed(6)),
      lng: parseFloat((coordinates.lng + lngOffset).toFixed(6))
    };
  };

  // Handle buffer zone confirmation
  const handleConfirmBufferZone = () => {
    const status = {
      confirmed: true,
      timestamp: new Date().toISOString()
    };
    
    setConfirmationStatus(status);
    setShowConfirmationModal(false);
    
    // Update URL to persist confirmation status
    const params = new URLSearchParams(searchParams.toString());
    params.set('confirmation_status', encodeURIComponent(JSON.stringify(status)));
    navigate(`${location.pathname}?${params.toString()}`);
  };

  // Handle takedown request
  const handleTakedownRequest = async () => {
    if (!observationDraft) return;
    
    try {
      await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/observations/${observationDraft.id}/takedown-request`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${useAppStore.getState().authentication_state.auth_token}`
          }
        }
      );
      
      setTakedownRequested(true);
      addNotification({
        id: `takedown-${Date.now()}`,
        type: 'success',
        message: 'Takedown request submitted successfully. An administrator will review shortly.',
        duration: 5000
      });
    } catch (error) {
      addNotification({
        id: `takedown-error-${Date.now()}`,
        type: 'error',
        message: 'Failed to submit takedown request. Please try again.',
        duration: 5000
      });
      console.error('Takedown request failed:', error);
    }
  };

  // Close warning overlay
  const handleCloseWarning = () => {
    setShowWarningOverlay(false);
    // Don't navigate away - user should still see the warning but can continue
  };

  // Return to previous step
  const handleGoBack = () => {
    navigate(-1);
  };

  // Render methods
  const renderIucnCategoryBadge = (category: string) => {
    let colorClass = '';
    let label = '';
    
    switch (category.toUpperCase()) {
      case 'Ia':
        colorClass = 'bg-red-100 text-red-800 border-red-300';
        label = 'Strict Nature Reserve (Ia)';
        break;
      case 'Ib':
        colorClass = 'bg-red-100 text-red-800 border-red-300';
        label = 'Wilderness Area (Ib)';
        break;
      case 'II':
        colorClass = 'bg-orange-100 text-orange-800 border-orange-300';
        label = 'National Park (II)';
        break;
      case 'III':
        colorClass = 'bg-yellow-100 text-yellow-800 border-yellow-300';
        label = 'Natural Monument (III)';
        break;
      case 'IV':
        colorClass = 'bg-green-100 text-green-800 border-green-300';
        label = 'Habitat/Species Management Area (IV)';
        break;
      case 'V':
        colorClass = 'bg-blue-100 text-blue-800 border-blue-300';
        label = 'Protected Landscape/Seascape (V)';
        break;
      case 'VI':
        colorClass = 'bg-indigo-100 text-indigo-800 border-indigo-300';
        label = 'Protected Area with Sustainable Use (VI)';
        break;
      default:
        colorClass = 'bg-gray-100 text-gray-800 border-gray-300';
        label = 'Protected Zone';
    }
    
    return (
      <div 
        className={`px-3 py-1 rounded-full text-xs font-medium border ${colorClass} 
          inline-flex items-center cursor-pointer`}
        title={label}
      >
        {category}
        <span className="ml-1">ⓘ</span>
      </div>
    );
  };

  const renderPrecisionSlider = () => (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">
        Location Precision: {blurRadius}m radius
      </label>
      
      <input
        type="range"
        min="100"
        max="2000"
        step="100"
        value={blurRadius}
        onChange={(e) => setBlurRadius(parseInt(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
      />
      
      <div className="flex justify-between text-xs text-gray-500">
        <span>Blurred (2000m)</span>
        <span>Exact Location (100m)</span>
      </div>
      
      <div className="mt-2 p-3 bg-blue-50 rounded-md border border-blue-100">
        <p className="text-sm text-blue-700">
          Your location will be blurred to protect sensitive ecological data. 
          Moving the slider toward "Exact Location" increases precision but may 
          compromise species protection.
        </p>
      </div>
    </div>
  );

  const renderBufferZoneConfirmation = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center mb-4">
            <div className="bg-yellow-100 rounded-full p-3 mr-3">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900">Buffer Zone Crossing</h3>
          </div>
          
          <div className="space-y-4">
            <p className="text-gray-700">
              You're entering a buffer zone around a protected area. These zones help 
              minimize disturbance to sensitive locations.
            </p>
            
            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
              <p className="text-sm text-gray-600">
                <strong>Protected Area:</strong> {selectedZone?.zone_id || 'Unknown'}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                <strong>IUCN Category:</strong> {selectedZone?.iucn_category || 'N/A'}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                <strong>Buffer Size:</strong> {selectedZone?.buffer_zone_size} meters
              </p>
            </div>
            
            <p className="text-gray-700">
              Please confirm you understand this is a sensitive area and your observation 
              may require additional verification before publication.
            </p>
            
            <div className="flex space-x-4 pt-2">
              <button
                onClick={handleConfirmBufferZone}
                className="flex-1 py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                I Understand, Continue
              </button>
              <button
                onClick={() => setShowConfirmationModal(false)}
                className="flex-1 py-3 px-4 border border-gray-300 rounded-md shadow-sm text-base font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Checking location protection status...</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50">
          <div className="max-w-md w-full space-y-6 p-6 bg-white rounded-xl shadow-lg border border-red-100">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-red-900 mb-2">Geofence Check Failed</h2>
              <p className="text-red-700 mb-4">
                Unable to verify location protection status. Please check your internet connection 
                and try again.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (!geofenceRules || geofenceRules.rules.length === 0) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full space-y-6 p-6 bg-white rounded-xl shadow-lg border border-gray-200">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">No Protection Zones Found</h2>
              <p className="text-gray-600 mb-4">
                Your location doesn't appear to be in any protected ecological zones.
              </p>
              <button
                onClick={handleContinue}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Continue Submission
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (isInProtectedZone && !confirmationStatus?.confirmed) {
      return (
        <div className="fixed inset-0 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 z-40">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-8">
              <div className="flex items-start mb-6">
                <div className="bg-blue-100 rounded-full p-3 mr-4">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Sensitive Ecological Zone</h2>
                  <p className="text-gray-600">
                    You're attempting to submit an observation in a protected area designated 
                    for endangered species conservation.
                  </p>
                </div>
              </div>

              <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg">
                <p className="text-red-800 font-medium flex items-start">
                  <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Automatic coordinate blurring applied to protect sensitive location
                </p>
              </div>

              {selectedZone && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">Protected Area: {selectedZone.zone_id}</h3>
                    {renderIucnCategoryBadge(selectedZone.iucn_category)}
                  </div>
                  <p className="text-gray-600 text-sm">
                    This area is designated for the protection of sensitive species and habitats. 
                    Exact coordinates will be blurred to prevent disturbance.
                  </p>
                </div>
              )}

              {renderPrecisionSlider()}

              <div className="mt-8 flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                <button
                  onClick={handleContinue}
                  className="flex-1 py-4 px-6 border border-transparent rounded-xl shadow-lg text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
                >
                  Continue With Blurred Location
                </button>
                
                <button
                  onClick={handleTakedownRequest}
                  disabled={takedownRequested}
                  className="flex-1 py-4 px-6 border border-red-300 rounded-xl shadow-md text-base font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200 flex items-center justify-center"
                >
                  {takedownRequested ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Requesting Takedown...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                      </svg>
                      Request Immediate Takedown
                    </>
                  )}
                </button>
              </div>

              <div className="mt-6 text-center text-sm text-gray-500">
                <p>
                  By continuing, you acknowledge that this observation will be automatically 
                  marked as private and require verification before appearing in public feeds.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (isInBufferZone && !showConfirmationModal) {
      return (
        <div className="fixed inset-0 bg-gradient-to-br from-yellow-50 to-orange-50 flex items-center justify-center p-4 z-40">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-start mb-4">
                <div className="bg-yellow-100 rounded-full p-3 mr-4">
                  <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">Buffer Zone Crossing</h2>
                  <p className="text-gray-600">
                    You're approaching a protected ecological zone boundary.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-lg mb-6">
                <p className="text-yellow-800 font-medium flex items-start">
                  <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Location precision will be reduced near protected boundaries
                </p>
              </div>

              {selectedZone && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">Protected Area: {selectedZone.zone_id}</h3>
                    {renderIucnCategoryBadge(selectedZone.iucn_category)}
                  </div>
                  <p className="text-gray-600 text-sm">
                    Buffer zones help minimize disturbance to sensitive protected areas. 
                    Your location precision will be reduced within {selectedZone.buffer_zone_size} meters 
                    of the boundary.
                  </p>
                </div>
              )}

              <div className="flex flex-col space-y-4">
                <button
                  onClick={() => setShowConfirmationModal(true)}
                  className="py-4 px-6 border border-transparent rounded-xl shadow-lg text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
                >
                  Continue Into Buffer Zone
                </button>
                
                <button
                  onClick={handleGoBack}
                  className="py-4 px-6 border border-gray-300 rounded-xl shadow-md text-base font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
                >
                  Go Back to Safe Zone
                </button>
              </div>

              <div className="mt-4 text-center text-sm text-gray-500">
                <p>
                  Buffer zones help protect sensitive ecological areas from unintended disturbance.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="bg-green-100 rounded-full p-4 inline-block mb-4">
            <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Location Verified</h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Your location does not fall within any protected ecological zones. 
            You may proceed with your observation submission.
          </p>
          <button
            onClick={handleContinue}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Continue Submission
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {isInBufferZone && showConfirmationModal && renderBufferZoneConfirmation()}
      
      {showWarningOverlay && (
        <div 
          className="fixed top-4 right-4 z-50 bg-white rounded-lg shadow-lg p-4 border-l-4 border-yellow-500 
            max-w-sm transition-all duration-300 ease-in-out transform hover:scale-[1.02]"
          role="alert"
          aria-live="polite"
        >
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-yellow-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1 pt-0.5">
              <p className="text-sm leading-5 font-medium text-gray-900">
                Geofence Protection Active
              </p>
              <p className="mt-1 text-sm leading-5 text-gray-500">
                Your location is being evaluated for ecological sensitivity.
              </p>
            </div>
            <div className="ml-4 pl-3">
              <button
                onClick={handleCloseWarning}
                className="text-gray-400 hover:text-gray-500 focus:outline-none"
                aria-label="Dismiss geofence warning"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {renderContent()}
    </>
  );
};

export default UV_GEOFENCE_WARNING;