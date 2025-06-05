import { useState } from 'react';

export interface RecordingButtonProps {
  recording: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'desktop' | 'mobile';
  onToggle: () => Promise<void> | void;
  className?: string;
}

const sizeClasses = {
  sm: 'w-12 h-12',
  md: 'w-16 h-16', 
  lg: 'w-20 h-20'
};

const iconSizes = {
  sm: { play: 'border-l-[8px] border-t-[6px] border-b-[6px]', stop: 'w-4 h-4' },
  md: { play: 'border-l-[12px] border-t-[9px] border-b-[9px]', stop: 'w-6 h-6' },
  lg: { play: 'border-l-[16px] border-t-[12px] border-b-[12px]', stop: 'w-8 h-8' }
};

export function RecordingButton({
  recording,
  disabled = false,
  size = 'lg',
  onToggle,
  className = ''
}: RecordingButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (disabled || isLoading) return;
    
    setIsLoading(true);
    try {
      await onToggle();
    } finally {
      setIsLoading(false);
    }
  };

  const baseClasses = `
    ${sizeClasses[size]}
    rounded-full 
    flex items-center justify-center 
    transition-all duration-200 
    shadow-lg 
    focus:outline-none 
    focus:ring-4 
    focus:ring-blue-300
    ${className}
  `;

  const buttonClasses = recording
    ? 'bg-red-500 hover:bg-red-600 animate-pulse focus:ring-red-300'
    : disabled || isLoading
      ? 'bg-gray-400 cursor-not-allowed'
      : 'bg-blue-500 hover:bg-blue-600 hover:scale-105 active:scale-95';

  const iconClasses = iconSizes[size];

  return (
    <button
      onClick={handleClick}
      disabled={disabled || isLoading}
      className={`${baseClasses} ${buttonClasses}`}
      aria-label={recording ? '録音を停止' : '録音を開始'}
      type="button"
    >
      {isLoading ? (
        <div className={`${iconClasses.stop} border-2 border-white border-t-transparent rounded-full animate-spin`} />
      ) : recording ? (
        <div className={`${iconClasses.stop} bg-white rounded-sm`} />
      ) : (
        <div 
          className={`
            ${iconClasses.play} 
            border-l-white 
            border-t-transparent 
            border-b-transparent 
            ml-1
          `} 
        />
      )}
    </button>
  );
}

export default RecordingButton;