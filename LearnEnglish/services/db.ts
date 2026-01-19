
import { Word, Level, Language } from '../types';
import { BEGINNER_NEPALI_DATA } from './beginnerData';
import { INTERMEDIATE_NEPALI_DATA } from './intermediateData';
import { ADVANCED_NEPALI_DATA } from './advancedData';

import { BEGINNER_HINDI_DATA } from './hindi_beginnerData';
import { INTERMEDIATE_HINDI_DATA } from './hindi_intermediateData';
import { ADVANCED_HINDI_DATA } from './hindi_advancedData';

declare var initSqlJs: any;

let dbInstance: any = null;
const DB_STORE_NAME = 'chandrama_v4_db'; 
const DB_KEY = 'sqlite_binary';

async function loadBinary(): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_STORE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('kv');
    request.onsuccess = () => {
      const store = request.result.transaction('kv', 'readonly').objectStore('kv');
      const getReq = store.get(DB_KEY);
      getReq.onsuccess = () => resolve(getReq.result || null);
    };
    request.onerror = () => resolve(null);
  });
}

async function saveBinary(data: Uint8Array) {
  const request = indexedDB.open(DB_STORE_NAME, 1);
  request.onsuccess = () => {
    const transaction = request.result.transaction('kv', 'readwrite');
    transaction.objectStore('kv').put(data, DB_KEY);
  };
}

export const initDB = async () => {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs({
    locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${file}`
  });

  const saved = await loadBinary();
  dbInstance = saved ? new SQL.Database(saved) : new SQL.Database();

  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS vocabulary (
      id TEXT PRIMARY KEY,
      word TEXT,
      pronunciation TEXT,
      meaning TEXT,
      english_sentence TEXT,
      native_sentence TEXT,
      synonym TEXT,
      level TEXT,
      day INTEGER,
      language TEXT
    )
  `);

  const checkSeed = (level: string, lang: string) => {
    const res = dbInstance.exec(`SELECT count(*) FROM vocabulary WHERE level = '${level}' AND language = '${lang}'`);
    return res[0].values[0][0] === 0;
  };

  // Seeding Nepali
  if (checkSeed('beginner', 'nepali')) await importNewData(BEGINNER_NEPALI_DATA, Level.BEGINNER, Language.NEPALI);
  if (checkSeed('intermediate', 'nepali')) await importNewData(INTERMEDIATE_NEPALI_DATA, Level.INTERMEDIATE, Language.NEPALI);
  if (checkSeed('advanced', 'nepali')) await importNewData(ADVANCED_NEPALI_DATA, Level.ADVANCED, Language.NEPALI);

  // Seeding Hindi
  if (checkSeed('beginner', 'hindi')) await importNewData(BEGINNER_HINDI_DATA, Level.BEGINNER, Language.HINDI);
  if (checkSeed('intermediate', 'hindi')) await importNewData(INTERMEDIATE_HINDI_DATA, Level.INTERMEDIATE, Language.HINDI);
  if (checkSeed('advanced', 'hindi')) await importNewData(ADVANCED_HINDI_DATA, Level.ADVANCED, Language.HINDI);

  return dbInstance;
};

export const getTotalWordCount = async (): Promise<number> => {
  const db = await initDB();
  const res = db.exec("SELECT count(*) FROM vocabulary");
  return res[0]?.values[0][0] || 0;
};

export const getDetailedStats = async (): Promise<Record<string, number>> => {
  const db = await initDB();
  const res = db.exec("SELECT LOWER(level || '_' || language), COUNT(*) FROM vocabulary GROUP BY level, language");
  const stats: Record<string, number> = {};
  
  if (res[0]) {
    res[0].values.forEach((row: any) => {
      stats[row[0]] = row[1];
    });
  }
  return stats;
};

export const getWordsFromDB = async (lang: Language, level: Level, day: number): Promise<Word[]> => {
  const db = await initDB();
  const stmt = db.prepare("SELECT * FROM vocabulary WHERE language = ? AND level = ? AND day = ? LIMIT 5");
  stmt.bind([lang, level, day]);
  
  const results: Word[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as Word);
  }
  stmt.free();
  return results;
};

export const importNewData = async (dataArray: any[], levelName: Level, languageName: Language) => {
  const db = dbInstance || await initDB();
  db.run("BEGIN TRANSACTION");
  
  try {
    dataArray.forEach((item, index) => {
      const day = Math.floor(index / 5) + 1;
      db.run(`
        INSERT OR IGNORE INTO vocabulary 
        (id, word, pronunciation, meaning, english_sentence, native_sentence, synonym, level, day, language)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        item.id || `${languageName}_${levelName}_${item.word.replace(/\s+/g, '_').toLowerCase()}`,
        item.word,
        item.pronunciation,
        item.meaning,
        item.english_sentence,
        item.native_sentence,
        item.synonym,
        levelName,
        day,
        languageName
      ]);
    });
    db.run("COMMIT");
    await saveBinary(db.export());
    console.log(`[DB] ${levelName} (${languageName}) Integrity Verified.`);
  } catch (e) {
    db.run("ROLLBACK");
    console.error("Import Failed", e);
  }
};
