import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';

interface OfflineObservation {
  id: string;
  species: string;
  location: {
    lat: number;
    lng: number;
  };
  mediaCount: number;
  createdAt: Date;
  status: 'pending' | 'syncing' | 'conflict' | 'completed';
}

interface SyncProgress {
  total: number;
  completed: number;
  currentFile?: string;
  estimatedTime?: number;
}

const UV_OFFLINE_MODE: React.FC = () => {
  // Zustand store state - CRITICAL: Individual selectors only
  const isOffline = useAppStore(state => state.offline.is_offline);
  const pendingOperations = useAppStore(state => state.offline.pending_operations);
  const lastSync = useAppStore(state => state.offline.last_sync);
  const syncError = useAppStore(state => state.offline.sync_error);
  const startSync = useAppStore(state => state.start_sync);
  const resolveConflict = useAppStore(state => state.resolve_conflict);
  
  // Local component state
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  
  const queryClient = useQueryClient();

  // Network detection effect
  useEffect(() => {
    const handleOnline = () => {
      if (isOffline && pendingOperations.length > 0) {
        startSync();
      }
    };

    const handleOffline = () => {
      // System will automatically update isOffline through Zustand store
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isOffline, pendingOperations.length, startSync]);

  // Sync progress monitoring effect
  useEffect(() => {
    if (pendingOperations.length === 0 || !isOffline) {
      setSyncProgress(null);
      return;
    }

    // Calculate estimated sync time (simplified: 2 seconds per observation + 5 seconds per media file)
    const totalFiles = pendingOperations.reduce((sum, op) => sum + (op.media_files?.length || 0), 0);
    const estimatedTime = pendingOperations.length * 2 + totalFiles * 5;

    const progressInterval = setInterval(() => {
      setSyncProgress(prev => {
        if (!prev) return null;
        
        const newCompleted = Math.min(prev.completed + 1, prev.total);
        const remainingTime = Math.max(0, estimatedTime - (newCompleted * (estimatedTime / pendingOperations.length)));
        
        if (newCompleted >= prev.total) {
          clearInterval(progressInterval);
          return { ...prev, completed: newCompleted, estimatedTime: 0 };
        }
        
        return {
          ...prev,
          completed: newCompleted,
          estimatedTime: remainingTime
        };
      });
    }, 2000);

    return () => clearInterval(progressInterval);
  }, [pendingOperations, isOffline]);

  // Format date utility
  const formatDate = (date: Date | undefined): string => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculate sync progress
  const calculateSyncProgress = useCallback(() => {
    if (pendingOperations.length === 0) return null;
    
    const total = pendingOperations.length;
    const completed = pendingOperations.filter(op => op.status === 'completed').length;
    
    return {
      total,
      completed,
      currentFile: pendingOperations[completed]?.species,
      estimatedTime: Math.ceil(total * 5) // Simplified estimation
    };
  }, [pendingOperations]);

  // Handle conflict resolution
  const handleResolveConflict = (operationId: string) => {
    setSelectedOperation(operationId);
    setShowConflictModal(true);
  };

  // Confirm conflict resolution
  const confirmConflictResolution = () => {
    if (selectedOperation) {
      resolveConflict(selectedOperation);
      setShowConflictModal(false);
      setSelectedOperation(null);
    }
  };

  // Render offline observations list
  const renderPendingOperations = () => {
    if (pendingOperations.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <p>No offline observations pending sync</p>
        </div>
      );
    }

    return (
      <ul className="divide-y divide-gray-200">
        {pendingOperations.map(operation => (
          <li key={operation.id} className="py-4 flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-3 ${
                  operation.status === 'pending' ? 'bg-yellow-500' :
                  operation.status === 'syncing' ? 'bg-blue-500 animate-pulse' :
                  operation.status === 'conflict' ? 'bg-red-500' :
                  'bg-green-500'
                }`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {operation.species || 'Unidentified species'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {operation.location?.lat.toFixed(4)}, {operation.location?.lng.toFixed(4)} •{' '}
                    {new Date(operation.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="ml-4 flex items-center space-x-2">
              {operation.media_files && operation.media_files.length > 0 && (
                <span className="text-xs text-gray-500">
                  {operation.media_files.length} media
                </span>
              )}
              
              {operation.status === 'conflict' && (
                <button
                  onClick={() => handleResolveConflict(operation.id)}
                  className="px-3 py-1 bg-red-100 text-red-800 text-xs font-medium rounded hover:bg-red-200 transition-colors"
                >
                  Resolve Conflict
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    );
  };

  // Render sync progress visualization
  const renderSyncProgress = () => {
    const progress = syncProgress || calculateSyncProgress();
    
    if (!progress || progress.total === 0) return null;
    
    const progressPercentage = (progress.completed / progress.total) * 100;
    const isComplete = progress.completed >= progress.total;
    
    return (
      <div className="mt-6 bg-white rounded-lg shadow-sm p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-sm font-medium text-gray-900">Sync Progress</h3>
          <span className="text-xs text-gray-500">
            {isComplete ? 'Completed' : `${progress.completed}/${progress.total}`}
          </span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
        
        <div className="flex justify-between text-xs text-gray-600">
          <span>{progress.currentFile ? `Syncing: ${progress.currentFile}` : 'Preparing sync...'}</span>
          <span>{progress.estimatedTime ? `~${progress.estimatedTime}s remaining` : ''}</span>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Persistent offline status banner */}
      {isOffline && (
        <div 
          role="status" 
          aria-live="polite"
          className="fixed top-0 left-0 right-0 bg-yellow-50 border-b border-yellow-200 p-3 z-50 shadow-sm"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  OFFLINE MODE
                </span>
              </div>
              <p className="ml-3 text-sm text-yellow-700">
                Working offline. Data will sync when connection is restored.
              </p>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-yellow-600 mr-4">
                {pendingOperations.length} observation{pendingOperations.length !== 1 ? 's' : ''} pending
              </span>
              <button
                onClick={() => window.open('/help-center#offline-mode', '_blank')}
                className="text-yellow-600 hover:text-yellow-800 text-sm font-medium"
              >
                Learn more
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gray-50">
        {/* Main content */}
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="border-4 border-dashed border-gray-200 rounded-lg p-6 bg-white">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Offline Mode</h1>
                  <p className="mt-1 text-gray-600">
                    Manage observations collected without internet connection
                  </p>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Last sync</p>
                    <p className="text-base font-medium text-gray-900">{formatDate(lastSync)}</p>
                  </div>
                  
                  <div className={`w-3 h-3 rounded-full ${
                    isOffline ? 'bg-yellow-500' : 'bg-green-500'
                  }`} title={isOffline ? 'Offline' : 'Online'}></div>
                </div>
              </div>

              {/* Sync error notification */}
              {syncError && (
                <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4">
                  <div className="flex">
                    <div className="ml-3">
                      <p className="text-sm text-red-700">
                        {syncError}
                      </p>
                      <button
                        onClick={() => startSync()}
                        className="mt-2 text-sm text-red-600 hover:text-red-800 font-medium"
                      >
                        Try syncing again
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Sync progress visualization */}
              {renderSyncProgress()}

              {/* Offline observations list */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-medium text-gray-900">Pending Observations</h2>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {pendingOperations.length} total
                  </span>
                </div>
                
                {renderPendingOperations()}
              </div>

              {/* Empty state for no pending observations */}
              {pendingOperations.length === 0 && !syncError && (
                <div className="mt-8 text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No offline observations</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Submit observations while offline, and they'll sync automatically when connection is restored.
                  </p>
                  <div className="mt-6">
                    <Link
                      to="/submit"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Submit New Observation
                    </Link>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="mt-8 flex justify-between">
                <button
                  onClick={() => startSync()}
                  disabled={isOffline || pendingOperations.length === 0}
                  className={`px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  Sync Now
                </button>
                
                <button
                  onClick={() => {/* Implement export functionality */}}
                  className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Export Pending Data
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* Conflict resolution modal */}
        {showConflictModal && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Resolve Observation Conflict</h3>
              
              <div className="mb-6">
                <p className="text-gray-600">
                  There are conflicting versions of this observation. Please choose which version to keep:
                </p>
                
                <div className="mt-4 space-y-3">
                  <div className="flex items-start p-3 border border-gray-200 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">Current Version (Local)</p>
                      <p className="text-sm text-gray-500 mt-1">Collected on: {new Date().toLocaleString()}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Confidence: High
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Media: 3 files
                        </span>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => {/* Handle local version selection */}}
                      className="ml-3 mt-1 px-3 py-1 border border-blue-300 text-blue-700 rounded-md text-sm hover:bg-blue-50"
                    >
                      Keep
                    </button>
                  </div>
                  
                  <div className="flex items-start p-3 border border-gray-200 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">Server Version</p>
                      <p className="text-sm text-gray-500 mt-1">Last synced: {formatDate(lastSync)}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Confidence: Medium
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Media: 2 files
                        </span>
                      </div>
                    </div>
                    
                    <button
                      onClick={confirmConflictResolution}
                      className="ml-3 mt-1 px-3 py-1 border border-blue-300 text-blue-700 rounded-md text-sm hover:bg-blue-50"
                    >
                      Keep
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowConflictModal(false)}
                  className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmConflictResolution}
                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                >
                  Resolve & Continue
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_OFFLINE_MODE;