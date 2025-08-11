import React from 'react';
import TitrationGame from './TitrationGame';

/**
 * Root component for SiU Lab.  This file now simply renders the
 * TitrationGame component, which contains the complete titration
 * simulation.  Styles are applied globally in index.css.
 */
export default function App() {
  return (
    <div style={{ fontFamily: 'sans-serif' }}>
      <TitrationGame />
    </div>
  );
}
