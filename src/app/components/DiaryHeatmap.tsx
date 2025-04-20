'use client';
import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Heatmap from 'react-calendar-heatmap';
import 'react-calendar-heatmap/dist/styles.css';
import useSWR from 'swr';
import { eachDayOfInterval, format } from 'date-fns';

interface DiaryCell {
    date: string;
    count?: number;
    mood_emoji?: string;
}

export default function DiaryHeatmap({ year, month }: { year: number; month: number }) {
    const router = useRouter();
    const ym = `${year}-${String(month).padStart(2, '0')}`;

    const fetcher = (url: string): Promise<DiaryCell[]> =>
        fetch(url).then((r) => r.json() as Promise<DiaryCell[]>);

    const { data } = useSWR<DiaryCell[]>(`/api/diaries?month=${ym}`, fetcher);

    const { days, streakMap, emojiMap } = useMemo(() => {
        const allDays = eachDayOfInterval({
            start: new Date(year, month - 1, 1),
            end: new Date(year, month, 0),
        });

        const eMap: Record<string, DiaryCell> = Object.fromEntries(
            (data ?? []).map((c) => [c.date, c]),
        );

        let streak = 0;
        const sMap: Record<string, number> = {};
        for (const d of allDays) {
            const key = format(d, 'yyyy-MM-dd');
            streak = eMap[key] ? streak + 1 : 0;
            sMap[key] = Math.min(streak, 4);
        }
        return { days: allDays, streakMap: sMap, emojiMap: eMap };
    }, [data, year, month]);

    return (
        <Heatmap
            startDate={days[0]}
            endDate={days[days.length - 1]}
            gutterSize={4}
            values={days.map((d) => ({
                date: format(d, 'yyyy-MM-dd'),
                count: streakMap[format(d, 'yyyy-MM-dd')],
            }))}
            classForValue={(v) => (v && v.count ? `color-level-${v.count}` : 'color-empty')}
            transformDayElement={(element, value, index) => {
                /** element は ReactElement<SVGRectProps> なので cast して座標取得 */
                const el = element as React.ReactElement<React.SVGProps<SVGRectElement>>;
                const baseRect = React.cloneElement(el, { key: `rect-${index}` });

                if (!value) return baseRect;
                const emo = emojiMap[value.date]?.mood_emoji;
                if (!emo) return baseRect;

                const { x, y, width, height } = el.props;
                const cx = Number(x) + Number(width) / 2;
                const cy = Number(y) + Number(height) / 2 + 3;

                return (
                    <g key={value.date}>
                        {baseRect}
                        <text x={cx} y={cy} fontSize="10" textAnchor="middle">
                            {emo}
                        </text>
                    </g>
                );
            }}
            onClick={(v) => v?.date && router.push(`/diary/${v.date}`)}
        />
    );
}