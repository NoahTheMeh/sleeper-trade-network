import React, { useState, useEffect } from 'react';
import FetchSleeperData from './FetchSleeperData';
import TradesNetwork from './TradesNetwork';
import './App.css';

const App = () => {

  useEffect(() => {
    document.title = 'Sleeper League Trade Analysis';
  }, []);

  const [data, setData] = useState(null);

  return (
    <div>
      <h1>Sleeper Trades Network</h1>
      <FetchSleeperData setData={setData} />
      {data ? <TradesNetwork data={data} /> : <p>Loading...</p>}
    </div>
  );
};

export default App;
