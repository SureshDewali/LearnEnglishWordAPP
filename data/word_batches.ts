
import { BEGINNER_NEPALI_DATA } from '../services/beginnerData';
import { INTERMEDIATE_NEPALI_DATA } from '../services/intermediateData';
import { ADVANCED_NEPALI_DATA } from '../services/advancedData';

import { BEGINNER_HINDI_DATA } from '../services/hindi_beginnerData';
import { INTERMEDIATE_HINDI_DATA } from '../services/hindi_intermediateData';
import { ADVANCED_HINDI_DATA } from '../services/hindi_advancedData';

export const ALL_WORDS: any[] = [
  ...BEGINNER_NEPALI_DATA.map(w => ({ ...w, language: 'nepali', level: 'beginner' })),
  ...INTERMEDIATE_NEPALI_DATA.map(w => ({ ...w, language: 'nepali', level: 'intermediate' })),
  ...ADVANCED_NEPALI_DATA.map(w => ({ ...w, language: 'nepali', level: 'advanced' })),
  ...BEGINNER_HINDI_DATA,
  ...INTERMEDIATE_HINDI_DATA,
  ...ADVANCED_HINDI_DATA
];
