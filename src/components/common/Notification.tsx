interface NotificationProps {
  type: 'success' | 'error' | 'info';
  message: string;
  onClose: () => void;
}

export default function Notification({ type, message, onClose }: NotificationProps) {
  return (
    <div className={`
      fixed bottom-4 right-4 p-4 rounded-lg shadow-lg
      transform transition-all duration-300 ease-in-out
      ${type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'}
      text-white
    `}>
      <div className="flex items-center">
        {/* 图标 */}
        <span className="mr-2">
          {type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}
        </span>
        
        {/* 消息 */}
        <span>{message}</span>
        
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="ml-4 hover:opacity-75 transition-opacity"
        >
          ✕
        </button>
      </div>
    </div>
  );
} 