/* src/app/page.tsx  */
'use client';                              // ← Client で動く
import DiaryHeatmap from './components/DiaryHeatmap';

export default function Home() {
  const today = new Date();
  return (
    <main className="p-4">
      <h1 className="mb-4 text-xl font-bold">My Gratitude Calendar</h1>
      <DiaryHeatmap
        year={today.getFullYear()}
        month={today.getMonth() + 1}
      />
    </main>
  );
}