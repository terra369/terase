/**
 * Core module entry point
 * Shared between Web and Mobile platforms
 * 
 * This module exports all core functionality that can be used
 * across different platform implementations (Web, React Native, etc.)
 */

// API modules
export * from './api/openai'
export * from './api/supabase'

// Audio modules  
export * from './audio/recorder'
export * from './audio/player'

// Diary modules
export * from './diary/operations'
export * from './diary/validation'

// Conversation modules
export * from './conversation/flow'

// Utility modules
export * from './utils/deviceDetection'
export * from './utils/errorHandling'

// Type definitions
export * from './types/database'