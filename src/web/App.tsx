import React from "react"; //enable jsx
import { useState, useEffect } from "react";
import "./App.css";


const { electron } = window;

export const App = () => {
  const [count, setCount] = useState(0);
  const [results, setResults] = useState<any>([])

  useEffect(() => {(async () => {
    console.log('start testRxDB')

    await electron.api.createDB();
    const doc = await electron.api.runDB()
    setResults(doc)

    console.log('renderer doc', doc)
  })()}, [])

  return (
    <div className="container">

      <h1>{count}</h1>
      <button onClick={() => setCount((count) => count + 1)}>Count</button>

      <br />
            {!results?(<div>loading...</div>):(<>
                {/*<button onClick={search}>search</button>*/}
                <div>{results.length} found.</div>
                <style>{'table,tr,th,td{border:1px solid}'}</style>
                <table>
                    <tr>
                        <th>id</th>
                        <th>name</th>
                        <th>tag.name</th>
                        <th>tag.type</th>
                        <th>tag.value</th>
                    </tr>
                    {results.slice(0,100).map((res:any) => { return(
                        <>
                        {res.tags.map((tag:any,i:number) => { return(
                            <tr>
                                <td>{i==0?res.id:''}</td>
                                <td>{i==0?res.name:''}</td>
                                <td>{tag.name}</td>
                                <td>{tag.tagType}</td>
                                <td>{tag.tagType!='date'?tag.value:(new Date(tag.value)).toDateString()}</td>
                            </tr>
                        )})}
                        </>
                    )})}
                </table>
            </>)}
    </div>
  );
};
