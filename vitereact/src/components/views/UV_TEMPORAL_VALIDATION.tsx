import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, QueryClient, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';

// Define necessary interfaces
interface ValidationResponse {
  is_valid: boolean;
  message: string;
  corrected_timestamp?: string;
  timezone_mismatch?: boolean;
}

interface JustificationRequest {
  justification_text: string;
}

interface ValidationWindow {
  min_date: string;
  max_date: string;
}

// Constants
const MAX_JUSTIFICATION_LENGTH = 500;

const UV_TEMPORAL_VALIDATION: React.FC = () => {
  // URL parameter and slug access
  const { observation_id } = useParams<{ observation_id?: string }>();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  
  // Extract URL parameters
  const observationTimestampParam = queryParams.get('observation_timestamp');
  const isRetrospectiveParam = queryParams.get('is_retrospective') === 'true';
  const timezoneOffsetParam = queryParams.get('timezone_offset');
  
  // Individual Zustand selectors (CRITICAL: no object destructuring)
  const dataRetentionDays = useAppStore(state => state.config.data_retention_days);
  const userTimezone = useAppStore(state => state.user_profile.timezone);
  const activeSubmissions = useAppStore(state => state.observation_state.active_submissions);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  
  // Local state
  const [observationTimestamp, setObservationTimestamp] = useState<string>(
    observationTimestampParam || new Date().toISOString().split('T')[0]
  );
  const [isRetrospective, setIsRetrospective] = useState<boolean>(isRetrospectiveParam);
  const [justificationText, setJustificationText] = useState<string>('');
  const [validationWindow, setValidationWindow] = useState<ValidationWindow>({
    min_date: '',
    max_date: ''
  });
  const [isTimezoneMismatch, setIsTimezoneMismatch] = useState<boolean>(false);
  const [correctedTimestamp, setCorrectedTimestamp] = useState<string>('');
  const [validationMessage, setValidationMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  // Calculate validation window based on data retention policy
  useEffect(() => {
    if (dataRetentionDays) {
      const today = new Date();
      const minDate = new Date();
      minDate.setDate(today.getDate() - dataRetentionDays);
      const maxDate = new Date();
      maxDate.setDate(today.getDate() + dataRetentionDays);
      
      setValidationWindow({
        min_date: minDate.toISOString().split('T')[0],
        max_date: maxDate.toISOString().split('T')[0]
      });
    }
  }, [dataRetentionDays]);
  
  // Validate observation timestamp when it changes
  useEffect(() => {
    if (observationTimestamp && validationWindow.min_date && validationWindow.max_date) {
      validateTimestamp(observationTimestamp);
    }
  }, [observationTimestamp, validationWindow]);
  
  // Fetch active submissions for audit trail context
  const { data: activeSubmissionsData } = useQuery({
    queryKey: ['activeSubmissions', observation_id],
    queryFn: () => {
      // In a real implementation, this would fetch from API
      return activeSubmissions;
    },
    enabled: !!observation_id,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });
  
  // Validation function
  const validateTimestamp = useCallback(async (timestamp: string) => {
    try {
      const response = await axios.post<ValidationResponse>(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/observations/validate-timestamp`,
        {
          observation_timestamp: timestamp,
          is_retrospective: isRetrospective,
          justification_text: justificationText
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      setIsTimezoneMismatch(!!response.data.timezone_mismatch);
      setCorrectedTimestamp(response.data.corrected_timestamp || '');
      setValidationMessage(response.data.message);
      
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        setValidationMessage(error.response.data.message || 'Validation failed');
      } else {
        setValidationMessage('Unable to validate timestamp. Please try again.');
      }
      return { is_valid: false, message: 'Validation failed' };
    }
  }, [isRetrospective, justificationText, authToken]);
  
  // Mutation for submitting justification
  const queryClient = useQueryClient();
  const { mutate: submitJustification } = useMutation({
    mutationFn: async (data: JustificationRequest) => {
      if (!observation_id) throw new Error('Observation ID is required');
      
      return axios.patch(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/observations/${observation_id}/justify`,
        data,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['observation', observation_id] });
      setSubmitError(null);
      // Redirect back to submission wizard with success message
      // Implementation would depend on routing structure
    },
    onError: (error: unknown) => {
      if (axios.isAxiosError(error) && error.response) {
        setSubmitError(error.response.data.message || 'Failed to submit justification');
      } else {
        setSubmitError('An unexpected error occurred. Please try again.');
      }
    }
  });
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!observation_id) {
      setSubmitError('Observation ID is missing. Cannot submit justification.');
      return;
    }
    
    if (isRetrospective && !justificationText.trim()) {
      setSubmitError('Justification text is required for retrospective observations.');
      return;
    }
    
    setIsSubmitting(true);
    setSubmitError(null);
    
    submitJustification({ justification_text: justificationText });
  };
  
  // Generate audit trail entries
  const getAuditTrailEntries = () => {
    const entries = [];
    
    if (activeSubmissionsData && observation_id) {
      const currentSubmission = activeSubmissionsData.find(sub => sub.id === observation_id);
      if (currentSubmission) {
        entries.push({
          timestamp: currentSubmission.created_at,
          action: 'Observation created',
          details: `Initial submission at ${new Date(currentSubmission.created_at).toLocaleString()}`
        });
        
        if (currentSubmission.last_modified) {
          entries.push({
            timestamp: currentSubmission.last_modified,
            action: 'Observation updated',
            details: `Modified at ${new Date(currentSubmission.last_modified).toLocaleString()}`
          });
        }
      }
    }
    
    // Add validation event
    entries.push({
      timestamp: new Date().toISOString(),
      action: 'Timestamp validation',
      details: validationMessage
    });
    
    return entries;
  };
  
  const auditTrailEntries = getAuditTrailEntries();
  
  // Determine if timestamp is valid
  const isTimestampValid = validationMessage && !validationMessage.includes('outside the allowed window');
  
  return (
    <>
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Temporal Data Validation</h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Ensure your observation timestamp meets data quality standards for longitudinal ecological studies.
            </p>
          </div>
          
          {/* Main Content */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {/* Form Section */}
            <div className="p-6 lg:p-8 border-b border-gray-200">
              <form onSubmit={handleSubmit}>
                {/* Observation Timestamp Input */}
                <div className="mb-6">
                  <label htmlFor="observation-timestamp" className="block text-sm font-medium text-gray-700 mb-2">
                    Observation Timestamp
                  </label>
                  
                  <div className="relative">
                    <input
                      type="date"
                      id="observation-timestamp"
                      value={observationTimestamp}
                      onChange={(e) => {
                        setObservationTimestamp(e.target.value);
                        setSubmitError(null);
                      }}
                      min={validationWindow.min_date}
                      max={validationWindow.max_date}
                      className={`w-full px-4 py-3 rounded-lg border-2 focus:ring-4 focus:ring-blue-100 transition-all duration-200 ${
                        isTimestampValid 
                          ? 'border-green-300 focus:border-green-500' 
                          : 'border-red-300 focus:border-red-500'
                      }`}
                      required
                    />
                    
                    {/* Date Range Info */}
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                      Valid range: {validationWindow.min_date} to {validationWindow.max_date}
                    </div>
                  </div>
                  
                  {/* Validation Message */}
                  {validationMessage && (
                    <div className={`mt-2 p-3 rounded-md ${
                      isTimestampValid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                      <p className="text-sm">{validationMessage}</p>
                    </div>
                  )}
                  
                  {/* Timezone Mismatch Notice */}
                  {isTimezoneMismatch && correctedTimestamp && (
                    <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-md p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3 flex-1">
                          <p className="text-sm text-yellow-700">
                            Timezone mismatch detected. Server corrected timestamp to:{' '}
                            <strong>{new Date(correctedTimestamp).toLocaleString()}</strong>
                          </p>
                          <div className="mt-2 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => setObservationTimestamp(correctedTimestamp.split('T')[0])}
                              className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded hover:bg-yellow-200 transition-colors"
                            >
                              Use corrected timestamp
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsTimezoneMismatch(false)}
                              className="text-xs text-gray-600 hover:text-gray-800"
                            >
                              Override correction
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Retrospective Checkbox */}
                <div className="mb-6 flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="is-retrospective"
                      type="checkbox"
                      checked={isRetrospective}
                      onChange={(e) => {
                        setIsRetrospective(e.target.checked);
                        if (!e.target.checked) setJustificationText('');
                        setSubmitError(null);
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="is-retrospective" className="font-medium text-gray-700">
                      This is retrospective (historical) data
                    </label>
                    <p className="text-gray-500">
                      Check if you're recording an observation from a previous date outside the normal 90-day window
                    </p>
                  </div>
                </div>
                
                {/* Justification Textarea (Conditional) */}
                {isRetrospective && (
                  <div className="mb-6">
                    <label htmlFor="justification" className="block text-sm font-medium text-gray-700 mb-2">
                      Justification (required for historical data)
                    </label>
                    <textarea
                      id="justification"
                      value={justificationText}
                      onChange={(e) => {
                        if (e.target.value.length <= MAX_JUSTIFICATION_LENGTH) {
                          setJustificationText(e.target.value);
                          setSubmitError(null);
                        }
                      }}
                      maxLength={MAX_JUSTIFICATION_LENGTH}
                      placeholder="Explain why this historical observation is valid and relevant to current ecological conditions..."
                      rows={4}
                      className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
                      required
                    />
                    <div className="mt-1 text-xs text-gray-500 text-right">
                      {justificationText.length}/{MAX_JUSTIFICATION_LENGTH} characters
                    </div>
                    {submitError && (
                      <p className="mt-1 text-sm text-red-600">{submitError}</p>
                    )}
                  </div>
                )}
                
                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row justify-between space-y-4 sm:space-y-0">
                  <Link
                    to={`/submit${observation_id ? `?observation_id=${observation_id}` : ''}`}
                    className="w-full sm:w-auto inline-flex justify-center py-3 px-6 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    Back to Submission
                  </Link>
                  
                  <button
                    type="submit"
                    disabled={isSubmitting || !isTimestampValid || (isRetrospective && !justificationText.trim())}
                    className={`w-full sm:w-auto py-3 px-6 rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
                      isSubmitting || !isTimestampValid || (isRetrospective && !justificationText.trim())
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                    }`}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Submitting...
                      </span>
                    ) : (
                      'Submit Observation'
                    )}
                  </button>
                </div>
              </form>
            </div>
            
            {/* Audit Trail Section */}
            <div className="p-6 lg:p-8 bg-gray-50">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Audit Trail</h2>
              
              <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                {auditTrailEntries.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    No audit trail entries available
                  </p>
                ) : (
                  auditTrailEntries.map((entry, index) => (
                    <div 
                      key={`audit-${index}`} 
                      className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">{entry.action}</h3>
                          <p className="mt-1 text-sm text-gray-600">{entry.details}</p>
                        </div>
                        <span className="text-xs text-gray-500 whitespace-nowrap ml-4">
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              <div className="mt-4 text-xs text-gray-500 text-center">
                <p>
                  All timestamp changes and validations are recorded for data integrity purposes
                </p>
                <p className="mt-1">
                  Data retention policy: {dataRetentionDays} days for historical observations
                </p>
              </div>
            </div>
          </div>
          
          {/* Help Section */}
          <div className="mt-8 bg-blue-50 rounded-xl p-6 border border-blue-100">
            <h2 className="text-lg font-semibold text-blue-900 mb-3">Understanding Temporal Validation</h2>
            <div className="prose prose-blue max-w-none">
              <p className="text-blue-800">
                Ecological data requires accurate temporal context for meaningful analysis. Our system validates observation timestamps to ensure:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-blue-800">
                <li>Data falls within scientifically relevant timeframes (±{dataRetentionDays} days)</li>
                <li>Historical observations include proper justification for research value</li>
                <li>Timezone consistency across global contributions</li>
                <li>Longitudinal study integrity through precise timestamp tracking</li>
              </ul>
              <p className="mt-3 text-blue-800">
                For observations outside the standard window, please provide detailed justification explaining:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-blue-800">
                <li>Why this historical data remains relevant to current ecological conditions</li>
                <li>How the observation was accurately recorded despite the time gap</li>
                <li>Any supporting evidence for the historical claim</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_TEMPORAL_VALIDATION;