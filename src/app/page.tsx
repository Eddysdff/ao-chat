'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { connectWallet, getActiveAddress } from '@/lib/arconnect';
import { AOProcess } from '@/lib/ao-process';

export default function Home() {
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const MAX_RETRIES = 3;

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const address = await getActiveAddress();
      if (address) {
        const isHealthy = await AOProcess.checkHealth();
        if (!isHealthy) {
          throw new Error('AO Process connection failed');
        }
        router.push('/chat');
      }
    } catch (error) {
      console.error('Connection check failed:', error);
    }
  };

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      await connectWallet();
      
      const isHealthy = await AOProcess.checkHealth();
      if (!isHealthy) {
        throw new Error('Unable to connect to AO Process');
      }

      router.push('/chat');
    } catch (error) {
      console.error('Connection failed:', error);
      setError(getErrorMessage(error));
      
      if (connectionAttempts < MAX_RETRIES) {
        setConnectionAttempts(prev => prev + 1);
        setTimeout(() => {
          handleConnect();
        }, 1000 * Math.pow(2, connectionAttempts));
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const getErrorMessage = (error: any): string => {
    if (error.message?.includes('ArConnect not found')) {
      return 'Please install ArConnect extension first.';
    }
    if (error.message?.includes('AO Process')) {
      return 'Unable to connect to AO Process. Please try again later.';
    }
    if (error.message?.includes('User rejected')) {
      return 'Connection rejected. Please try again.';
    }
    return 'Failed to connect. Please try again.';
  };

  const handleRetry = () => {
    setConnectionAttempts(0);
    setError(null);
    handleConnect();
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-white to-gray-100">
      {/* Logo and Title Section */}
      <div className="text-center mb-12 animate-fade-in">
        <h1 className="text-6xl font-bold text-black mb-4">AO-CHAT</h1>
        <p className="text-gray-600 text-lg">
          Decentralized chat powered by Arweave & AO
        </p>
      </div>

      {/* Connection Section */}
      <div className="w-full max-w-md px-6">
        {/* Connect Button */}
        <button
          onClick={handleConnect}
          disabled={isConnecting}
          className="w-full bg-gradient-to-r from-green-500 to-green-600 
                   hover:from-green-600 hover:to-green-700 
                   text-white font-semibold py-3 px-6 rounded-lg
                   shadow-lg hover:shadow-xl transition-all duration-300
                   disabled:opacity-50 disabled:cursor-not-allowed
                   flex items-center justify-center space-x-2"
        >
          {isConnecting ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Connecting{'.'.repeat((connectionAttempts % 3) + 1)}</span>
            </>
          ) : (
            <>
              <svg 
                className="w-8 h-8 mx-auto text-green-500 mb-3" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                width="24"
                height="24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Connect Wallet</span>
            </>
          )}
        </button>

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center text-red-700">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
            <button
              onClick={handleRetry}
              className="mt-2 text-sm text-green-600 hover:text-green-700 font-medium"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Connection Status */}
        {connectionAttempts > 0 && (
          <div className="mt-4 text-center text-sm text-gray-500">
            Retry attempt: {connectionAttempts} of {MAX_RETRIES}
          </div>
        )}

        {/* ArConnect Installation Prompt */}
        {error?.includes('ArConnect') && (
          <div className="mt-6 text-center">
            <a
              href="https://www.arconnect.io"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-green-600 hover:text-green-700 
                       font-medium transition-colors duration-200"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Install ArConnect
            </a>
          </div>
        )}
      </div>

      {/* Features Section */}
      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 px-6 max-w-5xl">
        <div className="text-center p-5 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
          <svg className="w-128 h-128 mx-auto text-green-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" width="128" height="128" >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <h3 className="text-base font-semibold mb-1">Messages</h3>
          <p className="text-gray-600 text-sm">End-to-end encrypted messaging on Arweave & AO</p>
        </div>
        <div className="text-center p-5 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
          <svg className="w-128 h-128 mx-auto text-green-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" width="128" height="128" >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <h3 className="text-base font-semibold mb-1">Video Calls</h3>
          <p className="text-gray-600 text-sm">P2P video calls with WebRTC</p>
        </div>
        <div className="text-center p-5 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
          <svg className="w-128 h-128 mx-auto text-green-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" width="128" height="128" >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"  />
          </svg>
          <h3 className="text-base font-semibold mb-1">Decentralized</h3>
          <p className="text-gray-600 text-sm">Fully decentralized on Arweave & AO</p>
        </div>
      </div>
    </main>
  );
}
