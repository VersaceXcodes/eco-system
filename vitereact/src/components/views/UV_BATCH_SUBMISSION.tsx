import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, QueryClient, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import axios from 'axios';

// Type definitions matching backend requirements
interface BatchObservation {
  user_id: string;
  species_name: string;
  observation_timestamp: string;
  latitude: number;
  longitude: number;
  notes?: string;
  habitat_type?: string;
  is_private: boolean;
}

interface ValidationIssue {
  row_index: number;
  field: string;
  message: string;
  severity: 'error' | 'warning';
  suggested_correction?: string;
}

interface BatchValidationResult {
  valid_rows: BatchObservation[];
  validation_errors: ValidationIssue[];
  duplicate_observations: BatchObservation[];
}

interface BatchSubmissionResult {
  success_count: number;
  error_count: number;
  processed_observations: number;
  invalid_observations: number;
  duplicate_observations: number;
  error_report_url?: string;
}

interface CsvRow {
  [key: string]: string;
}

const UV_BATCH_SUBMISSION: React.FC = () => {
  // Zustand store access - CRITICAL: Individual selectors only
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const isLoadingAuth = useAppStore(state => state.authentication_state.authentication_status.is_loading);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const expertiseLevel = useAppStore(state => state.user_profile_state.expertise_level);
  
  // Local state management
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationIssue[]>([]);
  const [validObservations, setValidObservations] = useState<BatchObservation[]>([]);
  const [duplicateObservations, setDuplicateObservations] = useState<BatchObservation[]>([]);
  const [submissionResult, setSubmissionResult] = useState<BatchSubmissionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Authentication and authorization check
  useEffect(() => {
    if (!isLoadingAuth && (!isAuthenticated || expertiseLevel !== 'expert')) {
      navigate('/login', { state: { redirect_to: '/batch-submit' } });
    }
  }, [isAuthenticated, isLoadingAuth, expertiseLevel, navigate]);

  // CSV Template download handler
  const handleDownloadTemplate = async () => {
    try {
      setError(null);
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/observations/batch/template`,
        { responseType: 'blob' }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'eco_pulse_batch_template.csv');
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      setError('Failed to download template. Please try again.');
      console.error('Template download error:', err);
    }
  };

  // CSV Parsing function
  const parseCsv = (csvText: string): { headers: string[]; rows: CsvRow[] } => {
    const lines = csvText.split('\n');
    if (lines.length === 0) return { headers: [], rows: [] };
    
    // Parse headers (first line)
    const headerLine = lines[0].trim();
    const headers = headerLine.split(',').map(h => h.trim());
    
    // Parse rows
    const rows: CsvRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = line.split(',').map(v => v.trim());
      const row: CsvRow = {};
      
      headers.forEach((header, index) => {
        row[header] = index < values.length ? values[index] : '';
      });
      
      rows.push(row);
    }
    
    return { headers, rows };
  };

  // Auto-detect column mappings
  const autoDetectColumns = (headers: string[]): Record<string, string> => {
    const mapping: Record<string, string> = {};
    const lowerHeaders = headers.map(h => h.toLowerCase());
    
    // Species name detection
    const speciesIdx = lowerHeaders.findIndex(h => 
      h.includes('species') || h.includes('name') || h.includes('bird') || h.includes('plant')
    );
    if (speciesIdx !== -1) {
      mapping['species_name'] = headers[speciesIdx];
    }
    
    // Latitude detection
    const latIdx = lowerHeaders.findIndex(h => 
      h.includes('latitude') || h.includes('lat') || h.includes('y-coordinate')
    );
    if (latIdx !== -1) {
      mapping['latitude'] = headers[latIdx];
    }
    
    // Longitude detection
    const lngIdx = lowerHeaders.findIndex(h => 
      h.includes('longitude') || h.includes('lng') || h.includes('long') || h.includes('x-coordinate')
    );
    if (lngIdx !== -1) {
      mapping['longitude'] = headers[lngIdx];
    }
    
    // Timestamp detection
    const dateIdx = lowerHeaders.findIndex(h => 
      h.includes('date') || h.includes('timestamp') || h.includes('time') || h.includes('observation')
    );
    if (dateIdx !== -1) {
      mapping['observation_timestamp'] = headers[dateIdx];
    }
    
    // Notes detection
    const notesIdx = lowerHeaders.findIndex(h => 
      h.includes('notes') || h.includes('comments') || h.includes('description')
    );
    if (notesIdx !== -1) {
      mapping['notes'] = headers[notesIdx];
    }
    
    // Habitat type detection
    const habitatIdx = lowerHeaders.findIndex(h => 
      h.includes('habitat') || h.includes('ecosystem') || h.includes('environment')
    );
    if (habitatIdx !== -1) {
      mapping['habitat_type'] = headers[habitatIdx];
    }
    
    return mapping;
  };

  // Validate and transform CSV data
  const validateAndTransform = (): BatchValidationResult => {
    if (!file || csvData.length === 0 || Object.keys(columnMapping).length === 0) {
      return { valid_rows: [], validation_errors: [], duplicate_observations: [] };
    }
    
    const errors: ValidationIssue[] = [];
    const validRows: BatchObservation[] = [];
    const duplicates: BatchObservation[] = [];
    
    csvData.forEach((row, rowIndex) => {
      const mappedRow: Partial<BatchObservation> = {};
      
      // Map columns based on user selection
      Object.entries(columnMapping).forEach(([field, csvHeader]) => {
        mappedRow[field as keyof BatchObservation] = row[csvHeader];
      });
      
      // Required fields validation
      const requiredFields: (keyof BatchObservation)[] = [
        'species_name',
        'observation_timestamp',
        'latitude',
        'longitude'
      ];
      
      requiredFields.forEach(field => {
        if (!mappedRow[field]) {
          errors.push({
            row_index: rowIndex + 2, // +2 for header row and 0-indexing
            field,
            message: `${field.replace('_', ' ')} is required`,
            severity: 'error'
          });
        }
      });
      
      // Coordinate validation
      if (mappedRow.latitude && mappedRow.longitude) {
        const lat = parseFloat(mappedRow.latitude);
        const lng = parseFloat(mappedRow.longitude);
        
        if (isNaN(lat) || isNaN(lng)) {
          errors.push({
            row_index: rowIndex + 2,
            field: 'coordinates',
            message: 'Invalid coordinate format',
            severity: 'error',
            suggested_correction: mappedRow.latitude && mappedRow.longitude ? 
              `Try: ${parseFloat(mappedRow.latitude).toFixed(6)}, ${parseFloat(mappedRow.longitude).toFixed(6)}` : undefined
          });
        } else {
          if (lat < -90 || lat > 90) {
            errors.push({
              row_index: rowIndex + 2,
              field: 'latitude',
              message: 'Latitude must be between -90 and 90',
              severity: 'error'
            });
          }
          if (lng < -180 || lng > 180) {
            errors.push({
              row_index: rowIndex + 2,
              field: 'longitude',
              message: 'Longitude must be between -180 and 180',
              severity: 'error'
            });
          }
          
          // Only add valid coordinates to validRows
          if (errors.filter(e => e.row_index === rowIndex + 2).length === 0) {
            validRows.push({
              user_id: currentUser?.id || '',
              species_name: mappedRow.species_name || '',
              observation_timestamp: mappedRow.observation_timestamp || '',
              latitude: lat,
              longitude: lng,
              notes: mappedRow.notes || '',
              habitat_type: mappedRow.habitat_type || '',
              is_private: false
            });
          }
        }
      }
      
      // Date validation
      if (mappedRow.observation_timestamp) {
        const date = new Date(mappedRow.observation_timestamp);
        const now = new Date();
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(now.getDate() - 90);
        
        if (isNaN(date.getTime())) {
          errors.push({
            row_index: rowIndex + 2,
            field: 'observation_timestamp',
            message: 'Invalid date format',
            severity: 'error'
          });
        } else if (date > now) {
          errors.push({
            row_index: rowIndex + 2,
            field: 'observation_timestamp',
            message: 'Observation date cannot be in the future',
            severity: 'error'
          });
        } else if (date < ninetyDaysAgo) {
          errors.push({
            row_index: rowIndex + 2,
            field: 'observation_timestamp',
            message: 'Observation date older than 90 days',
            severity: 'warning'
          });
        }
      }
    });
    
    return {
      valid_rows: validRows,
      validation_errors: errors,
      duplicate_observations: duplicates
    };
  };

  // Process file upload
  const handleFileUpload = async (uploadedFile: File) => {
    setError(null);
    setFile(uploadedFile);
    setIsProcessing(true);
    
    try {
      const text = await uploadedFile.text();
      const { headers, rows } = parseCsv(text);
      
      setHeaders(headers);
      setCsvData(rows);
      
      // Auto-detect column mappings
      const autoMapping = autoDetectColumns(headers);
      setColumnMapping(autoMapping);
      
      // Initial validation
      const { valid_rows, validation_errors, duplicate_observations } = validateAndTransform();
      setValidObservations(valid_rows);
      setValidationErrors(validation_errors);
      setDuplicateObservations(duplicate_observations);
      
    } catch (err) {
      setError('Failed to process CSV file. Please check the format and try again.');
      console.error('CSV processing error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle column mapping changes
  const handleColumnMappingChange = (csvHeader: string, field: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [field]: csvHeader
    }));
    
    // Re-validate after mapping change
    if (file && csvData.length > 0) {
      const { valid_rows, validation_errors, duplicate_observations } = validateAndTransform();
      setValidObservations(valid_rows);
      setValidationErrors(validation_errors);
      setDuplicateObservations(duplicate_observations);
    }
  };

  // Submit batch observations
  const submitBatch = async () => {
    if (validObservations.length === 0) {
      setError('No valid observations to submit. Please fix errors and try again.');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // First validate the batch
      const validationResponse = await axios.post<BatchValidationResult>(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/observations/batch/validate`,
        { observations: validObservations }
      );
      
      setValidationErrors(validationResponse.data.validation_errors);
      setDuplicateObservations(validationResponse.data.duplicate_observations);
      
      // If there are critical errors, don't proceed
      const criticalErrors = validationResponse.data.validation_errors.filter(e => e.severity === 'error');
      if (criticalErrors.length > 0) {
        setError(`Validation failed with ${criticalErrors.length} critical errors. Please fix and resubmit.`);
        return;
      }
      
      // Submit the batch
      const response = await axios.post<BatchSubmissionResult>(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/observations/batch/import`,
        { observations: validObservations }
      );
      
      setSubmissionResult(response.data);
      
      // Reset form state after successful submission
      if (response.data.success_count > 0) {
        resetForm();
      }
      
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to submit batch observations';
      setError(errorMessage);
      console.error('Batch submission error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset form state
  const resetForm = () => {
    setFile(null);
    setCsvData([]);
    setHeaders([]);
    setColumnMapping({});
    setValidationErrors([]);
    setValidObservations([]);
    setDuplicateObservations([]);
    setSubmissionResult(null);
    setError(null);
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const csvFile = files.find(file => 
        file.name.endsWith('.csv') || file.type === 'text/csv'
      );
      
      if (csvFile) {
        handleFileUpload(csvFile);
      } else {
        setError('Please upload a CSV file');
      }
    }
  };

  // File input change handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const csvFile = Array.from(files).find(file => 
        file.name.endsWith('.csv') || file.type === 'text/csv'
      );
      
      if (csvFile) {
        handleFileUpload(csvFile);
      } else {
        setError('Please select a CSV file');
      }
    }
  };

  // If still loading auth state, show loading spinner
  if (isLoadingAuth) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </>
    );
  }

  // If not authenticated or not Field Researcher, redirect (handled by useEffect)
  if (!isAuthenticated || expertiseLevel !== 'expert') {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Redirecting...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Navigation */}
        <nav className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Link to="/" className="text-xl font-semibold text-gray-900">
                  EcoPulse
                </Link>
              </div>
              <div className="flex items-center space-x-4">
                <Link 
                  to="/profile"
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Profile
                </Link>
                <Link 
                  to="/map"
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Map View
                </Link>
                <Link 
                  to="/verification-queue"
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Verification Queue
                </Link>
              </div>
            </div>
          </div>
        </nav>
        
        {/* Main content */}
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Batch Observation Submission</h1>
              <p className="text-gray-600 mb-6">
                Upload multiple observations at once using CSV format. Ideal for field surveys and large datasets.
              </p>
              
              {error && (
                <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                  <p>{error}</p>
                </div>
              )}
              
              {/* Template download */}
              <div className="mb-6 flex justify-end">
                <button
                  onClick={handleDownloadTemplate}
                  disabled={isProcessing}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                  </svg>
                  Download CSV Template
                </button>
              </div>
              
              {/* File upload area */}
              {!file && (
                <div 
                  className={`border-2 border-dashed rounded-lg p-8 text-center ${
                    isProcessing ? 'border-gray-300 bg-gray-50' : 'border-gray-300 hover:border-blue-500 bg-white'
                  }`}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label
                    htmlFor="csv-upload"
                    className={`cursor-pointer ${isProcessing ? 'pointer-events-none' : ''}`}
                  >
                    <div className="flex flex-col items-center">
                      <div className="bg-blue-100 rounded-full p-3 mb-4">
                        <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {isProcessing ? 'Processing file...' : 'Upload CSV File'}
                      </h3>
                      <p className="text-gray-600 mb-2">
                        Drag and drop your CSV file here or click to browse
                      </p>
                      <p className="text-sm text-gray-500">
                        Must be a valid CSV file with observation data
                      </p>
                    </div>
                  </label>
                </div>
              )}
              
              {/* CSV Preview and Column Mapping */}
              {file && (
                <div className="space-y-6">
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h2 className="text-lg font-semibold text-gray-900">CSV Preview</h2>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            {headers.map((header, index) => (
                              <th 
                                key={`header-${index}`}
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {csvData.slice(0, 5).map((row, rowIndex) => (
                            <tr key={`row-${rowIndex}`}>
                              {headers.map((header, colIndex) => (
                                <td 
                                  key={`cell-${rowIndex}-${colIndex}`}
                                  className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                                >
                                  {row[header] || '-'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {csvData.length > 5 && (
                        <div className="px-6 py-3 bg-gray-50 text-sm text-gray-500">
                          And {csvData.length - 5} more rows
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Column Mapping Interface */}
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h2 className="text-lg font-semibold text-gray-900">Column Mapping</h2>
                      <p className="text-sm text-gray-500 mt-1">
                        Map your CSV columns to EcoPulse observation fields
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              CSV Column
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              EcoPulse Field
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {headers.map((csvHeader, index) => (
                            <tr key={`mapping-${index}`}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {csvHeader}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <select
                                  value={columnMapping[csvHeader] || ''}
                                  onChange={(e) => handleColumnMappingChange(csvHeader, e.target.value)}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                >
                                  <option value="">-- Select Field --</option>
                                  <option value="species_name">Species Name</option>
                                  <option value="observation_timestamp">Observation Timestamp</option>
                                  <option value="latitude">Latitude</option>
                                  <option value="longitude">Longitude</option>
                                  <option value="notes">Notes</option>
                                  <option value="habitat_type">Habitat Type</option>
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  {/* Validation Results */}
                  {(validationErrors.length > 0 || duplicateObservations.length > 0) && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900">Validation Results</h3>
                      
                      {validationErrors.length > 0 && (
                        <div className="bg-white rounded-lg shadow overflow-hidden">
                          <div className="px-6 py-4 border-b border-gray-200">
                            <h4 className="text-md font-medium text-gray-900">Validation Errors ({validationErrors.length})</h4>
                          </div>
                          <ul className="divide-y divide-gray-200 max-h-60 overflow-y-auto">
                            {validationErrors.map((error, index) => (
                              <li 
                                key={`error-${index}`} 
                                className={`px-6 py-4 ${
                                  error.severity === 'error' ? 'bg-red-50' : 'bg-yellow-50'
                                }`}
                              >
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">
                                      Row {error.row_index}: {error.field}
                                    </p>
                                    <p className="text-sm text-gray-700 mt-1">{error.message}</p>
                                  </div>
                                  {error.suggested_correction && (
                                    <div className="ml-4 flex-shrink-0">
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                        Suggestion: {error.suggested_correction}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {duplicateObservations.length > 0 && (
                        <div className="bg-white rounded-lg shadow overflow-hidden">
                          <div className="px-6 py-4 border-b border-gray-200">
                            <h4 className="text-md font-medium text-gray-900">
                              Duplicates Detected ({duplicateObservations.length})
                            </h4>
                          </div>
                          <ul className="divide-y divide-gray-200 max-h-60 overflow-y-auto">
                            {duplicateObservations.map((obs, index) => (
                              <li key={`dup-${index}`} className="px-6 py-4">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">
                                      {obs.species_name} at {obs.latitude.toFixed(4)}, {obs.longitude.toFixed(4)}
                                    </p>
                                    <p className="text-sm text-gray-700 mt-1">
                                      Observed on {new Date(obs.observation_timestamp).toLocaleDateString()}
                                    </p>
                                  </div>
                                  <div className="ml-4">
                                    <button
                                      onClick={() => {
                                        // In a real implementation, this would trigger a merge workflow
                                        alert('Merge functionality would be implemented here');
                                      }}
                                      className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                                    >
                                      Review Merge Options
                                    </button>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Submission Controls */}
                  <div className="flex justify-between items-center mt-6">
                    <button
                      onClick={resetForm}
                      disabled={isProcessing}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      Reset Form
                    </button>
                    
                    {file && (
                      <button
                        onClick={submitBatch}
                        disabled={isProcessing || validObservations.length === 0}
                        className={`px-6 py-2 rounded-md text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                          validObservations.length > 0 && !isProcessing
                            ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                            : 'bg-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {isProcessing ? (
                          <span className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Processing...
                          </span>
                        ) : (
                          `Submit ${validObservations.length} Valid Observations`
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
              
              {/* Submission Results */}
              {submissionResult && (
                <div className="mt-8 bg-white rounded-lg shadow overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Submission Results</h2>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center">
                          <div className="bg-green-100 rounded-full p-2 mr-3">
                            <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm text-green-700">Successfully Processed</p>
                            <p className="text-2xl font-bold text-green-900">{submissionResult.success_count}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-center">
                          <div className="bg-yellow-100 rounded-full p-2 mr-3">
                            <svg className="h-5 w-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm text-yellow-700">Partial Success</p>
                            <p className="text-2xl font-bold text-yellow-900">{submissionResult.invalid_observations}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center">
                          <div className="bg-blue-100 rounded-full p-2 mr-3">
                            <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm text-blue-700">Duplicates Found</p>
                            <p className="text-2xl font-bold text-blue-900">{submissionResult.duplicate_observations}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-6 flex justify-end">
                      <button
                        onClick={resetForm}
                        className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Submit Another Batch
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default UV_BATCH_SUBMISSION;