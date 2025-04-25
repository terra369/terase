import { useEffect, useRef, useState } from 'react'

export function useRecorder() {
  const [recording, setRec] = useState(false)
  const chunks = useRef<BlobPart[]>([])
  const mediaRec = useRef<MediaRecorder | null>(null)

  useEffect(() => {
    return () => {
      if (mediaRec.current?.state === 'recording') {
        mediaRec.current.stop()
      }
    }
  }, [])

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRec.current = new MediaRecorder(stream)
    mediaRec.current.ondataavailable = e => chunks.current.push(e.data)
    mediaRec.current.start()
    setRec(true)
  }

  function stop(): Promise<Blob> {
    return new Promise(res => {
      mediaRec.current?.addEventListener('stop', () => {
        setRec(false)
        res(new Blob(chunks.current, { type: 'audio/webm' }))
        chunks.current = []
      })
      mediaRec.current?.stop()
    })
  }
  return { recording, start, stop }
}