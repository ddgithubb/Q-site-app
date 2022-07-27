import React, { useEffect, useState } from 'react'
import './App.css'
import { ConnectToPool } from './pool/connect-pool'
import { PoolInfo } from './pool/pool.model'
import { poolAction } from './store/slices/pool.slice'
import { getStoreState, store } from './store/store'

const dispatch = store.dispatch

dispatch(poolAction.initPools([
  {
    PoolID: "main",
    Users: [],
    Key: 0,
  } as PoolInfo
]))
ConnectToPool(getStoreState().pool.pools[0]);

function App() {

  useEffect(() => {

  }, [])

  return (
      <div className="main">
            
      </div>
  );
}

export default App;
