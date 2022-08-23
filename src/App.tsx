import React, { useEffect, useState } from 'react'
import './App.css'
import { PoolInfo, PoolUser } from './pool/pool.model'
import { poolAction } from './store/slices/pool.slice'
import { getStoreState, store } from './store/store'
import { BrowserRouter, Route, Routes } from "react-router-dom"
import { PoolView } from './views/pool/PoolView'
import { Pools } from './views/pool/Pools'
import { mebibytesToBytes } from './helpers/file-size'

const dispatch = store.dispatch
dispatch(poolAction.initPools([
  {
    PoolID: "main",
    PoolName: "TEST_POOL",
    Users: [ {
      UserID: "TEST_USER_ID",
      DisplayName: "TEST_USER",
    } ],
    Settings: {
      maxTextLength: 5000,
      maxMediaSize: mebibytesToBytes(10),
    }
  } as PoolInfo
]))

function App() {

  useEffect(() => {

  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={ <Pools /> } /> 
        <Route path="/pool" element={ <Pools /> }>
          <Route path=":poolID" element={ <PoolView /> } />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
