# CLAUDE.md - Terase Project Guide

## Project Overview

**Terase** is a gratitude journal SNS application that combines AI-powered conversation with voice-first journaling. The name comes from the Japanese concept of bringing light ("照らせ") to every day through gratitude and reflection.

### Core Features
- **AI Fairy Companion**: Personal GPT-powered avatar that asks reflective prompts and provides warm feedback
- **Voice-first Journaling**: Record and transcribe daily gratitude entries using Whisper and ElevenLabs
- **Calendar Interface**: Visual overview of streaks and past entries for habit reinforcement
- **Friend Peek**: View friends' entries (24h window) only after posting your own, eliminating social pressure
- **Privacy-by-default**: Row-Level-Security on Supabase ensures only you and accepted friends can read your data

## Tech Stack & Architecture

### Frontend
- **Next.js 15** with App Router (`/app` directory structure)
- **React 19** with TypeScript
- **Tailwind CSS 4** for styling
- **Three.js + React Three Fiber** for 3D animations (BallBot fairy companion)
- **Zustand** for client-side state management
- **SWR** for data fetching and caching

### Backend & Services
- **Supabase** as primary backend (Postgres + Edge Functions + RLS policies)
- **Supabase Auth** with OAuth (Google / LINE)
- **Supabase Storage** for audio file storage
- **OpenAI GPT-4o-mini** for AI chat responses
- **Whisper API** for speech-to-text transcription
- **ElevenLabs** for text-to-speech generation

### Development Tools
- **TypeScript** with strict configuration
- **ESLint** with Flat Config (latest ESLint 9+ setup)
- **Prettier** for code formatting
- **Conventional Commits** for commit message standards

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── actions/           # Server Actions
│   ├── api/               # API Routes
│   │   ├── ai-chat/      # OpenAI chat integration
│   │   ├── diaries/      # Diary CRUD operations
│   │   ├── transcribe/   # Whisper transcription
│   │   └── tts/          # ElevenLabs TTS
│   ├── auth/             # Authentication pages
│   ├── calendar/         # Calendar view
│   ├── diary/            # Diary pages
│   └── components/       # Page-specific components
├── components/            # Shared components
│   ├── BallBot.tsx       # 3D fairy companion
│   ├── ConversationInterface.tsx  # Main chat UI
│   ├── hooks/            # Custom React hooks
│   └── ui/               # Reusable UI components
├── lib/                  # Utility libraries
│   ├── supabase/         # Supabase clients
│   ├── openaiAudio.ts    # OpenAI audio utilities
│   └── utils.ts          # General utilities
├── stores/               # Zustand stores
└── types/                # TypeScript type definitions

supabase/
├── config.toml           # Supabase configuration
├── functions/            # Edge Functions
└── migrations/           # Database migrations
```

## Development Setup

### Prerequisites
- Node.js 20+
- npm or pnpm
- Supabase CLI (optional, for local development)

### Environment Variables
Create `.env.local` with:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
OPENAI_API_KEY=sk-your-openai-key
ELEVENLABS_API_KEY=your-elevenlabs-key
```

### Installation & Development
```bash
npm ci                 # Install dependencies
npm run dev           # Start development server (with Turbopack)
npm run build         # Production build
npm run lint          # Run ESLint
```

### Database
- Migrations are in `supabase/migrations/`
- Run `supabase db push` to apply changes
- Uses Row-Level Security (RLS) for data privacy

## Code Conventions & Standards

### TypeScript
- Strict mode enabled
- Path aliases: `@/` maps to `src/`
- Custom types in `src/types/`
- No any types allowed

### React/Next.js
- App Router with Server Components by default
- Client Components marked with `'use client'`
- Server Actions for form handling
- SWR for client-side data fetching

### Styling
- Tailwind CSS with utility-first approach
- Dark mode support with `dark:` prefixes
- Component variants using `class-variance-authority`
- Custom animations with `tw-animate-css`

### State Management
- Zustand for global client state
- Local component state with `useState` for UI state
- Server state managed by SWR

### API Design
- RESTful API routes in `/api/`
- Authentication required for all protected routes
- Error handling with proper HTTP status codes
- TypeScript interfaces for request/response types

## Key Components & Hooks

### Core Components
- `ConversationInterface`: Main chat interface with 3D bot
- `BallBot`: Three.js-based 3D fairy companion
- `VoiceRecorder`: Audio recording functionality
- `ConversationTranscript`: Chat history display

### Custom Hooks
- `useRecorder`: Audio recording state and controls
- `useConversation`: Conversation flow management
- `useAudioReactive`: Audio visualization effects

### Stores
- `useConversationStore`: Chat state and transcript
- `useAudioStore`: Audio playback and recording state

## Database Schema

### Core Tables
```sql
profiles (
  id uuid PRIMARY KEY,           -- Auth user ID
  display_name text,             -- User display name
  fairy_name text NOT NULL,      -- AI companion name
  fairy_img_url text NOT NULL,   -- AI companion avatar
  created_at timestamptz
)

diaries (
  id serial PRIMARY KEY,
  user_id uuid REFERENCES profiles(id),
  date date NOT NULL,            -- One entry per day
  user_text text NOT NULL,       -- User's journal entry
  fairy_text text NOT NULL,      -- AI companion response
  user_audio_url text,           -- Voice recording URL
  fairy_audio_url text,          -- AI voice response URL
  visibility text DEFAULT 'friends',  -- 'friends' | 'private'
  UNIQUE(user_id, date)
)

friends (
  user_id uuid,
  friend_user_id uuid,
  status text DEFAULT 'accepted',  -- 'pending' | 'accepted'
  PRIMARY KEY (user_id, friend_user_id)
)
```

### RLS Policies
- Users can only access their own data and accepted friends' data
- Friends can view diaries only after posting their own entry for that day
- Audio files in Supabase Storage have corresponding RLS policies

## API Endpoints

### Chat & AI
- `POST /api/ai-chat` - Generate AI responses using OpenAI
- `POST /api/transcribe` - Transcribe audio using Whisper
- `POST /api/tts` - Generate speech using ElevenLabs

### Diaries
- `GET /api/diaries` - List user's diary entries
- `GET /api/diaries/[date]` - Get specific diary entry
- `POST /api/actions/saveDiary` - Save new diary entry
- `GET /api/diaries/messages` - Get diary messages for calendar

## Testing Guidelines

### Testing Strategy
- Unit tests for utility functions
- Component tests for React components
- Integration tests for API endpoints
- E2E tests for critical user flows

### Test Commands
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

### Testing Conventions
- Test files: `*.test.ts` or `*.spec.ts`
- Mock external services (OpenAI, ElevenLabs)
- Use Supabase local development for database tests

## Deployment & CI/CD

### Deployment
- **Frontend**: Vercel (auto-deploy from main branch)
- **Backend**: Supabase (migrations auto-applied)
- **Preview**: Automatic Vercel previews on PRs

### CI/CD Pipeline
1. ESLint and Prettier checks
2. TypeScript compilation
3. Build verification
4. Automated tests
5. Preview deployment

### Pre-commit Hooks
- ESLint with auto-fix
- Prettier formatting
- TypeScript checking

## Development Workflow

### Branch Strategy
- `main` - Production branch
- `feat/feature-name` - Feature branches
- `fix/bug-description` - Bug fix branches

### Commit Messages
Follow Conventional Commits:
```
feat: add voice recording functionality
fix: resolve audio playback issue
docs: update API documentation
refactor: optimize conversation state management
```

### Pull Request Process
1. Create feature branch from `main`
2. Implement changes with tests
3. Run `npm run lint` and fix issues
4. Create PR with descriptive title and body
5. Automated checks must pass
6. Code review and approval required
7. Squash and merge to `main`

## Common Development Tasks

### Adding New Components
1. Create component in appropriate directory
2. Follow TypeScript and React conventions
3. Add proper prop types and documentation
4. Include in component index if shared

### Adding API Endpoints
1. Create route in `/api/` directory
2. Add proper authentication checks
3. Implement error handling
4. Add TypeScript types for request/response
5. Test with various scenarios

### Database Changes
1. Create new migration file
2. Update TypeScript types
3. Adjust RLS policies if needed
4. Test migration locally
5. Deploy via `supabase db push`

### Working with AI Features
- OpenAI responses should be contextual and warm
- Audio transcription handles Japanese and English
- TTS voices should be consistent with fairy personality
- Always handle API rate limits gracefully

## Performance Considerations

### Frontend Optimization
- Use Next.js Image component for optimized images
- Implement proper loading states
- Minimize bundle size with dynamic imports
- Use SWR caching effectively

### Audio Handling
- Compress audio files before upload
- Use streaming for real-time transcription
- Implement audio caching for repeated playback
- Handle offline scenarios gracefully

### Database Optimization
- Use proper indexing for date-based queries
- Implement pagination for large datasets
- Optimize RLS policies for performance
- Use Supabase Edge Functions for complex operations

## Security Guidelines

### Authentication
- All API routes require authentication
- Use Supabase Auth for session management
- Implement proper CSRF protection
- Validate user permissions on every request

### Data Privacy
- RLS policies enforce data access rules
- Audio files are stored securely in Supabase Storage
- No sensitive data in client-side code
- Regular security audits of dependencies

### API Security
- Rate limiting on AI API calls
- Input validation and sanitization
- Proper error messages (no data leakage)
- Secure environment variable handling

## Troubleshooting

### Common Issues
1. **Audio recording fails**: Check browser permissions and HTTPS
2. **Supabase connection errors**: Verify environment variables
3. **Build failures**: Check TypeScript errors and dependencies
4. **RLS policy issues**: Verify user authentication and policies

### Debug Tools
- Next.js debugging with console and network tab
- Supabase Dashboard for database inspection
- Browser DevTools for client-side issues
- Server logs for API debugging

## Contributing Guidelines

### Code Quality
- Follow existing code patterns and conventions
- Write self-documenting code with clear variable names
- Add comments for complex business logic
- Maintain consistent formatting with Prettier

### Documentation
- Update this CLAUDE.md file when adding major features
- Document API changes in relevant sections
- Include JSDoc comments for complex functions
- Update README.md for user-facing changes

### Testing Requirements
- Add tests for new features
- Maintain existing test coverage
- Test edge cases and error scenarios
- Include integration tests for API changes

---

This document serves as the primary reference for understanding and working with the Terase codebase. Keep it updated as the project evolves.