'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { connectWallet, getActiveAddress } from '@/lib/arconnect';

export default function Home() {
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const MAX_RETRIES = 3;

  useEffect(() => {
    const checkExistingConnection = async () => {
      const address = await getActiveAddress();
      if (address) {
        router.push('/chat');
      }
    };
    checkExistingConnection();
  }, [router]);

  const handleConnect = async () => {
    if (isConnecting) return;

    try {
      setIsConnecting(true);
      setError(null);
      
      const address = await connectWallet();
      if (address) {
        router.push('/chat');
      }
    } catch (error) {
      console.error('Connection failed:', error);
      setError(getErrorMessage(error));
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary-50 to-white">
      <div className="w-full max-w-4xl mx-auto px-4 py-8">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-block mb-4">
            <div className="w-10 h-10 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg transform rotate-45" />
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-5 h-5 text-white transform -rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-primary-600 mb-2">AO-CHAT</h1>
          <p className="text-gray-600 text-sm">Secure, Decentralized Instant Messaging</p>
        </div>

        {/* Connect Button */}
        <div className="w-64 mx-auto mb-12">
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full bg-primary-600 text-white text-sm rounded-lg px-4 py-2 flex items-center justify-center space-x-2 hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {isConnecting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Connect Wallet</span>
              </>
            )}
          </button>

          {error && (
            <div className="mt-3 text-xs bg-red-50 text-red-600 p-2 rounded-lg">
              <p>{error}</p>
              <button onClick={handleRetry} className="text-primary-600 hover:text-primary-700 mt-1">
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
          {[
            {
              icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
              title: "Encrypted Messages",
              description: "End-to-end encrypted communication"
            },
            {
              icon: "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4",
              title: "Decentralized",
              description: "Built on Arweave & AO Protocol"
            },
            {
              icon: "M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z",
              title: "Instant Messaging",
              description: "Real-time messaging system"
            }
          ].map((feature, index) => (
            <div key={index} className="bg-white/80 p-3 rounded-lg shadow-sm text-center">
              <div className="w-6 h-6 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <svg className="w-3 h-3 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.icon} />
                </svg>
              </div>
              <h3 className="text-sm font-semibold mb-1">{feature.title}</h3>
              <p className="text-xs text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
