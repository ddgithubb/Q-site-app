import React, { useEffect, useState } from 'react'
import './App.css'
import { ConnectToPool } from './pool/connect-pool'
import { PoolInfo, PoolUser } from './pool/pool.model'
import { poolAction } from './store/slices/pool.slice'
import { getStoreState, store } from './store/store'
import { BrowserRouter, Route, Routes } from "react-router-dom"
import { PoolView } from './views/pool/PoolView'
import { Pools } from './views/pool/Pools'
import { profileAction, ProfileState } from './store/slices/profile.slice'

const dispatch = store.dispatch

dispatch(profileAction.initProfile({
  userID: "TEST_USER_ID",
} as ProfileState))

dispatch(poolAction.initPools([
  {
    PoolID: "main",
    Users: [ {
      userID: "TEST_USER_ID",
      displayName: "TEST_USER",
    } ],
    Key: 0,
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
