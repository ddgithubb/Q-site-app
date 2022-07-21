import React, { useEffect, useState } from 'react'
import './App.css'
import { ConnectToPool } from './services/ConnectPool.service'

function App() {

  useEffect(() => {

    ConnectToPool("MAIN");

  }, [])

  return (
      <div className="main">
            
      </div>
  );
}

export default App;
