import React, { useState, useEffect } from 'react';
import NeonSortViz from './components/NeonSortViz';

const App: React.FC = () => {
  const [algorithm, setAlgorithm] = useState<'insertion' | 'bubble'>('insertion');

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.includes('/bubblesort')) {
        setAlgorithm('bubble');
      } else {
        setAlgorithm('insertion');
      }
    };

    // Initial check
    handlePopState();

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (algo: 'insertion' | 'bubble') => {
    const path = algo === 'insertion' ? '/insertionsort' : '/bubblesort';
    window.history.pushState({}, '', path);
    setAlgorithm(algo);
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 text-white selection:bg-cyan-500 selection:text-white overflow-x-hidden">
      <NeonSortViz algorithm={algorithm} onNavigate={navigate} />
    </div>
  );
};

export default App;