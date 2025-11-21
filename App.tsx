import React from 'react';
import InsertionSortViz from './components/InsertionSortViz';

const App: React.FC = () => {
  return (
    <div className="w-full min-h-screen bg-slate-950 text-white selection:bg-fuchsia-500 selection:text-white overflow-x-hidden">
      <InsertionSortViz />
    </div>
  );
};

export default App;