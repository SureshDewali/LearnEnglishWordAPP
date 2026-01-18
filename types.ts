
export enum Language {
  HINDI = 'hindi',
  NEPALI = 'nepali'
}

export enum Level {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced'
}

export interface Word {
  id: string;
  word: string;
  pronunciation: string;
  meaning: string;
  english_sentence: string;
  native_sentence: string;
  synonym: string;
}

export interface QuizAttempt {
  wordId: string;
  correct: boolean;
  userSelection: string;
}

export type FinalQuestionType = 'fill-blank' | 'meaning-match' | 'synonym-logic' | 'sentence-completion' | 'translation-verify';

export interface FinalQuestion {
  type: FinalQuestionType;
  prompt: string;
  options: string[];
  correct: string;
  wordId: string;
}

export interface AppState {
  view: 'landing' | 'level-select' | 'progress-map' | 'learning' | 'completion' | 'quiz-mcq' | 'quiz-score' | 'quiz-final' | 'summary' | 'history-view';
  selectedLanguage: Language | null;
  selectedLevel: Level | null;
  selectedDay: number;
  dailyWords: Word[];
  currentWordIndex: number;
  quizResults: QuizAttempt[];
  finalScore: number;
}

export interface UserStats {
  streak: number;
  lastDate: string;
  unlockedDays: number;
  lastCompletionDate: string;
  completionsToday: number; 
  lastUnlockTimestamp: number; 
  completedHistory: {
    [key: string]: number[];
  };
  adTriggers: {
    video: number;
    popUnder: number;
    lastDate: string;
  };
}