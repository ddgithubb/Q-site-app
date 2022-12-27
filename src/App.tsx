import React, { useEffect, useState } from 'react'
import './App.css'
import { DeviceType, PoolInfo, PoolUser } from './pool/pool.model'
import { poolAction } from './store/slices/pool.slice'
import { getStoreState, store } from './store/store'
import { BrowserRouter, Route, Routes, useNavigate, useSearchParams } from "react-router-dom"
import { PoolContainerView, PoolView } from './views/pool/PoolView'
import { DEFAULT_TEST_POOL_NAME, Pools } from './views/pool/Pools'
import { mebibytesToBytes } from './helpers/file-size'
import { FileManager } from './pool/global'
import { profileAction } from './store/slices/profile.slice'
import { JoinPool } from './views/static/JoinPool'
import { checkNAT } from './pool/pool-checks'
import { UnsupportedPage } from './views/static/UnsupportedPage'
import { MaintenancePage } from './views/static/MaintenancePage'

function App() {

  const [ gateOpen, setGateOpen ] = useState<boolean>(false);
  const [ unsupportedNAT, setUnsupportedNAT ] = useState<boolean>(false);

  useEffect(() => {
    let initFunc = async () => {
      // if (!(await checkNAT())) {
      //   setUnsupportedNAT(true);
      //   return;
      // }
      await FileManager.init();
      setGateOpen(true);
    }
    initFunc();
  }, [])

  // useEffect(() => {
  //   console.log(gateOpen);
  // }, [gateOpen]);

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