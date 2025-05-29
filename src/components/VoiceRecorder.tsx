'use client'
import { useRecorder } from '@/components/hooks/useRecorder'
import { useState } from 'react'

export default function VoiceRecorder({
    onStateChange
}: {
    onStateChange: (isRecording: boolean, blob?: Blob) => void
}) {
    const { recording, start, stop, error } = useRecorder();
    const [url, setUrl] = useState<string>();

    const handleToggleRecording = async () => {
        try {
            if (recording) {
                const blob = await stop();
                setUrl(URL.createObjectURL(blob));
                onStateChange(false, blob);
            } else {
                setUrl(undefined); // Clear previous recording
                onStateChange(true);
                await start();
            }
        } catch (err) {
            console.error('VoiceRecorder error:', err);
            onStateChange(false);
        }
    };

    return (
        <div className="space-y-4">
            {error && (
                <div className="bg-red-500 text-white rounded-lg px-3 py-2 text-sm text-center">
                    {error}
                </div>
            )}
            
            <div className="flex justify-center">
                <button
                    className={`w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-full flex items-center justify-center transition-all touch-manipulation ${recording
                        ? 'bg-red-500 hover:bg-red-600 active:bg-red-700 animate-pulse'
                        : error
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700'}`}
                    onClick={handleToggleRecording}
                    disabled={!!error}
                >
                    <span className={`${recording 
                        ? 'w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 rounded-sm bg-white' 
                        : 'w-0 h-0 border-l-[12px] md:border-l-[14px] lg:border-l-[16px] border-t-[8px] md:border-t-[10px] lg:border-t-[12px] border-b-[8px] md:border-b-[10px] lg:border-b-[12px] border-l-white border-t-transparent border-b-transparent ml-1'}`}></span>
                </button>
            </div>

            {url && (
                <div className="p-3 rounded-md bg-gray-50 dark:bg-gray-800/50">
                    <audio controls src={url} className="w-full h-10 md:h-12" />
                </div>
            )}
        </div>
    );
}