import React, { useState, useEffect, useMemo } from 'react';
import { Language, Level, Word, AppState, QuizAttempt, FinalQuestion, FinalQuestionType } from './types';
import { getStats, updateStreak, completeDay, checkDayLock } from './services/storage';
import { getWordsFromDB, initDB } from './services/db';
import Logo from './components/Logo';

const DIRECT_LINK = "https://otieu.com/4/10486710";

const App: React.FC = () => {
  const [userStats, setUserStats] = useState(getStats());
  const [dbReady, setDbReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [state, setState] = useState<AppState>(() => {
    const savedLang = localStorage.getItem('chandrama_pref_lang') as Language || Language.NEPALI;
    return {
      view: 'landing',
      selectedLanguage: savedLang,
      selectedLevel: null,
      selectedDay: 1,
      dailyWords: [],
      currentWordIndex: 0,
      quizResults: [],
      finalScore: 0
    };
  });

  useEffect(() => {
    const boot = async () => {
      try {
        await initDB();
        setDbReady(true);
      } catch (e: any) {
        setError("System Link Error: " + e.message);
      }
    };
    boot();
    const sync = setInterval(() => setUserStats(getStats()), 2000);
    return () => clearInterval(sync);
  }, []);

  const handleTriggerDirectLink = (nextView: AppState['view']) => {
    try {
      window.open(DIRECT_LINK, "_blank");
    } catch (e) {
      console.warn("Direct link blocked or unavailable", e);
    }
    setState(p => ({ ...p, view: nextView }));
  };

  const getLevelDayPointer = (lang: Language | null, level: Level | null) => {
    if (!lang || !level) return 1;
    const progressKey = `chandrama_${level}_${lang}_pointer`;
    const savedValue = localStorage.getItem(progressKey);
    return savedValue ? parseInt(savedValue, 10) : 1;
  };

  const currentLevelPointer = getLevelDayPointer(state.selectedLanguage, state.selectedLevel);
  const lockStatus = checkDayLock(currentLevelPointer);

  const loadWords = async (lang: Language, level: Level, day: number, view: AppState['view'] = 'learning') => {
    try {
      const wordsForToday = await getWordsFromDB(lang, level, day);
      if (wordsForToday.length === 0) return;
      setState(p => ({ 
        ...p, 
        dailyWords: wordsForToday, 
        currentWordIndex: 0,
        selectedDay: day,
        selectedLanguage: lang,
        selectedLevel: level,
        view: view
      }));
      localStorage.setItem('chandrama_pref_lang', lang);
    } catch (err: any) {
      setError(`Database Sync Error: ${err.message}`);
    }
  };

  const goHome = () => setState(p => ({ ...p, view: 'landing', dailyWords: [], quizResults: [] }));
  const speak = (text: string) => {
    const synth = window.speechSynthesis;
    if (synth.speaking) synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'en-US';
    utter.rate = 0.85;
    synth.speak(utter);
  };

  const renderView = () => {
    if (!dbReady && !error) return (
      <div className="flex-1 flex flex-col items-center justify-center h-full">
        <div className="w-10 h-10 border-t-2 border-emerald-500 border-r-2 rounded-full animate-spin mb-4"></div>
        <p className="text-[10px] font-black uppercase text-emerald-500 tracking-[0.4em] animate-pulse text-readable">Syncing Core</p>
      </div>
    );

    switch (state.view) {
      case 'landing': return <LandingView onSelect={(l) => setState(p => ({ ...p, selectedLanguage: l, view: 'level-select' }))} />;
      case 'level-select': return <LevelSelectView onSelect={(l) => setState(p => ({ ...p, selectedLevel: l, view: 'progress-map' }))} onBack={goHome} />;
      case 'progress-map': return <ProgressMapView 
        lang={state.selectedLanguage!} level={state.selectedLevel!} stats={userStats} lock={lockStatus} nextDay={currentLevelPointer}
        onSelectDay={(d, isHistory) => loadWords(state.selectedLanguage!, state.selectedLevel!, d, isHistory ? 'history-view' : 'learning')}
        onBack={() => setState(p => ({ ...p, view: 'level-select' }))}
      />;
      case 'learning': return <LearningView 
        words={state.dailyWords} index={state.currentWordIndex} day={state.selectedDay}
        onSpeak={speak}
        onNext={() => state.currentWordIndex < state.dailyWords.length - 1 ? setState(p => ({ ...p, currentWordIndex: p.currentWordIndex + 1 })) : handleTriggerDirectLink('completion')}
        onPrev={() => setState(p => ({ ...p, currentWordIndex: Math.max(0, p.currentWordIndex - 1) }))}
        onHome={goHome}
      />;
      case 'completion': return <CompletionView onStart={() => setState(p => ({ ...p, view: 'quiz-mcq' }))} onHome={goHome} />;
      case 'quiz-mcq': return <QuizMCQView lang={state.selectedLanguage!} words={state.dailyWords} onDone={(r) => setState(p => ({ ...p, quizResults: r, finalScore: r.filter(x => x.correct).length, view: 'quiz-score' }))} onHome={goHome} />;
      case 'quiz-score': return <QuizScoreView score={state.finalScore} total={state.dailyWords.length} onContinue={() => handleTriggerDirectLink('quiz-final')} onHome={goHome} />;
      case 'quiz-final': return <QuizFinalView words={state.dailyWords} lang={state.selectedLanguage!} onComplete={(score) => {
        updateStreak();
        completeDay(state.selectedLanguage!, state.selectedLevel!, state.selectedDay);
        setState(p => ({ ...p, finalScore: score, view: 'summary' }));
      }} onHome={goHome} />;
      case 'summary': return <SummaryView 
        day={state.selectedDay} score={state.finalScore} total={state.dailyWords.length} 
        onRevise={() => setState(p => ({ ...p, currentWordIndex: 0, view: 'learning' }))}
        onNextDay={() => loadWords(state.selectedLanguage!, state.selectedLevel!, state.selectedDay + 1)} onHome={goHome} />;
      case 'history-view': return <HistoryView day={state.selectedDay} words={state.dailyWords} onBack={() => setState(p => ({ ...p, view: 'progress-map' }))} onHome={goHome} />;
      default: return null;
    }
  };

  return (
    <div className="h-full w-full flex flex-col view-transition overflow-hidden">
      {renderView()}
    </div>
  );
};

const GlobalHeader = ({ onHome, showHome = true }: { onHome: () => void, showHome?: boolean }) => (
  <div className="fixed top-0 left-0 w-full px-5 pt-8 pb-4 flex justify-between items-start z-[70] pointer-events-none">
    <div className="flex items-center gap-2 pointer-events-auto">
      <Logo size="sm" />
      <span className="text-[11px] font-black tracking-[0.2em] text-white uppercase text-readable">Chandrama</span>
    </div>
    {showHome && (
      <button onClick={onHome} className="w-10 h-10 glass-premium flex items-center justify-center text-white active:scale-90 border-white/20 shadow-xl pointer-events-auto">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
      </button>
    )}
  </div>
);

const LandingView: React.FC<{ onSelect: (l: Language) => void }> = ({ onSelect }) => (
  <div className="flex-1 p-6 flex flex-col items-center justify-between h-full pt-32 pb-12">
    <GlobalHeader onHome={() => {}} showHome={false} />
    <div className="flex flex-col items-center text-center px-4 max-w-[440px]">
      <h2 className="slogan-font slogan-gradient text-3xl md:text-4xl font-extrabold italic leading-tight mb-6 text-center drop-shadow-sm">
        "Consistency learning 5 words everyday will boost your English vocabulary."
      </h2>
      <div className="w-20 h-1 bg-gradient-to-r from-emerald-800 to-emerald-500 rounded-full opacity-50"></div>
    </div>
    <div className="flex flex-col gap-4 w-full max-w-[320px]">
      <div className="text-center mb-1">
        <p className="text-[11px] font-black text-white uppercase tracking-[0.4em] text-readable opacity-80">Choose Channel</p>
      </div>
      <button onClick={() => onSelect(Language.NEPALI)} className="glass-premium p-6 flex items-center gap-5 border-white/20 group transition-all active:scale-95 shadow-2xl">
        <span className="text-4xl group-active:scale-110 transition-transform drop-shadow-md">🇳🇵</span>
        <div className="text-left"><h3 className="text-base font-black text-white uppercase tracking-tight text-readable">English-Nepali</h3></div>
      </button>
      <button onClick={() => onSelect(Language.HINDI)} className="glass-premium p-6 flex items-center gap-5 border-white/20 group transition-all active:scale-95 shadow-2xl">
        <span className="text-4xl group-active:scale-110 transition-transform drop-shadow-md">🇮🇳</span>
        <div className="text-left"><h3 className="text-base font-black text-white uppercase tracking-tight text-readable">English-Hindi</h3></div>
      </button>
    </div>
  </div>
);

const LevelSelectView: React.FC<{ onSelect: (l: Level) => void, onBack: () => void }> = ({ onSelect, onBack }) => (
  <div className="flex-1 p-8 flex flex-col justify-center items-center h-full pt-20">
    <GlobalHeader onHome={onBack} />
    <h2 className="text-3xl font-black mb-12 text-white uppercase tracking-tighter italic text-readable">Selection</h2>
    <div className="grid gap-4 w-full max-w-[280px]">
      {[Level.BEGINNER, Level.INTERMEDIATE, Level.ADVANCED].map(l => (
        <button key={l} onClick={() => onSelect(l)} className="glass-premium p-6 flex justify-between items-center active:scale-95 border-white/15 shadow-xl group">
          <span className="font-black text-sm text-white uppercase tracking-widest text-readable">{l}</span>
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20 group-active:translate-x-1 transition-transform">→</div>
        </button>
      ))}
    </div>
  </div>
);

const ProgressMapView: React.FC<{ 
  lang: Language, level: Level, stats: any, lock: any, nextDay: number,
  onSelectDay: (d: number, isHistory: boolean) => void, onBack: () => void 
}> = ({ lang, level, stats, lock, nextDay, onSelectDay, onBack }) => {
  const [showLibrary, setShowLibrary] = useState(false);
  const historyKey = `${lang}_${level}`;
  const completedDays = [...(stats.completedHistory[historyKey] || [])].sort((a, b) => b - a);

  return (
    <div className="flex-1 p-6 flex flex-col items-center justify-center h-full pt-24">
      <GlobalHeader onHome={onBack} />
      <div className="w-full max-w-[320px]">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter text-readable">{level} Academy</h2>
          <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-[0.2em] mt-1 text-readable">{lang} Mode</p>
        </div>
        <div className="glass-premium p-8 text-center relative overflow-hidden border-white/20 mb-6">
          <h3 className="text-4xl font-black text-white mb-1 tracking-tighter uppercase text-readable">Day {nextDay}</h3>
          <p className="text-[9px] font-bold text-slate-100 uppercase tracking-[0.3em] mb-8 text-readable">Session Ready</p>
          <button 
            onClick={() => !lock.locked && onSelectDay(nextDay, false)}
            className={`w-full py-6 text-[11px] font-black uppercase tracking-widest btn-skeuo-elite shadow-2xl ${lock.locked ? 'opacity-40 bg-slate-900 border-white/10' : 'btn-gold-elite'}`}
          >
            {lock.locked ? `Wait: ${lock.remaining}` : `▶️ Begin Drills`}
          </button>
        </div>
        <div className="glass-premium overflow-hidden">
          <button onClick={() => setShowLibrary(!showLibrary)} className="w-full p-5 flex items-center justify-between font-black text-white text-[11px] uppercase tracking-widest active:bg-white/5 text-readable">
            <span className="flex items-center gap-2">📘 Mastery Archive</span>
            <span className={`transform transition-transform ${showLibrary ? 'rotate-180' : ''}`}>▼</span>
          </button>
          {showLibrary && (
            <div className="p-4 pt-0 border-t border-white/10 bg-white/[0.03] max-h-[160px] overflow-y-auto custom-scroll">
              {completedDays.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 py-3">
                  {completedDays.map(d => (
                    <button key={d} onClick={() => onSelectDay(d, true)} className="bg-white/10 hover:bg-emerald-500/20 text-white font-black text-[10px] py-4 rounded-xl border border-white/10 active:scale-95 transition-colors text-readable">Day {d}</button>
                  ))}
                </div>
              ) : (<p className="text-[9px] text-slate-100 font-bold text-center py-6 uppercase tracking-widest text-readable">No logs yet</p>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const LearningView: React.FC<{ words: Word[], index: number, day: number, onSpeak: (t: string) => void, onNext: () => void, onPrev: () => void, onHome: () => void }> = ({ words, index, day, onSpeak, onNext, onPrev, onHome }) => {
  const word = words[index];
  if (!word) return null;
  return (
    <div className="h-full w-full flex flex-col items-center justify-between overflow-hidden p-5 pt-32 pb-12">
      <GlobalHeader onHome={onHome} />
      <div className="w-full max-w-[360px] flex flex-col h-full justify-between card-shift-up">
        <div className="flex justify-between items-center mb-4 px-2">
          <span className="text-[10px] font-black tracking-widest text-emerald-400 uppercase italic text-readable">Session {day}</span>
          <div className="flex gap-1.5">{words.map((_, i) => (<div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? 'w-6 bg-emerald-500' : 'w-1.5 bg-white/30'}`} />))}</div>
        </div>
        <div className="glass-premium border-white/20 shadow-3xl flex-1 flex flex-col justify-center max-h-[58%] min-h-0">
          <div className="p-6 pb-2">
            <div className="flex items-start justify-between mb-4">
              <div className="pr-4">
                 <h1 className="text-3xl font-black text-white tracking-tighter leading-tight drop-shadow-md text-readable uppercase">{word.word}</h1>
                 <p className="text-[10px] text-slate-100 font-bold tracking-widest mt-1 uppercase opacity-80 text-readable">{word.pronunciation}</p>
              </div>
              <button onClick={() => onSpeak(word.word)} className="shrink-0 w-12 h-12 glass-premium rounded-full flex items-center justify-center text-emerald-400 active:scale-75 shadow-lg border-white/20">
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20"><path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217z"/></svg>
              </button>
            </div>
            <div className="text-xl font-black text-emerald-400 uppercase tracking-tight leading-tight text-readable mb-3">{word.meaning}</div>
            {word.synonym && (
              <div className="inline-flex items-center gap-2 bg-white/10 px-2 py-0.5 rounded-lg border border-white/10 mb-4">
                <span className="text-[7px] font-black text-emerald-300 uppercase tracking-tighter text-readable">Synonym:</span>
                <span className="text-[11px] font-bold text-white text-readable lowercase">{word.synonym}</span>
              </div>
            )}
          </div>
          <div className="bg-black/35 rounded-b-3xl border-t border-white/10 shadow-inner overflow-y-auto custom-scroll flex-1 sentence-box px-6 pt-4">
            <p className="text-[13px] text-white italic font-medium leading-relaxed mb-2 text-readable">"{word.english_sentence}"</p>
            <p className="text-[11px] text-emerald-100 font-bold uppercase tracking-widest leading-relaxed text-readable">{word.native_sentence}</p>
          </div>
        </div>
        <div className="flex gap-4 mt-8">
          <button onClick={onPrev} disabled={index === 0} className="flex-1 btn-skeuo-elite py-5 text-[11px] disabled:opacity-0 uppercase font-black bg-white/10 text-white border-white/20 active:scale-95 text-readable">Back</button>
          <button onClick={onNext} className="flex-[2] btn-skeuo-elite btn-gold-elite py-5 text-[11px] font-black tracking-widest uppercase active:scale-95 shadow-xl text-readable">
            {index === words.length - 1 ? 'Start Assessment' : 'Next Word →'}
          </button>
        </div>
      </div>
    </div>
  );
};

const CompletionView: React.FC<{ onStart: () => void, onHome: () => void }> = ({ onStart, onHome }) => (
  <div className="flex-1 flex flex-col items-center justify-center p-10 h-full text-center pt-24">
    <GlobalHeader onHome={onHome} />
    <div className="text-7xl mb-8 drop-shadow-xl card-shift-up">🎓</div>
    <h2 className="text-3xl font-black mb-2 text-white uppercase italic tracking-tighter text-readable card-shift-up">Session Done</h2>
    <p className="text-slate-100 text-[11px] mb-12 uppercase tracking-[0.4em] font-bold text-readable card-shift-up">Ready for Knowledge Check</p>
    <button onClick={onStart} className="btn-skeuo-elite btn-gold-elite w-full max-w-[280px] py-7 text-[12px] font-black uppercase tracking-widest shadow-2xl active:scale-95 text-readable card-shift-up">Begin Drills</button>
  </div>
);

const QuizMCQView: React.FC<{ lang: Language, words: Word[], onDone: (r: QuizAttempt[]) => void, onHome: () => void }> = ({ lang, words, onDone, onHome }) => {
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [results, setResults] = useState<QuizAttempt[]>([]);
  const word = words[current];
  const options = useMemo(() => {
    if (!word) return [];
    const pool = words.map(w => w.meaning);
    const others = pool.filter(o => o !== word.meaning).sort(() => 0.5 - Math.random());
    return [word.meaning, ...others.slice(0, 3)].sort(() => 0.5 - Math.random());
  }, [word?.id]);
  const handleSelect = (opt: string) => {
    if (locked) return;
    setSelected(opt); setLocked(true);
    const correct = opt === word.meaning;
    const nextResults = [...results, { wordId: word.id, correct, userSelection: opt }];
    setResults(nextResults);
    setTimeout(() => {
      if (current < words.length - 1) { setCurrent(p => p + 1); setSelected(null); setLocked(false); }
      else onDone(nextResults);
    }, 700);
  };
  if (!word) return null;
  return (
    <div className="flex-1 p-6 flex flex-col items-center justify-center h-full pt-24">
      <GlobalHeader onHome={onHome} />
      <div className="w-full max-w-[340px] card-shift-up">
        <div className="text-center mb-8">
          <span className="text-[10px] font-black text-emerald-400 uppercase mb-3 block tracking-[0.3em] italic text-readable">Drill {current + 1} / {words.length}</span>
          <h2 className="text-2xl font-black text-white leading-snug text-readable">Translate: <br/><span className="text-3xl text-emerald-300 italic">"{word.word}"</span></h2>
        </div>
        <div className="grid grid-cols-1 gap-4">
          {options.map((opt, i) => {
            let style = "glass-premium p-5 text-[15px] font-black uppercase transition-all shadow-xl active:scale-95 text-readable";
            if (locked) {
              if (opt === word.meaning) style = "bg-emerald-600/90 border-transparent p-5 text-[16px] font-black uppercase shadow-2xl scale-105 z-10 text-readable";
              else if (opt === selected) style = "bg-rose-600/90 border-transparent opacity-60 p-5 text-[16px] font-black uppercase text-readable";
              else style += " opacity-20 pointer-events-none";
            }
            return <button key={i} onClick={() => handleSelect(opt)} className={style}>{opt}</button>;
          })}
        </div>
      </div>
    </div>
  );
};

const QuizScoreView: React.FC<{ score: number, total: number, onContinue: () => void, onHome: () => void }> = ({ score, total, onContinue, onHome }) => (
  <div className="flex-1 flex flex-col items-center justify-center p-12 h-full text-center pt-24">
    <GlobalHeader onHome={onHome} />
    <div className="w-44 h-44 glass-premium flex flex-col items-center justify-center border-2 border-white/20 mb-10 shadow-3xl card-shift-up">
      <span className="text-[10px] font-black text-slate-100 uppercase mb-2 tracking-widest opacity-70 text-readable">Accuracy</span>
      <span className="text-5xl font-black text-emerald-300 italic text-readable">{Math.round((score/total)*100)}%</span>
    </div>
    <button onClick={onContinue} className="btn-skeuo-elite btn-gold-elite w-full max-w-[280px] py-7 text-[12px] font-black uppercase tracking-widest active:scale-95 shadow-2xl text-readable card-shift-up">Final Phase</button>
  </div>
);

const QuizFinalView: React.FC<{ words: Word[], lang: Language, onComplete: (score: number) => void, onHome: () => void }> = ({ words, lang, onComplete, onHome }) => {
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const [locked, setLocked] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const targetLang = lang === Language.NEPALI ? "Nepali" : "Hindi";
  const questions = useMemo<FinalQuestion[]>(() => {
    const shuffledPool = [...words].sort(() => 0.5 - Math.random());
    const types: FinalQuestionType[] = ['meaning-match', 'fill-blank', 'sentence-completion', 'synonym-logic', 'translation-verify'];
    return shuffledPool.map((w, idx) => {
      const type = types[idx % types.length];
      let prompt = ""; let correct = ""; let options: string[] = [];
      switch(type) {
        case 'meaning-match': prompt = `Precise ${targetLang} term for "${w.word}":`; correct = w.meaning; options = [w.meaning, ...words.filter(x => x.id !== w.id).map(x => x.meaning).slice(0, 3)]; break;
        case 'fill-blank': prompt = `Missing term: "${w.english_sentence.replace(new RegExp(`\\b${w.word}\\b`, 'gi'), '_____')}"`; correct = w.word; options = [w.word, ...words.filter(x => x.id !== w.id).map(x => x.word).slice(0, 3)]; break;
        case 'sentence-completion': prompt = `In "${w.native_sentence}", which English root matches?`; correct = w.word; options = [w.word, ...words.filter(x => x.id !== w.id).map(x => x.word).slice(0, 3)]; break;
        case 'synonym-logic': prompt = `Closest lexicon peer for "${w.word}":`; correct = w.synonym; options = [w.synonym, ...words.filter(x => x.id !== w.id).map(x => x.synonym).slice(0, 3)]; break;
        case 'translation-verify': prompt = `Verify valid contextual usage of "${w.word}":`; correct = w.english_sentence; options = [w.english_sentence, ...words.filter(x => x.id !== w.id).map(x => x.english_sentence).slice(0, 3)]; break;
      }
      return { type, prompt, correct, options: options.sort(() => 0.5 - Math.random()), wordId: w.id };
    });
  }, [words, targetLang]);
  const q = questions[current];
  const handleAns = (opt: string) => {
    if (locked) return;
    setSelected(opt); setLocked(true);
    const isCorrect = opt === q.correct;
    if (isCorrect) setScore(s => s + 1);
    setTimeout(() => {
      if (current < questions.length - 1) { setCurrent(p => p + 1); setLocked(false); setSelected(null); }
      else onComplete(score + (isCorrect ? 1 : 0));
    }, 700);
  };
  if (!q) return null;
  return (
    <div className="flex-1 p-6 flex flex-col items-center justify-center h-full pt-24">
      <GlobalHeader onHome={onHome} />
      <div className="w-full max-w-[360px] card-shift-up">
        <div className="text-center mb-6">
          <span className="text-[11px] font-black text-emerald-400 uppercase mb-3 block tracking-[0.4em] italic opacity-80 text-readable">Stage {current + 1} / 5</span>
          <div className="glass-premium p-5 bg-black/45 border-white/20 min-h-[120px] flex items-center justify-center mb-8 shadow-xl">
            <p className="text-[16px] font-black text-white italic leading-relaxed text-readable sentence-box">{q.prompt}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4">
          {q.options.map((opt, i) => {
            let style = "glass-premium p-4 text-[14px] font-black uppercase transition-all shadow-xl active:scale-95 text-readable";
            if (locked) {
              if (opt === q.correct) style = "bg-emerald-600/80 border-transparent p-4 text-[15px] font-black shadow-2xl scale-105 z-10 text-readable";
              else if (opt === selected) style = "bg-rose-600/80 border-transparent opacity-60 p-4 text-[15px] font-black text-readable";
              else style += " opacity-20 pointer-events-none";
            }
            return <button key={i} onClick={() => handleAns(opt)} className={style}>{opt}</button>;
          })}
        </div>
      </div>
    </div>
  );
};

const SummaryView: React.FC<{ day: number, score: number, total: number, onRevise: () => void, onNextDay: () => void, onHome: () => void }> = ({ day, score, total, onRevise, onNextDay, onHome }) => {
  const nextDay = day + 1;
  const lockInfo = checkDayLock(nextDay);
  return (
    <div className="flex-1 p-10 flex flex-col items-center justify-center h-full text-center pt-24">
      <GlobalHeader onHome={onHome} />
      <div className="text-8xl mb-8 animate-bounce drop-shadow-xl card-shift-up">🏆</div>
      <h2 className="text-4xl font-black mb-3 text-white uppercase italic tracking-tighter text-readable card-shift-up">Day {day} Mastery</h2>
      <p className="text-emerald-400 text-[11px] font-black tracking-[0.5em] mb-16 uppercase text-readable card-shift-up">{score}/{total} DRILLS PASSED</p>
      <div className="grid gap-4 w-full max-w-[280px] card-shift-up">
        {!lockInfo.locked ? (
          <>
            <button onClick={onNextDay} className="btn-skeuo-elite btn-gold-elite py-6 font-black text-[12px] uppercase shadow-2xl active:scale-95 text-readable">Next: Day {nextDay}</button>
            <button onClick={onRevise} className="glass-premium py-5 font-black text-white text-[10px] uppercase tracking-widest border border-white/20 active:scale-95 text-readable">Review Today</button>
          </>
        ) : (
          <>
            <button onClick={onRevise} className="btn-skeuo-elite btn-gold-elite py-6 font-black text-[12px] uppercase shadow-2xl active:scale-95 text-readable">Review Session</button>
            <button onClick={onHome} className="glass-premium py-5 font-black text-white text-[10px] uppercase tracking-widest border border-white/20 active:scale-95 text-readable">Exit Academy</button>
          </>
        )}
      </div>
    </div>
  );
};

const HistoryView: React.FC<{ day: number, words: Word[], onBack: () => void, onHome: () => void }> = ({ day, words, onBack, onHome }) => (
  <div className="flex-1 p-5 flex flex-col h-full overflow-hidden pt-32">
    <GlobalHeader onHome={onHome} />
    <div className="mt-2 mb-6 flex justify-between items-end border-b border-white/20 pb-4 px-2">
      <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic text-readable">Day {day} Archive</h2>
      <button onClick={onBack} className="bg-emerald-600/40 px-5 py-2 rounded-xl text-emerald-100 font-black text-[10px] uppercase border border-emerald-500/40 active:scale-95 shadow-lg text-readable">Return</button>
    </div>
    <div className="flex-1 overflow-y-auto pb-12 custom-scroll pr-1">
      <div className="grid grid-cols-2 gap-4">
        {words.map(w => (
          <div key={w.id} className="glass-premium history-card shadow-lg active:scale-95 flex flex-col p-5 min-h-[120px]">
            <h3 className="font-black text-base text-white tracking-tighter leading-tight mb-2 uppercase text-readable">{w.word}</h3>
            <p className="text-emerald-300 font-black text-[11px] uppercase tracking-wider mb-3 leading-tight text-readable">{w.meaning}</p>
            {w.synonym && (
               <div className="mt-auto pt-2 border-t border-white/10 w-full flex items-center gap-2">
                 <span className="text-[7px] font-black text-white/50 uppercase text-readable">Syn:</span>
                 <span className="text-[10px] font-medium text-slate-100 italic lowercase text-readable">{w.synonym}</span>
               </div>
            )}
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default App;