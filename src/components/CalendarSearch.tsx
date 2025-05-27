'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { format } from 'date-fns';

interface SearchResult {
  diary_id: number;
  date: string;
  text: string;
  role: 'user' | 'ai';
  highlight?: string;
}

interface CalendarSearchProps {
  onResultClick?: (date: string) => void;
}

export default function CalendarSearch({ onResultClick }: CalendarSearchProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [emotionFilter, setEmotionFilter] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [isSearching, setIsSearching] = useState(false);

  const shouldSearch = searchQuery.length >= 2 || emotionFilter || (dateRange.start && dateRange.end);

  const fetcher = async (url: string): Promise<SearchResult[]> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Search failed');
    return response.json();
  };

  const searchUrl = shouldSearch 
    ? `/api/calendar/search?${new URLSearchParams({
        q: searchQuery,
        emotion: emotionFilter,
        start_date: dateRange.start,
        end_date: dateRange.end
      }).toString()}`
    : null;

  const { data: results, error, isLoading } = useSWR(
    searchUrl,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 1000
    }
  );

  useEffect(() => {
    setIsSearching(isLoading);
  }, [isLoading]);

  const handleResultClick = (result: SearchResult) => {
    if (onResultClick) {
      onResultClick(result.date);
    } else {
      router.push(`/diary/${result.date}`);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setEmotionFilter('');
    setDateRange({ start: '', end: '' });
  };

  const highlightText = (text: string, query: string) => {
    if (!query || query.length < 2) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 px-1 rounded">
          {part}
        </mark>
      ) : part
    );
  };

  const commonEmotions = [
    '😊', '😢', '😤', '😍', '😅', '😴', '🤔', '😂', 
    '🥰', '😞', '😡', '😰', '🤗', '😌', '🤪', '🥺'
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Search Header */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold mb-3">🔍 Search Your Diary</h3>
        
        {/* Search Input */}
        <div className="space-y-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {isSearching && (
              <div className="absolute right-3 top-2.5">
                <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              </div>
            )}
          </div>

          {/* Emotion Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Emotion
            </label>
            <div className="flex flex-wrap gap-2">
              {commonEmotions.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setEmotionFilter(emotionFilter === emoji ? '' : emoji)}
                  className={`
                    text-lg p-2 rounded-lg border transition-colors
                    ${emotionFilter === emoji 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Clear Button */}
          {(searchQuery || emotionFilter || dateRange.start || dateRange.end) && (
            <button
              onClick={handleClearSearch}
              className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              Clear All Filters
            </button>
          )}
        </div>
      </div>

      {/* Search Results */}
      <div className="max-h-96 overflow-y-auto">
        {error && (
          <div className="p-4 text-red-600 bg-red-50">
            Error searching: {error.message}
          </div>
        )}

        {results && results.length === 0 && (
          <div className="p-4 text-gray-500 text-center">
            No results found for your search criteria
          </div>
        )}

        {results && results.length > 0 && (
          <div className="divide-y divide-gray-100">
            {results.map((result, index) => (
              <div
                key={`${result.diary_id}-${index}`}
                onClick={() => handleResultClick(result)}
                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className={`
                      px-2 py-1 text-xs font-medium rounded-full
                      ${result.role === 'user' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-green-100 text-green-800'
                      }
                    `}>
                      {result.role === 'user' ? 'You' : 'AI'}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {format(new Date(result.date), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <button className="text-blue-500 hover:text-blue-700 text-sm font-medium">
                    View →
                  </button>
                </div>
                <p className="text-sm text-gray-700 line-clamp-3">
                  {highlightText(result.text, searchQuery)}
                </p>
              </div>
            ))}
          </div>
        )}

        {!shouldSearch && (
          <div className="p-8 text-center text-gray-500">
            <div className="text-4xl mb-2">🔍</div>
            <p>Enter at least 2 characters to search, select an emotion, or choose a date range</p>
          </div>
        )}
      </div>
    </div>
  );
}