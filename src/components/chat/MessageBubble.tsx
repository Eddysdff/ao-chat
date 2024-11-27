import { Message } from '@/types/ao';
import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface MessageBubbleProps {
  message: Message;
  isSender: boolean;
  showAvatar?: boolean;
}

export default function MessageBubble({ 
  message, 
  isSender, 
  showAvatar = true 
}: MessageBubbleProps) {
  const [timeString, setTimeString] = useState('');
  const [showTime, setShowTime] = useState(false);

  useEffect(() => {
    const date = new Date(message.timestamp * 1000);
    setTimeString(formatDistanceToNow(date, { addSuffix: true }));
  }, [message.timestamp]);

  return (
    <div 
      className={`flex items-end space-x-2 group ${
        isSender ? 'flex-row-reverse space-x-reverse' : 'flex-row'
      }`}
    >
      {/* Avatar */}
      {showAvatar && (
        <div className="flex-shrink-0">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white
            ${isSender ? 'bg-green-500' : 'bg-gray-400'}`}>
            {isSender ? 'Me' : message.sender.slice(0, 2).toUpperCase()}
          </div>
        </div>
      )}

      {/* Message Content */}
      <div className="flex flex-col max-w-[70%] space-y-1">
        <div
          className={`relative group rounded-2xl px-4 py-2 shadow-sm
            ${isSender 
              ? 'bg-gradient-to-br from-green-500 to-green-600 text-white rounded-br-none' 
              : 'bg-white text-gray-800 rounded-bl-none'
            }
            transform transition-transform duration-200 hover:scale-[1.02]`}
          onClick={() => setShowTime(!showTime)}
        >
          {/* Message Text */}
          <div className="text-sm break-words whitespace-pre-wrap">
            {message.content}
          </div>

          {/* Time Tooltip */}
          <div
            className={`absolute ${isSender ? 'left-0' : 'right-0'} bottom-full mb-2
              text-xs bg-gray-800 text-white px-2 py-1 rounded-md whitespace-nowrap
              transition-opacity duration-200
              ${showTime ? 'opacity-100' : 'opacity-0'}`}
          >
            {timeString}
          </div>

          {/* Status Indicators */}
          <div className={`absolute ${isSender ? '-left-4' : '-right-4'} bottom-0 flex items-center space-x-1`}>
            {isSender && (
              <div className="flex items-center space-x-0.5">
                <svg 
                  className="w-3 h-3 text-green-500" 
                  fill="currentColor" 
                  viewBox="0 0 20 20"
                >
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                  <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
                {message.status === 'delivered' && (
                  <svg 
                    className="w-3 h-3 text-green-500" 
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                  >
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                )}
                {message.status === 'read' && (
                  <svg 
                    className="w-3 h-3 text-green-500" 
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                  >
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                  </svg>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Time (Mobile) */}
        <div
          className={`text-xs ${
            isSender ? 'text-gray-500 self-end' : 'text-gray-500 self-start'
          } opacity-60 group-hover:opacity-100 transition-opacity md:hidden`}
        >
          {timeString}
        </div>
      </div>
    </div>
  );
}
