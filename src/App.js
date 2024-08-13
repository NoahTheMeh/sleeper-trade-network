import React, { useState } from 'react';
import FetchSleeperData from './FetchSleeperData';
import TradesNetwork from './TradesNetwork';

const App = () => {
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
