import React, { useState, useMemo } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import { z } from 'zod';
import axios from 'axios';

// Define Zod schemas matching expected API response
const habitatGuideParameterSchema = z.object({
  name: z.string(),
  description: z.string(),
  scale: z.string(),
  examples: z.array(
    z.object({
      value: z.number(),
      description: z.string(),
      image_url: z.string().url().optional()
    })
  )
});

const restorationGalleryItemSchema = z.object({
  title: z.string(),
  before_image: z.string().url(),
  after_image: z.string().url(),
  description: z.string().optional()
});

const habitatGuideSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  parameters: z.array(habitatGuideParameterSchema),
  restoration_gallery: z.array(restorationGalleryItemSchema).optional(),
  pdf_guide_url: z.string().url().optional(),
  terminology: z.record(
    z.object({
      term: z.string(),
      definition: z.string(),
      context: z.string().optional()
    })
  ).optional()
});

export type HabitatGuide = z.infer<typeof habitatGuideSchema>;

// Data fetching function
const fetchHabitatGuides = async (guideId?: string) => {
  const response = await axios.get<HabitatGuide[]>(
    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/educational/habitat-guides`,
    {
      params: guideId ? { guide_id: guideId } : undefined
    }
  );
  
  // Transform API response to match expected types
  return response.data.map(guide => ({
    ...guide,
    parameters: guide.parameters.map(param => ({
      ...param,
      examples: param.examples.map(example => ({
        ...example,
        value: Number(example.value)
      }))
    })),
    restoration_gallery: guide.restoration_gallery?.map(item => ({
      ...item,
      before_image: String(item.before_image),
      after_image: String(item.after_image)
    }))
  }));
};

// Custom hook for data fetching
const useHabitatGuides = (guideId?: string) => {
  return useQuery<HabitatGuide[], Error>(
    ['habitatGuides', guideId],
    () => fetchHabitatGuides(guideId),
    {
      staleTime: 60000,
      refetchOnWindowFocus: false,
      retry: 1,
      select: (data) => data // No additional transformation needed since we handle it in fetch
    }
  );
};

const UV_HABITAT_GUIDE: React.FC = () => {
  // Critical: Individual selectors, no object destructuring (prevents infinite loops)
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const isLoadingAuth = useAppStore(state => state.authentication_state.authentication_status.is_loading);
  
  // Get URL parameters
  const { guide_id } = useParams<{ guide_id?: string }>();
  const location = useLocation();
  
  // Initialize query client
  const queryClient = useQueryClient();
  
  // Fetch habitat guides data
  const { data, isLoading, isError, error } = useHabitatGuides(guide_id);
  
  // State for interactive elements
  const [activeParameter, setActiveParameter] = useState<string | null>(null);
  const [expandedGalleryItems, setExpandedGalleryItems] = useState<Set<number>>(new Set());
  const [activeTerminology, setActiveTerminology] = useState<string | null>(null);
  
  // Memoize current guide selection
  const currentGuide = useMemo(() => {
    if (!data || data.length === 0) return null;
    
    if (guide_id) {
      return data.find(guide => guide.id === guide_id) || data[0];
    }
    return data[0];
  }, [data, guide_id]);
  
  // Toggle gallery item expansion
  const toggleGalleryItem = (index: number) => {
    setExpandedGalleryItems(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };
  
  // Handle PDF download
  const handleDownloadPDF = (e: React.MouseEvent) => {
    e.preventDefault();
    
    if (!currentGuide?.pdf_guide_url) return;
    
    try {
      window.open(currentGuide.pdf_guide_url, '_blank');
    } catch (err) {
      console.error('Error downloading PDF:', err);
      alert('Failed to download guide. Please try again.');
    }
  };
  
  // Render parameter slider with examples
  const renderParameterSlider = (parameter: z.infer<typeof habitatGuideParameterSchema>) => {
    const isActive = activeParameter === parameter.name;
    
    return (
      <div 
        key={parameter.name}
        className={`rounded-xl border transition-all duration-200 ${
          isActive 
            ? 'border-blue-300 bg-blue-50 shadow-md' 
            : 'border-gray-200 hover:border-gray-300'
        }`}
        onMouseEnter={() => setActiveParameter(parameter.name)}
        onMouseLeave={() => setActiveParameter(null)}
      >
        <div className="p-5">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-lg font-semibold text-gray-900">{parameter.name.replace(/_/g, ' ')}</h3>
            <span className="text-sm font-medium text-blue-600">{parameter.scale}</span>
          </div>
          
          <p className="text-gray-600 mb-4 text-sm leading-relaxed">
            {parameter.description}
          </p>
          
          {/* Slider playground */}
          <div className="relative pt-6 pb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Min</span>
              <span>Max</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-400 to-yellow-400 to-red-500 rounded-full"
                style={{ width: '100%' }}
              ></div>
            </div>
            <div 
              className="absolute left-0 top-0 h-5 w-5 bg-white border-2 border-blue-500 rounded-full shadow transform -translate-x-1/2 -translate-y-1/2 cursor-pointer"
              style={{ left: '50%' }}
            ></div>
          </div>
          
          {/* Examples */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {parameter.examples.map((example, idx) => (
              <div 
                key={idx}
                className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm"
              >
                {example.image_url && (
                  <div className="h-24 bg-gray-100 border-b border-gray-200 flex items-center justify-center">
                    <img 
                      src={example.image_url} 
                      alt={`Example for ${parameter.name} value ${example.value}`}
                      className="max-w-full h-auto"
                      loading="lazy"
                    />
                  </div>
                )}
                <div className="p-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-900">Value: {example.value}</span>
                    <span className="text-xs text-gray-500">{example.description}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };
  
  // Render restoration gallery
  const renderRestorationGallery = () => {
    if (!currentGuide?.restoration_gallery || currentGuide.restoration_gallery.length === 0) {
      return null;
    }
    
    return (
      <div className="mt-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Restoration Examples</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {currentGuide.restoration_gallery.map((item, index) => {
            const isExpanded = expandedGalleryItems.has(index);
            
            return (
              <div 
                key={index} 
                className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-lg"
              >
                <div 
                  className="p-4 cursor-pointer flex justify-between items-center"
                  onClick={() => toggleGalleryItem(index)}
                >
                  <h3 className="font-semibold text-gray-900">{item.title}</h3>
                  <span className="text-gray-500">
                    {isExpanded ? '▼' : '▲'}
                  </span>
                </div>
                
                {isExpanded && (
                  <div className="border-t border-gray-100 p-4">
                    {item.description && (
                      <p className="text-gray-600 mb-4 text-sm leading-relaxed">
                        {item.description}
                      </p>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Before</h4>
                        <div className="bg-gray-100 rounded-lg overflow-hidden h-40 flex items-center justify-center">
                          <img 
                            src={item.before_image} 
                            alt={`Before restoration: ${item.title}`}
                            className="max-w-full h-auto"
                            loading="lazy"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">After</h4>
                        <div className="bg-gray-100 rounded-lg overflow-hidden h-40 flex items-center justify-center">
                          <img 
                            src={item.after_image} 
                            alt={`After restoration: ${item.title}`}
                            className="max-w-full h-auto"
                            loading="lazy"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  
  // Render terminology dictionary
  const renderTerminologyDictionary = () => {
    if (!currentGuide?.terminology || Object.keys(currentGuide.terminology).length === 0) {
      return null;
    }
    
    const terms = Object.values(currentGuide.terminology);
    
    return (
      <div className="mt-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Terminology Dictionary</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {terms.map((term, index) => {
            const isActive = activeTerminology === term.term;
            
            return (
              <div 
                key={index}
                className={`p-4 rounded-lg border transition-colors ${
                  isActive 
                    ? 'border-blue-300 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onMouseEnter={() => setActiveTerminology(term.term)}
                onMouseLeave={() => setActiveTerminology(null)}
              >
                <div className="flex">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{term.term}</h3>
                    {term.context && (
                      <p className="text-xs text-gray-500 mt-1">Context: {term.context}</p>
                    )}
                  </div>
                  <div className="ml-3 flex-shrink-0">
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500 opacity-70"></span>
                  </div>
                </div>
                
                {isActive && (
                  <div className="mt-2 pt-2 border-t border-blue-100">
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {term.definition}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Loading state
  if (isLoading || isLoadingAuth) {
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-3/4 mb-6"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
              
              <div className="space-y-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-white rounded-xl shadow-sm p-6">
                    <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-2/3 mb-3"></div>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div className="h-24 bg-gray-100 rounded-lg"></div>
                      <div className="h-24 bg-gray-100 rounded-lg"></div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-10 h-12 bg-gray-200 rounded w-1/4 mx-auto"></div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Error state
  if (isError) {
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg p-8 text-center">
              <div className="text-red-500 text-5xl mb-4">⚠️</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Guide</h2>
              <p className="text-gray-600 mb-6">
                {error instanceof Error ? error.message : 'Failed to load habitat guides'}
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => queryClient.invalidateQueries(['habitatGuides', guide_id])}
                  className="px-6 py-3 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
                >
                  Try Again
                </button>
                <Link
                  to="/help-center"
                  className="px-6 py-3 rounded-lg font-medium bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-300 transition-colors"
                >
                  Visit Help Center
                </Link>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Empty state
  if (!data || data.length === 0) {
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg p-8 text-center">
              <div className="text-gray-400 text-5xl mb-4">📚</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">No Guides Available</h2>
              <p className="text-gray-600 mb-6">
                There are currently no habitat guides available. Check back later or contact support.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/"
                  className="px-6 py-3 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
                >
                  Return to Dashboard
                </Link>
                <Link
                  to="/help-center"
                  className="px-6 py-3 rounded-lg font-medium bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-300 transition-colors"
                >
                  Contact Support
                </Link>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Main content
  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <header className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 leading-tight mb-4">
              Habitat Health Assessment Guide
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Learn how to properly assess habitat health with our interactive guide. 
              Designed for educators and community scientists to ensure consistent, 
              accurate ecological evaluations.
            </p>
            
            {currentUser && (
              <div className="mt-6 text-sm text-gray-500">
                You're viewing as: <span className="font-medium text-gray-900">{currentUser.full_name}</span>
                {currentUser.expertise_level && ` (${currentUser.expertise_level})`}
              </div>
            )}
          </header>
          
          {/* Guide selection */}
          {data.length > 1 && (
            <div className="mb-8">
              <label htmlFor="guide-select" className="block text-sm font-medium text-gray-700 mb-2">
                Select Habitat Guide
              </label>
              <select
                id="guide-select"
                value={guide_id || data[0].id}
                onChange={(e) => window.location.href = `/guides?guide_id=${e.target.value}`}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md shadow-sm appearance-none bg-white"
              >
                {data.map(guide => (
                  <option key={guide.id} value={guide.id}>
                    {guide.title}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          {/* Current guide content */}
          {currentGuide && (
            <>
              {currentGuide.description && (
                <section className="bg-white rounded-xl shadow-lg p-6 mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">About This Guide</h2>
                  <p className="text-gray-600 leading-relaxed">
                    {currentGuide.description}
                  </p>
                  
                  {currentGuide.pdf_guide_url && (
                    <div className="mt-6 flex items-center justify-center sm:justify-start">
                      <button
                        onClick={handleDownloadPDF}
                        className="inline-flex items-center px-5 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                      >
                        <svg className="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                        </svg>
                        Download Complete Guide (PDF)
                      </button>
                    </div>
                  )}
                </section>
              )}
              
              {/* Parameter sliders */}
              <section className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Assessment Parameters</h2>
                
                <div className="space-y-6">
                  {currentGuide.parameters.map(renderParameterSlider)}
                </div>
                
                <div className="mt-8 bg-blue-50 border border-blue-100 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-blue-900 mb-3">Scoring Tips</h3>
                  <ul className="list-disc list-inside text-blue-700 space-y-2">
                    <li>Consider seasonal variations when assessing habitat health</li>
                    <li>Take multiple measurements for more accurate results</li>
                    <li>Document your observations with photos when possible</li>
                    <li>Compare with historical data if available</li>
                  </ul>
                </div>
              </section>
              
              {/* Restoration gallery */}
              {renderRestorationGallery()}
              
              {/* Terminology dictionary */}
              {renderTerminologyDictionary()}
              
              {/* Practice section */}
              <section className="mt-12 bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Practice Your Skills</h2>
                
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Interactive Slider Playground</h3>
                  
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Try adjusting these parameters to see how the habitat health score changes
                    </label>
                    
                    <div className="space-y-4">
                      {[
                        { name: 'water_quality', label: 'Water Quality', value: 3, min: 1, max: 5 },
                        { name: 'biodiversity_index', label: 'Biodiversity', value: 4, min: 1, max: 5 },
                        { name: 'invasive_species', label: 'Invasive Species', value: 2, min: 1, max: 5 }
                      ].map((param) => (
                        <div key={param.name}>
                          <div className="flex justify-between mb-1">
                            <label className="text-sm font-medium text-gray-700">
                              {param.label}
                            </label>
                            <span className="text-sm text-gray-500">{param.value}/5</span>
                          </div>
                          <input
                            type="range"
                            min={param.min}
                            max={param.max}
                            value={param.value}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            readOnly
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3 flex-1">
                        <p className="text-sm font-medium text-green-800">
                          Current Habitat Health Score: <span className="font-bold">78/100</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 text-center">
                  <Link
                    to="/submit"
                    className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    Apply This Knowledge - Submit Observation
                  </Link>
                </div>
              </section>
            </>
          )}
          
          {/* Footer navigation */}
          <footer className="mt-16 pt-8 border-t border-gray-200 text-center">
            <div className="space-y-4">
              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  to="/"
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  to="/map"
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Map Explorer
                </Link>
                <Link
                  to="/submit"
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Submit Observation
                </Link>
                <Link
                  to="/verification-queue"
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Verification Queue
                </Link>
              </div>
              
              <div className="text-gray-500 text-sm">
                Habitat guides are updated regularly based on new research and community feedback.
              </div>
              
              <div className="text-gray-500 text-sm">
                Last updated: {new Date().toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </div>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
};

export default UV_HABITAT_GUIDE;