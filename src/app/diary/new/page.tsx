'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import VoiceRecorder from '@/components/VoiceRecorder'

export default function NewDiary() {
    const router = useRouter()
    const [status, setStatus] = useState<string>()

    async function onFinish(blob: Blob) {
        setStatus('Uploading…')
        const fd = new FormData()
        fd.append('audio', blob)
        const { audioUrl, transcript } = await fetch('/api/transcribe', {
            method: 'POST', body: fd
        }).then(r => r.json())
        setStatus('Saving…')
        await fetch('/api/actions/saveDiary', {
            method: 'POST',
            body: JSON.stringify({ date: new Date().toISOString().slice(0, 10), transcript, audioUrl })
        })
        router.push('/')
    }

    return (
        <main className="p-4 space-y-4">
            <h1 className="text-xl font-bold">Speak your gratitude</h1>
            <VoiceRecorder onFinish={onFinish} />
            {status && <p className="text-sm text-muted-foreground">{status}</p>}
        </main>
    )
}