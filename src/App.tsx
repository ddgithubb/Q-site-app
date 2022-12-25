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

function App() {

  const [ gateOpen, setGateOpen ] = useState<boolean>(false);

  useEffect(() => {
    let initFunc = async () => {
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
        </Routes>
      </BrowserRouter>  
    ) : null
  );
}

export default App;

function JoinPool() {

  let [searchParams] = useSearchParams();
  let navigate = useNavigate();

  let [ poolID, setPoolID ] = useState<string>(searchParams.get("poolid") || DEFAULT_TEST_POOL_NAME);
  let [ displayName, setDisplayName ] = useState<string>("");

  const goToPool = () => {
    if (displayName == "") return;
    navigate('/pool/' + poolID + "?displayName=" + displayName);
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
        <h1>Pool Net TEST</h1>
        <input type="text" placeholder='PoolID' style={{ padding: "10px", fontSize: "14px" }} value={poolID} onChange={(e) => setPoolID(e.target.value)} />
        <input type="text" placeholder='Display Name' style={{ padding: "10px", fontSize: "14px" }} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <input type="button" value={"Go to pool: " + poolID} style={{ padding: "8px", marginTop: "20px", fontSize: "16px" }} onClick={goToPool}/>
      </div>
    </div>
  )
}