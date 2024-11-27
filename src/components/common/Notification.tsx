import { useEffect } from 'react';

interface NotificationProps {
  type: 'success' | 'error' | 'info';
  message: string;
  onClose: () => void;
  duration?: number; // 自动关闭的时间（毫秒）
}

export default function Notification({ 
  type, 
  message, 
  onClose,
  duration = 5000 // 默认5秒后自动关闭
}: NotificationProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M5 13l4 4L19 7" 
            />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M6 18L18 6M6 6l12 12" 
            />
          </svg>
        );
      case 'info':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
        );
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-500 from-green-500 to-green-600';
      case 'error':
        return 'bg-red-500 from-red-500 to-red-600';
      case 'info':
        return 'bg-blue-500 from-blue-500 to-blue-600';
    }
  };

  return (
    <div 
      className={`
        fixed bottom-4 right-4 max-w-sm w-full
        animate-slide-up
        transform transition-all duration-300 ease-in-out
      `}
    >
      <div className={`
        flex items-center p-4 rounded-lg shadow-lg
        bg-gradient-to-br ${getBgColor()}
        text-white
        backdrop-blur-sm bg-opacity-95
        border border-white/10
      `}>
        {/* Icon */}
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        
        {/* Message */}
        <div className="ml-3 mr-4 flex-1 text-sm font-medium">
          {message}
        </div>
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="flex-shrink-0 rounded-full p-1.5
            hover:bg-white/20 
            focus:outline-none focus:ring-2 focus:ring-white
            transition-colors duration-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M6 18L18 6M6 6l12 12" 
            />
          </svg>
        </button>
      </div>

      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 h-1 bg-white/30 rounded-full w-full">
        <div 
          className="h-full bg-white rounded-full animate-shrink"
          style={{ animationDuration: `${duration}ms` }}
        />
      </div>
    </div>
  );
} 