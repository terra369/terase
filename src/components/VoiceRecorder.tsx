'use client'
import { useRecorder } from '@/components/hooks/useRecorder'
import { useState } from 'react'

export default function VoiceRecorder({
    onStateChange
}: {
    onStateChange: (isRecording: boolean, blob?: Blob) => void
}) {
    const { recording, start, stop } = useRecorder();
    const [url, setUrl] = useState<string>();

    const handleToggleRecording = async () => {
        if (recording) {
            const blob = await stop();
            setUrl(URL.createObjectURL(blob));
            onStateChange(false, blob);
        } else {
            setUrl(undefined); // Clear previous recording
            onStateChange(true);
            start();
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-center">
                <button
                    className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${recording
                        ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                        : 'bg-blue-500 hover:bg-blue-600'}`}
                    onClick={handleToggleRecording}
                >
                    <span className={`${recording ? 'w-6 h-6 rounded-sm' : 'w-0 h-0 border-l-[12px] border-t-[8px] border-b-[8px] border-l-white border-t-transparent border-b-transparent ml-1'}`}></span>
                </button>
            </div>

            {url && (
                <div className="p-3 rounded-md bg-gray-50 dark:bg-gray-800/50">
                    <audio controls src={url} className="w-full" />
                </div>
            )}
        </div>
    );
}