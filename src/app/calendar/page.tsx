'use client';

import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/solid';

export default function Calendar() {
  return (
    <div className="min-h-screen bg-black text-white p-6">
      <header className="flex items-center mb-6">
        <Link 
          href="/"
          className="text-gray-300 hover:text-white transition-colors mr-4"
          aria-label="Go back home"
        >
          <ArrowLeftIcon className="h-6 w-6" />
        </Link>
        <h1 className="text-2xl font-semibold">Calendar</h1>
      </header>
      
      <main>
        <p className="text-gray-300">Calendar view coming soon</p>
        {/* カレンダー実装はここに追加予定 */}
      </main>
    </div>
  );
}
