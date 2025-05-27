'use client';
import React, { useState } from 'react';
import InteractiveCalendar from '@/components/InteractiveCalendar';
import ConversationReplay from '@/components/ConversationReplay';
import useSWR from 'swr';

interface InteractiveCalendarPageProps {
  year: number;
  month: number;
}

interface DiaryData {
  id: number;
  date: string;
  user_id: string;
}

export default function InteractiveCalendarPage({ year, month }: InteractiveCalendarPageProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showReplay, setShowReplay] = useState(false);
  const [replayDiaryId, setReplayDiaryId] = useState<number | null>(null);

  const fetcher = (url: string): Promise<DiaryData[]> =>
    fetch(url).then((r) => r.json());

  // Fetch diary data to get diary IDs for conversation replay
  const ym = `${year}-${String(month).padStart(2, '0')}`;
  const { data: diaries } = useSWR<DiaryData[]>(`/api/diaries/list?month=${ym}`, fetcher);

  const handleDateClick = (date: string) => {
    setSelectedDate(date);
    
    // Find diary for this date to enable replay
    const diary = diaries?.find(d => d.date === date);
    if (diary) {
      setReplayDiaryId(diary.id);
    } else {
      setReplayDiaryId(null);
    }
  };

  const handleShowReplay = () => {
    if (replayDiaryId && selectedDate) {
      setShowReplay(true);
    }
  };

  const handleCloseReplay = () => {
    setShowReplay(false);
  };

  return (
    <div className="space-y-6">
      <InteractiveCalendar
        year={year}
        month={month}
        onDateClick={handleDateClick}
      />

      {/* Date Selection Info */}
      {selectedDate && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-blue-900">
                Selected: {new Date(selectedDate).toLocaleDateString('ja-JP', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </h3>
              {replayDiaryId ? (
                <p className="text-blue-700">Conversation available for replay</p>
              ) : (
                <p className="text-blue-600">No conversation recorded for this date</p>
              )}
            </div>
            
            {replayDiaryId && (
              <button
                onClick={handleShowReplay}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                🎬 Replay Conversation
              </button>
            )}
          </div>
        </div>
      )}

      {/* Conversation Replay Modal */}
      {showReplay && replayDiaryId && selectedDate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <ConversationReplay
              diaryId={replayDiaryId}
              date={selectedDate}
              autoPlay={true}
              onClose={handleCloseReplay}
            />
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-2">📝 How to Use</h3>
        <ul className="space-y-1 text-sm text-gray-600">
          <li>• Click on any date to select it and view/add drawings</li>
          <li>• Use the drawing tools to annotate your calendar with notes or emotions</li>
          <li>• Click the ▶ button on dates with conversations to replay them</li>
          <li>• Switch between Month, Week, and Day views using the toggle buttons</li>
          <li>• Your drawings are automatically saved and will persist between sessions</li>
        </ul>
      </div>
    </div>
  );
}