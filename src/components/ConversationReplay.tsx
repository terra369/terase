'use client';
import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { format } from 'date-fns';

interface DiaryMessage {
  id: number;
  role: 'user' | 'ai';
  text: string;
  audio_url?: string;
  created_at: string;
}

interface ConversationReplayProps {
  diaryId: number;
  date: string;
  autoPlay?: boolean;
  onClose?: () => void;
}

export default function ConversationReplay({ 
  diaryId, 
  date, 
  autoPlay = false,
  onClose 
}: ConversationReplayProps) {
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const fetcher = (url: string): Promise<DiaryMessage[]> =>
    fetch(url).then((r) => r.json());

  const { data: messages, error } = useSWR<DiaryMessage[]>(
    `/api/diaries/${diaryId}/messages`,
    fetcher
  );

  // Auto-scroll to bottom when new messages are revealed
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessageIndex]);

  // Handle auto-play progression
  useEffect(() => {
    if (!isPlaying || !messages || currentMessageIndex >= messages.length) {
      return;
    }

    const currentMessage = messages[currentMessageIndex];
    const delay = 2000; // Default 2 seconds between messages

    // If message has audio, play it and wait for completion
    if (currentMessage.audio_url) {
      const audio = new Audio(currentMessage.audio_url);
      setCurrentAudio(audio);
      
      audio.playbackRate = playbackSpeed;
      audio.play().catch(console.error);
      
      audio.onended = () => {
        setCurrentAudio(null);
        timeoutRef.current = setTimeout(() => {
          setCurrentMessageIndex(prev => prev + 1);
        }, 500 / playbackSpeed);
      };
      
      audio.onerror = () => {
        setCurrentAudio(null);
        timeoutRef.current = setTimeout(() => {
          setCurrentMessageIndex(prev => prev + 1);
        }, delay / playbackSpeed);
      };
    } else {
      // Text message - calculate reading time
      const wordsPerMinute = 200;
      const words = currentMessage.text.split(' ').length;
      const readingTime = Math.max(1000, (words / wordsPerMinute) * 60 * 1000);
      
      timeoutRef.current = setTimeout(() => {
        setCurrentMessageIndex(prev => prev + 1);
      }, readingTime / playbackSpeed);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (currentAudio) {
        currentAudio.pause();
        setCurrentAudio(null);
      }
    };
  }, [isPlaying, messages, currentMessageIndex, playbackSpeed]);

  const handlePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false);
      if (currentAudio) {
        currentAudio.pause();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    } else {
      setIsPlaying(true);
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentMessageIndex(0);
    if (currentAudio) {
      currentAudio.pause();
      setCurrentAudio(null);
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  const handleSeek = (index: number) => {
    setCurrentMessageIndex(index);
    if (currentAudio) {
      currentAudio.pause();
      setCurrentAudio(null);
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (currentAudio) {
      currentAudio.playbackRate = speed;
    }
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">Error loading conversation: {error.message}</p>
      </div>
    );
  }

  if (!messages) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="animate-pulse flex space-x-4">
          <div className="rounded-full bg-gray-300 h-10 w-10"></div>
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 bg-gray-300 rounded w-3/4"></div>
            <div className="h-4 bg-gray-300 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  const visibleMessages = messages.slice(0, currentMessageIndex + 1);
  const progressPercentage = ((currentMessageIndex + 1) / messages.length) * 100;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            Conversation Replay - {format(new Date(date), 'MMM d, yyyy')}
          </h3>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-xl font-bold"
            >
              ×
            </button>
          )}
        </div>
        
        {/* Progress Bar */}
        <div className="mt-2">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {currentMessageIndex + 1} / {messages.length} messages
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={handlePlayPause}
              className={`
                px-4 py-2 rounded-lg font-medium transition-colors
                ${isPlaying 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-green-500 hover:bg-green-600 text-white'
                }
              `}
            >
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
            
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              ⏮ Reset
            </button>
          </div>

          <div className="flex items-center space-x-3">
            <label className="text-sm font-medium">Speed:</label>
            {[0.5, 1, 1.5, 2].map((speed) => (
              <button
                key={speed}
                onClick={() => handleSpeedChange(speed)}
                className={`
                  px-2 py-1 text-sm rounded transition-colors
                  ${playbackSpeed === speed 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }
                `}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="p-4 max-h-96 overflow-y-auto">
        <div className="space-y-4">
          {visibleMessages.map((message, index) => (
            <div
              key={message.id}
              className={`
                flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}
                ${index === currentMessageIndex ? 'opacity-100' : 'opacity-70'}
                transition-opacity duration-300
              `}
              onClick={() => handleSeek(index)}
            >
              <div
                className={`
                  max-w-xs lg:max-w-md px-4 py-2 rounded-lg cursor-pointer
                  ${message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-800'
                  }
                  ${index === currentMessageIndex ? 'ring-2 ring-blue-300' : ''}
                `}
              >
                <p className="text-sm">{message.text}</p>
                {message.audio_url && (
                  <div className="mt-2 flex items-center space-x-2">
                    <span className="text-xs opacity-70">🎵 Audio</span>
                    {index === currentMessageIndex && currentAudio && (
                      <span className="text-xs opacity-70">Playing...</span>
                    )}
                  </div>
                )}
                <p className="text-xs opacity-70 mt-1">
                  {format(new Date(message.created_at), 'HH:mm')}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Message Timeline */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-1 overflow-x-auto">
          {messages.map((message, index) => (
            <button
              key={message.id}
              onClick={() => handleSeek(index)}
              className={`
                flex-shrink-0 w-8 h-8 rounded-full text-xs font-medium transition-all
                ${index <= currentMessageIndex
                  ? message.role === 'user' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-green-500 text-white'
                  : 'bg-gray-300 text-gray-600'
                }
                ${index === currentMessageIndex ? 'ring-2 ring-blue-300 scale-110' : ''}
              `}
              title={`${message.role} - ${format(new Date(message.created_at), 'HH:mm')}`}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}