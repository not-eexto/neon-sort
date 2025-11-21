
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Download, Settings2, Activity, Zap } from 'lucide-react';
import { BarState, ArrayBar } from '../types';

// --- GIF Worker Blob ---
// We inject the worker code directly to avoid CORS/Path issues with external worker files in a client-side bundle.
const workerBlob = new Blob([`
  importScripts('https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js');
`], { type: 'application/javascript' });
const workerUrl = URL.createObjectURL(workerBlob);

const InsertionSortViz: React.FC = () => {
  // --- Core State ---
  const [array, setArray] = useState<ArrayBar[]>([]);
  const [sorting, setSorting] = useState(false);
  const [paused, setPaused] = useState(false);
  const [completed, setCompleted] = useState(false);
  
  // --- Configuration State ---
  const [speed, setSpeed] = useState(50);
  const [arraySize, setArraySize] = useState(25);
  
  // --- Recording State ---
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  
  // --- Refs ---
  const stopRef = useRef(false);
  const pauseRef = useRef(false);
  const recordingRef = useRef(false); // Sync ref for recording state to avoid closure staleness
  const containerRef = useRef<HTMLDivElement>(null);
  const gifInstance = useRef<any>(null);

  // Generate Random Array
  const generateArray = useCallback(() => {
    stopRef.current = true;
    recordingRef.current = false; // Ensure recording stops on reset
    setSorting(false);
    setCompleted(false);
    setPaused(false);
    
    // Create new array with unique IDs based on index
    const newArray: ArrayBar[] = Array.from({ length: arraySize }, (_, i) => ({
      value: Math.floor(Math.random() * 85) + 15, // 15 to 100
      state: BarState.Idle,
      id: i
    }));
    setArray(newArray);
    
    // Small timeout to ensure state settles before allowing new actions
    setTimeout(() => {
        stopRef.current = false;
    }, 100);
  }, [arraySize]);

  // Initial Load
  useEffect(() => {
    generateArray();
  }, [generateArray]);

  // Sleep Utility
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // Check Pause Utility
  const checkPause = async () => {
    while (pauseRef.current) {
      await sleep(50);
    }
  };

  // --- GIF Capture Utility ---
  const captureFrame = async (force = false) => {
    // Check recordingRef instead of state to avoid closure staleness in the async loop
    if ((recordingRef.current || force) && gifInstance.current && containerRef.current) {
      try {
        console.log(`[GIF] Capturing frame... (Ref: ${recordingRef.current}, Force: ${force})`);
        
        // Force a small delay to ensure DOM updates are painted
        await new Promise(r => requestAnimationFrame(r));
        
        const canvas = await window.html2canvas(containerRef.current, {
          backgroundColor: '#0f172a', // match bg-slate-900
          scale: 1,
          logging: true, // VERBOSE LOGGING ENABLED
          useCORS: true
        });
        
        // Add frame to GIF
        gifInstance.current.addFrame(canvas, { 
            delay: recordingRef.current ? 100 : Math.max(20, 2000 / speed) 
        });
        console.log("[GIF] Frame added.");
      } catch (e) {
        console.error("[GIF] Frame capture failed", e);
      }
    } else {
        if (recordingRef.current) {
             console.warn("[GIF] Skipping frame. Missing refs:", { 
                gif: !!gifInstance.current, 
                container: !!containerRef.current 
            });
        }
    }
  };

  // --- Insertion Sort Algorithm ---
  const runInsertionSort = async (recordMode = false) => {
    if (completed) {
      generateArray();
      await sleep(300);
    }

    console.log(`[Sort] Starting... RecordMode: ${recordMode}`);

    setSorting(true);
    setCompleted(false);
    stopRef.current = false;
    pauseRef.current = false;
    setPaused(false);

    // Initialize GIF if recording
    if (recordMode) {
      setIsRecording(true);
      recordingRef.current = true;
      setRecordingProgress(0);
      
      console.log("[GIF] Initializing worker...");
      gifInstance.current = new window.GIF({
        workers: 2,
        quality: 10,
        workerScript: workerUrl,
        width: containerRef.current?.offsetWidth || 800,
        height: containerRef.current?.offsetHeight || 400,
        debug: true // GIF.js debug mode
      });
    }

    // Use a deep copy logic by mapping to new objects to ensure we don't mutate state in place inappropriately
    let arr = array.map(item => ({ ...item }));
    
    // Initial capture
    if (recordMode) await captureFrame(true);

    const delayTime = recordMode ? 150 : (2000 / speed);

    for (let i = 1; i < arr.length; i++) {
      if (stopRef.current) break;
      await checkPause();

      // 1. Highlight the Key (the element we are trying to insert)
      arr[i] = { ...arr[i], state: BarState.Active };
      setArray([...arr]);
      
      await sleep(delayTime);
      if (recordMode) await captureFrame();

      let j = i;
      
      // 2. Bubble the element down to its correct position (Swap Logic)
      while (j > 0 && arr[j - 1].value > arr[j].value) {
        if (stopRef.current) break;
        await checkPause();

        // Highlight comparison
        arr[j - 1] = { ...arr[j - 1], state: BarState.Compare };
        setArray([...arr]);
        
        await sleep(delayTime);
        if (recordMode) await captureFrame();

        // Perform Swap
        [arr[j], arr[j - 1]] = [arr[j - 1], arr[j]];
        
        // Update states after swap
        arr[j] = { ...arr[j], state: BarState.Sorted };
        arr[j - 1] = { ...arr[j - 1], state: BarState.Active };
        
        setArray([...arr]);
        
        if (recordMode) {
           setRecordingProgress(Math.round((i / arr.length) * 100));
           await captureFrame();
        }
        
        await sleep(delayTime);
        j--;
      }
      
      // 3. Element is now in position
      arr[j] = { ...arr[j], state: BarState.Sorted };
      
      // Ensure all elements to the left are marked sorted
      for(let k = 0; k < i; k++) {
          arr[k] = { ...arr[k], state: BarState.Sorted };
      }

      setArray([...arr]);
      await sleep(delayTime);
      if (recordMode) await captureFrame();
    }

    // Finish
    if (!stopRef.current) {
      setCompleted(true);
      const finalArr = arr.map(item => ({ ...item, state: BarState.Sorted }));
      setArray(finalArr);
      if (recordMode) await captureFrame(true); // Force final frame
    }

    setSorting(false);

    // Finalize GIF
    if (recordMode) {
      console.log("[GIF] Rendering...");
      setRecordingProgress(100);
      setIsRecording(false);
      recordingRef.current = false;

      gifInstance.current.on('finished', (blob: Blob) => {
        console.log("[GIF] Finished rendering. Downloading...");
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'neon-sort.gif';
        link.click();
        setRecordingProgress(0);
      });
      
      gifInstance.current.render();
    }
  };

  const handleStop = () => {
    stopRef.current = true;
    recordingRef.current = false;
    setSorting(false);
    setPaused(false);
    setIsRecording(false);
  };

  const togglePause = () => {
    pauseRef.current = !pauseRef.current;
    setPaused(pauseRef.current);
  };

  const startRecording = () => {
    if (sorting) return;
    generateArray();
    // Slight delay to let the reset paint
    setTimeout(() => {
        runInsertionSort(true);
    }, 500);
  };

  // --- Visual Helpers ---
  const getBarColor = (state: BarState, val: number) => {
    switch (state) {
      case BarState.Active:
        return 'bg-fuchsia-500 shadow-[0_0_15px_rgba(217,70,239,0.6)] z-20 scale-105 ring-2 ring-fuchsia-200';
      case BarState.Compare:
        return 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.6)] z-10';
      case BarState.Overwrite:
        return 'bg-violet-400 opacity-80';
      case BarState.Sorted:
        return 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.3)]';
      default:
        return 'bg-slate-700 hover:bg-slate-600';
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
      
      {/* Header */}
      <header className="w-full mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 animate-fade-in">
        <div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-rose-400">
            NEON SORT
          </h1>
          <div className="flex items-center gap-2 mt-2 text-slate-400 font-mono text-sm">
            <Activity size={16} className="text-fuchsia-400" />
            <span>INSERTION ALGORITHM</span>
            <span className="mx-2 text-slate-700">|</span>
            <span className="text-slate-500">O(n²) COMPLEXITY</span>
          </div>
        </div>
        
        <div className="flex flex-col items-end">
          <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${sorting ? 'bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
            <div className={`w-2 h-2 rounded-full ${sorting ? (paused ? 'bg-yellow-400 animate-pulse' : 'bg-fuchsia-500 animate-pulse') : 'bg-slate-500'}`}></div>
            {sorting ? (paused ? 'PAUSED' : (isRecording ? 'RECORDING GIF...' : 'RUNNING')) : 'READY'}
          </div>
        </div>
      </header>

      {/* Visualization Container */}
      <div className="w-full relative group">
        {/* Glass Background */}
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-rose-500 rounded-2xl opacity-20 group-hover:opacity-40 blur transition duration-500"></div>
        
        <div 
            ref={containerRef}
            className="relative w-full h-[400px] md:h-[500px] bg-slate-900/90 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl overflow-hidden flex items-end justify-center gap-[2px] md:gap-1 p-4 md:p-8"
        >
          {/* Grid Lines (Aesthetic) */}
          <div className="absolute inset-0 w-full h-full pointer-events-none opacity-10" 
               style={{ backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
          </div>

          {array.map((bar) => (
            <div
              key={bar.id}
              className={`relative rounded-t-md md:rounded-t-lg transition-all duration-300 ease-out ${getBarColor(bar.state, bar.value)}`}
              style={{
                height: `${bar.value}%`,
                width: `${100 / arraySize}%`,
                maxWidth: '60px'
              }}
            >
              {/* Value Label (Visible on hover or if array is small) */}
              {(arraySize <= 25 || bar.state === BarState.Active) && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-white/80 font-mono text-xs md:text-sm font-bold pointer-events-none">
                  {bar.value}
                </div>
              )}
              
              {/* Reflection effect */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-50 pointer-events-none rounded-t-md"></div>
            </div>
          ))}
        </div>

        {/* Recording Overlay - Moved outside containerRef so it's not captured */}
        {isRecording && (
            <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white rounded-xl">
               <div className="w-16 h-16 border-4 border-fuchsia-500 border-t-transparent rounded-full animate-spin mb-4"></div>
               <h3 className="text-xl font-bold tracking-wider">RENDERING GIF</h3>
               <p className="text-slate-400 font-mono mt-2 text-sm">Frame capture in progress... {recordingProgress}%</p>
               <p className="text-slate-500 text-xs mt-2">Check console for verbose logs</p>
            </div>
        )}
      </div>

      {/* Controls Area */}
      <div className="w-full mt-8 grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Sliders Panel */}
        <div className="md:col-span-5 bg-slate-900/50 border border-slate-800 rounded-xl p-6 flex flex-col justify-center gap-6">
            
            {/* Speed Slider */}
            <div className="space-y-2">
                <div className="flex justify-between text-xs uppercase tracking-wider font-bold text-slate-500">
                    <span className="flex items-center gap-1"><Zap size={14} /> Speed</span>
                    <span>{speed}ms</span>
                </div>
                <input 
                    type="range" 
                    min="10" 
                    max="150" 
                    step="10"
                    value={speed} 
                    onChange={(e) => setSpeed(Number(e.target.value))}
                    disabled={sorting}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-fuchsia-500 hover:accent-fuchsia-400 disabled:opacity-50"
                />
            </div>

            {/* Count Slider */}
            <div className="space-y-2">
                <div className="flex justify-between text-xs uppercase tracking-wider font-bold text-slate-500">
                    <span className="flex items-center gap-1"><Settings2 size={14} /> Elements</span>
                    <span>{arraySize}</span>
                </div>
                <input 
                    type="range" 
                    min="10" 
                    max="60" 
                    step="5"
                    value={arraySize} 
                    onChange={(e) => setArraySize(Number(e.target.value))}
                    disabled={sorting}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 disabled:opacity-50"
                />
            </div>
        </div>

        {/* Playback Controls */}
        <div className="md:col-span-7 flex flex-col gap-4">
            
            <div className="flex gap-3 h-full">
                <button 
                    onClick={generateArray}
                    disabled={sorting && !paused}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-xl flex flex-col items-center justify-center gap-2 transition-all group"
                >
                    <RotateCcw size={24} className="group-hover:-rotate-180 transition-transform duration-500" />
                    <span className="text-xs font-bold uppercase tracking-widest">Reset</span>
                </button>

                {!sorting ? (
                    <button 
                        onClick={() => runInsertionSort(false)}
                        className="flex-[2] bg-gradient-to-br from-indigo-600 to-fuchsia-600 hover:from-indigo-500 hover:to-fuchsia-500 text-white rounded-xl flex flex-col items-center justify-center gap-2 shadow-lg shadow-fuchsia-900/20 transition-all transform active:scale-95"
                    >
                        <Play size={32} fill="currentColor" />
                        <span className="text-xs font-bold uppercase tracking-widest">Start Sorting</span>
                    </button>
                ) : (
                    <>
                        <button 
                            onClick={togglePause}
                            className="flex-[1.5] bg-slate-700 hover:bg-slate-600 text-white rounded-xl flex flex-col items-center justify-center gap-2 transition-all"
                        >
                            {paused ? <Play size={28} fill="currentColor" /> : <Pause size={28} fill="currentColor" />}
                            <span className="text-xs font-bold uppercase tracking-widest">{paused ? 'Resume' : 'Pause'}</span>
                        </button>
                        <button 
                            onClick={handleStop}
                            className="flex-1 bg-rose-900/50 hover:bg-rose-900/80 border border-rose-800 text-rose-200 rounded-xl flex flex-col items-center justify-center gap-2 transition-all"
                        >
                            <div className="w-6 h-6 bg-current rounded-sm"></div>
                            <span className="text-xs font-bold uppercase tracking-widest">Stop</span>
                        </button>
                    </>
                )}
            </div>

            {/* GIF Export Button */}
            <button 
                onClick={startRecording}
                disabled={sorting}
                className="w-full py-4 bg-slate-900 border border-slate-800 hover:border-fuchsia-500/50 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl transition-all flex items-center justify-center gap-3 group disabled:opacity-30 disabled:cursor-not-allowed"
            >
                <div className="p-2 bg-slate-800 group-hover:bg-fuchsia-500/20 rounded-full transition-colors">
                    <Download size={18} className="text-slate-400 group-hover:text-fuchsia-400" />
                </div>
                <div className="text-left">
                    <div className="text-sm font-bold">Export as GIF</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">Renders Animation & Downloads</div>
                </div>
            </button>
        </div>

      </div>

      {/* Footer Legend */}
      <div className="mt-12 flex flex-wrap justify-center gap-6 md:gap-12 text-sm font-mono text-slate-500">
         <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-slate-700"></div> Idle
         </div>
         <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-fuchsia-500 shadow-[0_0_10px_rgba(217,70,239,0.5)]"></div> Current Key
         </div>
         <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]"></div> Comparing
         </div>
         <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]"></div> Sorted
         </div>
      </div>

    </div>
  );
};

export default InsertionSortViz;
