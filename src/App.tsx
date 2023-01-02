import { useEffect, useState } from 'react'
import './App.css'
import { BrowserRouter, Route, Routes } from "react-router-dom"
import { PoolContainerView } from './views/pool/PoolView'
import { Pools } from './views/pool/Pools'
import { FileManager } from './pool/global'
import { JoinPool } from './views/static/JoinPool'
import { checkNAT } from './pool/pool-checks'
import { UnsupportedPage } from './views/static/UnsupportedPage'
import { validateSSState, MaintenancePage } from './views/static/MaintenancePage'

function App() {

  const [ gateOpen, setGateOpen ] = useState<boolean>(false);
  const [ unsupportedNAT, setUnsupportedNAT ] = useState<boolean>(false);

  useEffect(() => {
    let initFunc = async () => {
      if (!(await checkNAT())) {
        setUnsupportedNAT(true);
        return;
      }
      await validateSSState();
      await FileManager.init();
      setGateOpen(true);
    }
    initFunc();
  }, [])

  return (
    gateOpen ? (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={ <JoinPool /> } />
          <Route path="/join-pool" element={ <JoinPool /> }/> 
          <Route path="/pool" element={ <Pools /> } />
          <Route path="/pool/:poolID" element={ <PoolContainerView /> } />
          <Route path="/maintenance" element={ <MaintenancePage /> } />
        </Routes>
      </BrowserRouter>  
    ) : unsupportedNAT ? (
      <UnsupportedPage />
    ) : null
  );
}

export default App;