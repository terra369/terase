'use client'
import { useRecorder } from '@/components/hooks/useRecorder'
import { useState } from 'react'

export default function VoiceRecorder({
    onFinish,
}: { onFinish: (blob: Blob) => void }) {
    const { recording, start, stop } = useRecorder()
    const [url, setUrl] = useState<string>()

    return (
        <div className="space-y-3">
            <button
                className="px-4 py-2 rounded bg-blue-500 text-white"
                onClick={recording ? async () => {
                    const blob = await stop()
                    setUrl(URL.createObjectURL(blob))
                    onFinish(blob)
                } : start}
            >
                {recording ? 'Stop' : 'Record'}
            </button>

            {url && <audio controls src={url} className="w-full" />}
        </div>
    )
}