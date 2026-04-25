import React, { useState } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import Hero from './sections/Hero';
import About from './sections/About';
import Board from './sections/Board';

const App = () => {
  const [page, setPage] = useState('intro'); // 'intro' | 'board'

  return (
    <>
      <Header page={page} setPage={setPage} />
      <main>
        {page === 'intro' ? (
          <>
            <Hero setPage={setPage} />
            <About />
          </>
        ) : (
          <Board />
        )}
      </main>
      <Footer />
    </>
  );
};

export default App;
