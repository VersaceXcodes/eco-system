import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/store/main';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import axios from 'axios';

// Define TypeScript interfaces based on API responses and requirements
interface LocationBounds {
  lat_min: number;
  lat_max: number;
  lng_min: number;
  lng_max: number;
}

interface DateRange {
  start_date: string | null;
  end_date: string | null;
}

interface SearchFilters {
  species_id?: string;
  location_bounds?: LocationBounds;
  date_range?: DateRange;
}

interface ObservationResult {
  id: string;
  species: string;
  location: {
    lat: number;
    lng: number;
  };
  observation_timestamp: string;
  verification_status: string;
  is_private: boolean;
}

interface UserResult {
  id: string;
  full_name: string;
  expertise_level: string;
  credibility_score: number;
}

interface SpeciesResult {
  id: string;
  common_name: string;
  scientific_name: string;
}

interface SearchResult {
  observations: ObservationResult[];
  users: UserResult[];
  species: SpeciesResult[];
}

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: SearchFilters;
  created_at: string;
}

interface SearchResponse {
  data: {
    items: ObservationResult[];
    users: UserResult[];
    species: SpeciesResult[];
    total: number;
  };
}

// Define Zustand state schema for search
const searchStateSchema = z.object({
  query: z.string().default(''),
  filters: z.object({
    species_id: z.string().optional(),
    location_bounds: z.object({
      lat_min: z.number().optional(),
      lat_max: z.number().optional(),
      lng_min: z.number().optional(),
      lng_max: z.number().optional(),
    }).optional(),
    date_range: z.object({
      start_date: z.string().nullable().optional(),
      end_date: z.string().nullable().optional(),
    }).optional(),
  }).default({}),
  results: z.object({
    observations: z.array(z.object({
      id: z.string(),
      species: z.string(),
      location: z.object({
        lat: z.number(),
        lng: z.number(),
      }),
      observation_timestamp: z.string(),
      verification_status: z.string(),
      is_private: z.boolean(),
    })).default([]),
    users: z.array(z.object({
      id: z.string(),
      full_name: z.string(),
      expertise_level: z.string(),
      credibility_score: z.number(),
    })).default([]),
    species: z.array(z.object({
      id: z.string(),
      common_name: z.string(),
      scientific_name: z.string(),
    })).default([]),
  }),
  saved_searches: z.array(z.object({
    id: z.string(),
    name: z.string(),
    query: z.string(),
    filters: z.object({
      species_id: z.string().optional(),
      location_bounds: z.object({
        lat_min: z.number().optional(),
        lat_max: z.number().optional(),
        lng_min: z.number().optional(),
        lng_max: z.number().optional(),
      }).optional(),
      date_range: z.object({
        start_date: z.string().nullable().optional(),
        end_date: z.string().nullable().optional(),
      }).optional(),
    }),
    created_at: z.string(),
  })).default([]),
  is_searching: z.boolean().default(false),
  search_error: z.string().nullable().default(null),
});

type SearchState = z.infer<typeof searchStateSchema>;

// API functions
const performSearch = async (query: string, filters: SearchFilters): Promise<SearchResponse> => {
  const { data } = await axios.get(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/observations`, {
    params: {
      query,
      species: filters.species_id,
      start_date: filters.date_range?.start_date,
      end_date: filters.date_range?.end_date,
      lat_min: filters.location_bounds?.lat_min,
      lat_max: filters.location_bounds?.lat_max,
      lng_min: filters.location_bounds?.lng_min,
      lng_max: filters.location_bounds?.lng_max,
    },
    headers: {
      Authorization: `Bearer ${useAppStore.getState().authentication_state.auth_token}`,
    },
  });
  
  return data;
};

const saveSearch = async (name: string, query: string, filters: SearchFilters): Promise<SavedSearch> => {
  const { data } = await axios.post(
    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/user_searches`,
    { name, query, filters },
    {
      headers: {
        Authorization: `Bearer ${useAppStore.getState().authentication_state.auth_token}`,
      },
    }
  );
  
  return data;
};

const fetchSavedSearches = async (): Promise<SavedSearch[]> => {
  const { data } = await axios.get(
    `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/user_searches`,
    {
      headers: {
        Authorization: `Bearer ${useAppStore.getState().authentication_state.auth_token}`,
      },
    }
  );
  
  return data;
};

const GV_SEARCH: React.FC = () => {
  // Global state access - CRITICAL: Individual selectors only to avoid infinite loops
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const expertiseLevel = useAppStore(state => state.user_profile_state.expertise_level);
  const mapCenter = useAppStore(state => state.map_state.map_center);
  const savedSearches = useAppStore(state => state.search_state.saved_searches);
  const setSearchState = useAppStore(state => state.set_search_state);
  const clearSearchState = useAppStore(state => state.clear_search_state);
  
  // Local state
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'observations' | 'users' | 'species'>('observations');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 300);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [selectedSavedSearch, setSelectedSavedSearch] = useState<SavedSearch | null>(null);
  const [showSavedSearches, setShowSavedSearches] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // API queries
  const searchQueryResult = useQuery<SearchResponse, Error>({
    queryKey: ['search', debouncedQuery, filters],
    queryFn: () => performSearch(debouncedQuery, filters),
    enabled: isOpen && debouncedQuery.length > 0,
    staleTime: 60000,
    refetchOnWindowFocus: false,
    retry: 1,
    select: (data) => ({
      ...data,
      data: {
        ...data.data,
        items: data.data.items.map(item => ({
          ...item,
          observation_timestamp: new Date(item.observation_timestamp).toISOString(),
        })),
      },
    }),
  });
  
  const savedSearchesQuery = useQuery<SavedSearch[], Error>({
    queryKey: ['savedSearches'],
    queryFn: fetchSavedSearches,
    enabled: isOpen && isAuthenticated,
    staleTime: 60000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  
  const saveSearchMutation = useMutation<SavedSearch, Error, { name: string }>({
    mutationFn: ({ name }) => saveSearch(name, searchQuery, filters),
    onSuccess: (savedSearch) => {
      queryClient.setQueryData<SavedSearch[]>(['savedSearches'], (old = []) => [
        ...old,
        savedSearch
      ]);
      setShowSavedSearches(false);
    },
  });
  
  // Set up global keyboard listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
      
      // Global search shortcut (Ctrl + K or Cmd + K)
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setTimeout(() => {
            searchInputRef.current?.focus();
          }, 100);
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);
  
  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);
  
  // Initialize search state when opening
  useEffect(() => {
    if (isOpen) {
      // Set default location filter based on current map center
      if (mapCenter.lat !== 0 && mapCenter.lng !== 0) {
        setFilters(prev => ({
          ...prev,
          location_bounds: {
            lat_min: mapCenter.lat - 0.5,
            lat_max: mapCenter.lat + 0.5,
            lng_min: mapCenter.lng - 0.5,
            lng_max: mapCenter.lng + 0.5,
          }
        }));
      }
      
      // Focus search input after a small delay
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, mapCenter]);
  
  // Handle search input changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setSearchState({ query: value });
    
    // Clear saved search selection when query changes
    if (selectedSavedSearch) {
      setSelectedSavedSearch(null);
    }
  };
  
  // Clear search state
  const handleClearSearch = () => {
    setSearchQuery('');
    setFilters({});
    setActiveTab('observations');
    setIsFilterExpanded(false);
    setSelectedSavedSearch(null);
    clearSearchState();
    searchQueryResult.refetch();
  };
  
  // Close search overlay
  const handleClose = () => {
    setIsOpen(false);
    handleClearSearch();
  };
  
  // Apply saved search
  const handleApplySavedSearch = (savedSearch: SavedSearch) => {
    setSearchQuery(savedSearch.query);
    setFilters(savedSearch.filters);
    setSelectedSavedSearch(savedSearch);
    setShowSavedSearches(false);
  };
  
  // Save current search
  const handleSaveSearch = () => {
    const name = prompt('Enter a name for this search:');
    if (name && name.trim()) {
      saveSearchMutation.mutate({ name: name.trim() });
    }
  };
  
  // Navigate to observation detail
  const handleObservationClick = (observationId: string) => {
    handleClose();
    navigate(`/observation/${observationId}`);
  };
  
  // Navigate to user profile
  const handleUserClick = (userId: string) => {
    handleClose();
    navigate(`/profile?user_id=${userId}`);
  };
  
  // Navigate to species spotlight
  const handleSpeciesClick = (speciesId: string) => {
    handleClose();
    navigate(`/species?species_id=${speciesId}`);
  };
  
  // Filter change handlers
  const handleDateRangeChange = (field: 'start_date' | 'end_date', value: string) => {
    setFilters(prev => ({
      ...prev,
      date_range: {
        ...prev.date_range,
        [field]: value || null,
      }
    }));
  };
  
  const handleLocationBoundsChange = (bounds: Partial<LocationBounds>) => {
    setFilters(prev => ({
      ...prev,
      location_bounds: {
        ...prev.location_bounds,
        ...bounds,
      } as LocationBounds
    }));
  };
  
  const handleSpeciesFilterChange = (speciesId: string) => {
    setFilters(prev => ({
      ...prev,
      species_id: speciesId === 'all' ? undefined : speciesId,
    }));
  };
  
  // Calculate result counts
  const resultCounts = {
    observations: searchQueryResult.data?.data.items.length || 0,
    users: searchQueryResult.data?.data.users.length || 0,
    species: searchQueryResult.data?.data.species.length || 0,
  };
  
  // Get filtered results based on active tab
  const getActiveResults = () => {
    if (!searchQueryResult.data) return [];
    
    switch (activeTab) {
      case 'observations':
        return searchQueryResult.data.data.items;
      case 'users':
        return searchQueryResult.data.data.users;
      case 'species':
        return searchQueryResult.data.data.species;
      default:
        return [];
    }
  };
  
  // Render search suggestions (simplified for now)
  const renderSuggestions = () => {
    if (!searchQuery || searchQuery.length < 2) return null;
    
    // In a real implementation, this would come from an API
    const suggestions = [
      `${searchQuery} birds`,
      `${searchQuery} plants`,
      `${searchQuery} insects`,
      `Recent ${searchQuery} observations`,
    ];
    
    return (
      <div className="absolute z-10 w-full mt-1 bg-white shadow-lg rounded-md border border-gray-200 max-h-60 overflow-y-auto">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            className="w-full px-4 py-2 text-left hover:bg-gray-50 focus:outline-none focus:bg-gray-50"
            onClick={() => {
              setSearchQuery(suggestion);
              setSearchState({ query: suggestion });
            }}
          >
            {suggestion}
          </button>
        ))}
      </div>
    );
  };
  
  // Render search results
  const renderResults = () => {
    const results = getActiveResults();
    
    if (searchQueryResult.isLoading) {
      return (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }
    
    if (searchQueryResult.error) {
      return (
        <div className="text-center py-8 text-red-600">
          <p>Error loading search results. Please try again.</p>
        </div>
      );
    }
    
    if (results.length === 0 && !searchQueryResult.isLoading) {
      return (
        <div className="text-center py-8 text-gray-500">
          <p>No {activeTab} found matching "{searchQuery}"</p>
          {searchQuery.length >= 3 && (
            <button
              onClick={handleSaveSearch}
              className="mt-2 text-blue-600 hover:text-blue-800"
            >
              Save this search for later
            </button>
          )}
        </div>
      );
    }
    
    switch (activeTab) {
      case 'observations':
        return (
          <div className="space-y-4">
            {results.map((observation: ObservationResult) => (
              <div 
                key={observation.id} 
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleObservationClick(observation.id)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{observation.species}</h3>
                    <p className="text-gray-600 text-sm mt-1">
                      Observed: {new Date(observation.observation_timestamp).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                    observation.verification_status === 'verified' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {observation.verification_status}
                  </span>
                </div>
                <div className="mt-2 flex items-center text-sm text-gray-500">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{observation.location.lat.toFixed(4)}, {observation.location.lng.toFixed(4)}</span>
                </div>
              </div>
            ))}
          </div>
        );
      
      case 'users':
        return (
          <div className="space-y-4">
            {results.map((user: UserResult) => (
              <div 
                key={user.id} 
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleUserClick(user.id)}
              >
                <div className="flex items-center">
                  <div className="bg-blue-100 rounded-full p-2 mr-3">
                    <svg className="w-5 h-5 text-blue-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{user.full_name}</h3>
                    <div className="flex items-center mt-1">
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                        user.expertise_level === 'expert' 
                          ? 'bg-purple-100 text-purple-800' 
                          : user.expertise_level === 'intermediate'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                      }`}>
                        {user.expertise_level.charAt(0).toUpperCase() + user.expertise_level.slice(1)}
                      </span>
                      <span className="ml-2 text-gray-500">★ {user.credibility_score}/100</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      
      case 'species':
        return (
          <div className="space-y-4">
            {results.map((species: SpeciesResult) => (
              <div 
                key={species.id} 
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleSpeciesClick(species.id)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{species.common_name}</h3>
                    <p className="text-gray-600 italic text-sm mt-1">
                      {species.scientific_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                      Species
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
    }
  };
  
  // Render active filters summary
  const renderActiveFilters = () => {
    const activeFilters = [];
    
    if (filters.species_id) {
      activeFilters.push(`Species: ${filters.species_id}`);
    }
    
    if (filters.date_range?.start_date || filters.date_range?.end_date) {
      const startDate = filters.date_range.start_date 
        ? new Date(filters.date_range.start_date).toLocaleDateString() 
        : 'Earliest';
      const endDate = filters.date_range.end_date 
        ? new Date(filters.date_range.end_date).toLocaleDateString() 
        : 'Latest';
      activeFilters.push(`Date: ${startDate} - ${endDate}`);
    }
    
    if (filters.location_bounds) {
      activeFilters.push('Location: Current area');
    }
    
    if (activeFilters.length === 0) return null;
    
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-md p-2 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-blue-800">Active filters:</span>
          {activeFilters.map((filter, index) => (
            <span 
              key={index}
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
            >
              {filter}
              <button 
                onClick={() => {
                  // Clear specific filter logic would go here
                  setFilters({});
                }}
                className="ml-1 inline-flex text-blue-400 hover:text-blue-600"
              >
                <span className="sr-only">Remove filter</span>
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
          <button 
            onClick={() => setFilters({})}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Clear all filters
          </button>
        </div>
      </div>
    );
  };
  
  // Render the component
  return (
    <>
      {/* Global search trigger button - would typically be in GV_NAV */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-4 right-4 z-50 bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        aria-label="Open search"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>
      
      {/* Search overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4 transition-opacity"
          aria-modal="true"
          role="dialog"
          aria-labelledby="search-modal-title"
        >
          <div 
            ref={containerRef}
            className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
            role="document"
          >
            {/* Search header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-br from-blue-50 to-indigo-50">
              <div className="flex items-center justify-between">
                <h2 id="search-modal-title" className="text-2xl font-bold text-gray-900">
                  Search EcoPulse
                </h2>
                <button
                  onClick={handleClose}
                  className="text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded-lg p-1"
                  aria-label="Close search"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Search input */}
              <div className="mt-4 relative">
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Search observations, species, users, and help articles..."
                    aria-label="Search input"
                  />
                </div>
                
                {/* Suggestions */}
                {searchQuery.length >= 2 && renderSuggestions()}
              </div>
              
              {/* Active filters */}
              {renderActiveFilters()}
            </div>
            
            {/* Main content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Results tabs */}
              <div className="mb-4 border-b border-gray-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                  {['observations', 'users', 'species'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab as typeof activeTab)}
                      className={`${
                        activeTab === tab
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
                      aria-selected={activeTab === tab}
                      role="tab"
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      {resultCounts[tab as keyof typeof resultCounts] > 0 && (
                        <span className={`ml-2 inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-medium ${
                          activeTab === tab ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {resultCounts[tab as keyof typeof resultCounts]}
                        </span>
                      )}
                    </button>
                  ))}
                </nav>
              </div>
              
              {/* Results */}
              <div>
                {renderResults()}
              </div>
              
              {/* Saved searches dropdown */}
              {isAuthenticated && savedSearches.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-medium text-gray-900">Saved Searches</h3>
                    <button
                      onClick={() => setShowSavedSearches(!showSavedSearches)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      {showSavedSearches ? 'Hide' : 'View All'}
                    </button>
                  </div>
                  
                  {showSavedSearches && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {savedSearches.map((savedSearch) => (
                        <div 
                          key={savedSearch.id} 
                          className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                            selectedSavedSearch?.id === savedSearch.id
                              ? 'border-blue-500 bg-blue-5'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => handleApplySavedSearch(savedSearch)}
                        >
                          <h4 className="font-medium text-gray-900">{savedSearch.name}</h4>
                          <p className="text-sm text-gray-500 truncate" title={savedSearch.query}>
                            {savedSearch.query}
                          </p>
                          <div className="mt-1 flex justify-between items-center">
                            <span className="text-xs text-gray-500">
                              {new Date(savedSearch.created_at).toLocaleDateString()}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // Delete saved search logic would go here
                              }}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {searchQuery && (
                    <button
                      onClick={handleSaveSearch}
                      disabled={saveSearchMutation.isPending}
                      className="mt-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saveSearchMutation.isPending ? (
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : null}
                      Save this search
                    </button>
                  )}
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <div className="flex flex-col sm:flex-row sm:justify-between items-center">
                <div className="text-sm text-gray-500 mb-2 sm:mb-0">
                  {searchQueryResult.data ? (
                    <>
                      Showing {getActiveResults().length} of {resultCounts.observations + resultCounts.users + resultCounts.species} total results
                    </>
                  ) : (
                    'Start typing to search across EcoPulse'
                  )}
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={handleClearSearch}
                    disabled={!searchQuery && Object.keys(filters).length === 0}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Clear
                  </button>
                  
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GV_SEARCH;