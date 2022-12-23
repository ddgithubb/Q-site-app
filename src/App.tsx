import React, { useEffect, useState } from 'react'
import './App.css'
import { DeviceType, PoolInfo, PoolUser } from './pool/pool.model'
import { poolAction } from './store/slices/pool.slice'
import { getStoreState, store } from './store/store'
import { BrowserRouter, Route, Routes } from "react-router-dom"
import { PoolContainerView, PoolView } from './views/pool/PoolView'
import { Pools } from './views/pool/Pools'
import { mebibytesToBytes } from './helpers/file-size'
import { FileManager } from './pool/global'

const dispatch = store.dispatch
// USERS SHOULD BE SORTED FROM SERVER
dispatch(poolAction.initPools([
  {
    PoolID: "main",
    PoolName: "Pool Test",
    Users: [],
    Key: 0,
    Settings: {
      maxTextLength: 5000,
      maxMediaSize: mebibytesToBytes(32),
    }
  } as PoolInfo
]))

// {
//   UserID: "TEST_USER_ID",
//   DisplayName: "TEST_USER",
//   Devices: [getStoreState().profile.device, {
//     DeviceID: "OTHER_DEVICE_ID",
//     DeviceType: DeviceType.DESKTOP,
//     DeviceName: "OTHER_DEVICE_NAME",
//   }],
// } 

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
          <Route path="/" element={ <Pools /> } /> 
          <Route path="/pool" element={ <Pools /> }>
            <Route path=":poolID" element={ <PoolContainerView /> } />
          </Route>
        </Routes>
      </BrowserRouter>  
    ) : null
  );
}

export default App;
