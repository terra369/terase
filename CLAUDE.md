# CLAUDE.md - terase Project Documentation

## 🎯 Project Overview

**terase** is a gratitude journal SNS that pairs users with a personal AI fairy companion. It captures voice entries once a day and provides reflection through a calendar interface, emphasizing privacy-by-default and voice-first interactions.

### ✨ Core Features

- **🧚 AI Fairy Companion**: GPT-powered personal avatar with unique personality that asks reflective prompts and provides warm feedback
- **🎙️ Voice-first Journaling**: Record and transcribe daily gratitude using OpenAI Whisper + ElevenLabs TTS/STT
- **📅 Calendar Interface**: Visual overview of streaks and past entries for habit reinforcement
- **👥 Friend Peek Feature**: View friends' entries (24h window) only after posting your own, eliminating social pressure
- **🔒 Privacy-by-default**: Row-Level-Security on Supabase; only you and accepted friends can read your data

## 🏗️ Technical Stack

### Frontend
- **Next.js 15** with App Router (`/app` directory structure)
- **React 19** with Server Components and Actions
- **TypeScript** for type safety
- **Tailwind CSS 4** for styling
- **React Three Fiber** for 3D bot interface
- **SWR** for client-side data fetching
- **Zustand** for state management

### Backend & Services
- **Supabase**:
  - PostgreSQL database with Row Level Security (RLS)
  - Auth with Google/LINE OAuth
  - Storage for audio files
  - Edge Functions for AI processing
- **OpenAI API**: Whisper for transcription, GPT for AI responses
- **ElevenLabs API**: Text-to-speech for AI fairy voice

### Development & CI/CD
- **Vitest** for testing
- **ESLint + Prettier** for code quality
- **GitHub Actions** for CI
- **Vercel** for deployment with preview branches

## 📁 Project Structure

```
terase/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── actions/           # Server Actions
│   │   ├── api/               # API Routes
│   │   ├── auth/              # Authentication pages
│   │   ├── calendar/          # Calendar interface
│   │   ├── diary/             # Diary management
│   │   └── components/        # Page-specific components
│   ├── components/            # Shared React components
│   │   ├── BallBot.tsx        # 3D AI fairy bot
│   │   ├── ConversationInterface.tsx  # Main voice UI
│   │   ├── hooks/             # Custom React hooks
│   │   └── ui/                # UI components
│   ├── lib/                   # Utility libraries
│   │   ├── supabase/          # Supabase client config
│   │   ├── openaiAudio.ts     # OpenAI integration
│   │   └── whisper.ts         # Speech processing
│   ├── stores/                # Zustand state stores
│   ├── test/                  # Test files
│   └── types/                 # TypeScript definitions
├── supabase/
│   ├── migrations/            # Database schema versions
│   └── functions/             # Edge Functions
└── public/                    # Static assets
```

## 💾 Database Schema

### Core Tables

**profiles** - User profile information
```sql
- id: uuid (auth.users FK)
- display_name: text
- fairy_name: text (AI companion name)
- fairy_img_url: text
- created_at: timestamptz
```

**diaries** - Daily journal entries
```sql
- id: serial primary key
- user_id: uuid (profiles FK)
- date: date (unique per user)
- user_text: text (transcribed content)
- fairy_text: text (AI response)
- user_audio_url: text
- fairy_audio_url: text
- visibility: text ('friends'|'private')
- created_at: timestamptz
```

**friends** - Friend relationships
```sql
- user_id: uuid
- friend_user_id: uuid
- status: text ('pending'|'accepted')
- created_at: timestamptz
```

**diary_messages** - Conversation history
```sql
- id: serial primary key
- diary_id: integer (diaries FK)
- role: text ('user'|'ai')
- text: text
- audio_url: text
- created_at: timestamptz
```

### RLS Policies
- Users can only access their own data or data from accepted friends
- Friends can only view entries 24h after posting their own
- All tables have appropriate RLS policies for privacy

## 🔗 API Endpoints

### REST API Routes

**Diaries Management**
- `GET /api/diaries` - List user's diaries
- `GET /api/diaries/[date]` - Get specific diary
- `POST /api/diaries/messages` - Save conversation message

**AI Integration**
- `POST /api/ai-chat` - Chat with AI fairy
- `POST /api/transcribe` - Transcribe audio to text
- `POST /api/tts` - Convert text to speech

**Authentication**
- `GET /api/auth/callback` - OAuth callback handling

### Edge Functions
- `/supabase/functions/ai_reply` - Process AI responses with context

## 🛠️ Development Workflow

### Getting Started

1. **Clone and Setup**
```bash
git clone https://github.com/terra369/terase.git
cd terase
npm ci
```

2. **Environment Configuration**
```bash
cp .env.example .env.local
# Fill in required API keys
```

3. **Required Environment Variables**
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ey...
OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=e11-...
```

4. **Database Setup**
```bash
# Start local Supabase
supabase start

# Apply migrations
supabase db push
```

5. **Development Server**
```bash
npm run dev  # Starts on http://localhost:3000
```

### Code Conventions

#### File Naming
- **Components**: PascalCase (`ConversationInterface.tsx`)
- **Hooks**: camelCase with `use` prefix (`useRecorder.ts`)
- **Utilities**: camelCase (`uploadAudio.ts`)
- **API routes**: kebab-case (`ai-chat/route.ts`)

#### Code Style
- **TypeScript**: Strict mode enabled
- **React**: Function components with hooks
- **State Management**: Zustand for global state, useState for local
- **Async**: Use async/await, handle errors properly
- **Comments**: JSDoc for public APIs, inline for complex logic

#### Component Patterns
```tsx
// Preferred component structure
export default function MyComponent({ prop1, prop2 }: Props) {
  // Hooks at the top
  const { state } = useCustomHook()
  
  // Event handlers
  const handleAction = async () => {
    // Implementation
  }
  
  // Early returns for loading/error states
  if (loading) return <Loading />
  
  // Main render
  return (
    <div className="tailwind-classes">
      {/* JSX content */}
    </div>
  )
}
```

### Testing Strategy

#### Test Structure
- **Unit Tests**: Individual components and utilities
- **Integration Tests**: API endpoints and database operations
- **E2E Tests**: Critical user flows (planned)

#### Test Files Location
- Tests are co-located in `src/test/` directory
- Test files use `.test.ts` or `.test.tsx` extension
- Mock data and utilities in test setup files

#### Running Tests
```bash
npm run test        # Watch mode
npm run test:run    # Single run
```

#### Test Patterns
```typescript
describe('Feature Name', () => {
  beforeEach(() => {
    // Reset mocks and state
  })
  
  it('should handle expected behavior', async () => {
    // Arrange
    const input = createMockData()
    
    // Act
    const result = await functionUnderTest(input)
    
    // Assert
    expect(result).toMatchExpected()
  })
})
```

### Performance Considerations

#### React Optimization
- Use `useMemo` and `useCallback` for expensive computations
- Implement proper dependency arrays
- Avoid unnecessary re-renders with React.memo when needed

#### Audio Processing
- Stream audio processing to avoid memory issues
- Implement proper cleanup for audio resources
- Use Web Audio API efficiently

#### Database Queries
- Use Supabase query optimization
- Implement proper pagination
- Cache frequently accessed data with SWR

## 🔐 Security Guidelines

### Authentication
- All routes require authentication except login
- Use Supabase Auth with OAuth providers
- Implement proper session management

### Data Privacy
- Row Level Security (RLS) on all tables
- Audio files stored in private Supabase buckets
- Friend visibility controls strictly enforced

### API Security
- Validate all inputs with Zod schemas
- Rate limiting on AI endpoints
- Secure storage of API keys

## 🚀 Deployment & CI/CD

### Branch Strategy
- `main`: Production-ready code
- `feat/*`: Feature development
- `fix/*`: Bug fixes
- Pull requests required for main branch

### Commit Convention
Follow Conventional Commits:
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation updates
- `test:` - Test additions/updates
- `refactor:` - Code restructuring

### CI Pipeline
1. **Lint & Type Check**: ESLint + TypeScript compilation
2. **Test Suite**: Run Vitest test suite
3. **Build**: Next.js production build
4. **Deploy**: Automatic Vercel deployment on merge

### Production Deployment
- **Platform**: Vercel with GitHub integration
- **Database**: Supabase hosted PostgreSQL
- **CDN**: Vercel Edge Network
- **Monitoring**: Supabase Analytics + Vercel Analytics

## 🔧 Available Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Development server with Turbopack |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |

## 🎨 UI/UX Guidelines

### Design Principles
- **Voice-first**: Primary interaction through speech
- **Minimal**: Clean, distraction-free interface
- **Emotional**: Warm, encouraging AI companion
- **Private**: Clear privacy indicators and controls

### Component Library
- Built on Radix UI primitives
- Tailwind CSS for styling
- Custom design system in `src/components/ui/`
- 3D elements with React Three Fiber

## 🤝 Contributing Guidelines

### Pull Request Process
1. Create feature branch from `main`
2. Implement changes following code conventions
3. Add/update tests for new functionality
4. Ensure all lints and tests pass
5. Create PR with descriptive title and body
6. Request review from maintainers

### Code Review Checklist
- [ ] Code follows established conventions
- [ ] Tests cover new functionality
- [ ] No security vulnerabilities introduced
- [ ] Performance impact considered
- [ ] Documentation updated if needed

## 🐛 Troubleshooting

### Common Issues

**Audio Recording Not Working**
- Check browser microphone permissions
- Verify HTTPS context (required for microphone access)
- Clear browser cache and cookies

**Supabase Connection Errors**
- Verify environment variables are set correctly
- Check Supabase project status
- Ensure RLS policies are properly configured

**Build/Type Errors**
- Run `npm ci` to ensure clean dependencies
- Clear Next.js cache: `rm -rf .next`
- Check TypeScript configuration in `tsconfig.json`

**Test Failures**
- Ensure test database is properly seeded
- Check mock implementations are up to date
- Verify environment variables in test setup

### Development Tips

1. **State Management**: Use Zustand for complex state, React state for simple UI state
2. **Error Handling**: Always handle async errors gracefully with try/catch
3. **Performance**: Monitor React DevTools for unnecessary renders
4. **Accessibility**: Test with keyboard navigation and screen readers
5. **Mobile**: Test responsive design on actual devices

## 📋 TODO / Roadmap

### Immediate Priorities
- [ ] Enhanced AI personality customization
- [ ] Improved voice recognition accuracy
- [ ] Mobile app development (React Native)
- [ ] Advanced analytics dashboard

### Future Features
- [ ] Multi-language support (Japanese primary)
- [ ] Collaborative journaling features
- [ ] Voice note sharing with friends
- [ ] AI-generated journal prompts
- [ ] Mood tracking integration

---

**Last Updated**: 2025-05-25  
**Version**: 1.0.0  
**Maintainer**: terra369 <terra369@users.noreply.github.com>

This documentation follows the TDD (Test-Driven Documentation) approach requested in Issue #23, providing comprehensive coverage of the terase project structure, conventions, and development workflow.