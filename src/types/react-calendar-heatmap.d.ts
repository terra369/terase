import 'react-calendar-heatmap';
declare module 'react-calendar-heatmap' {
  interface HeatmapValue<T = string> {
    value?: T;
    mood_emoji?: string;
  }
}