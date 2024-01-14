import path from "path";
import { BrowserWindow, app, ipcMain } from "electron";

import { v4 } from 'uuid'
import PouchDB from 'pouchdb'
import PouchDBFind from 'pouchdb-find'

//leveldownの

// PouchDBのアダプターをRxDBに追加
//RxDB.addRxPlugin(pouchdbAdapterLeveldb(new PouchDB()));

let db:PouchDB.Database<any>
PouchDB.plugin(PouchDBFind)

let num: number = 0

// RxDBの初期化とデータベースの作成
async function createDB() {
  console.log(`createDB:${num}`); num++;
  // データベースの保存先ディレクトリ
  const dbDirectory = './db/mydatabase';

  // データベースの初期化
  db = new PouchDB(dbDirectory, {
    auto_compaction: true,
    //adapter: 'leveldb',
    //worker: false,
  })
}

async function runDB() {
  console.log(`runDB:${num}`); num++;

  let doc:any = []
  try {
    const N_test = 100
    let dataList:Array<any> = []
    const rr = () => {return Math.floor(Math.random()*1000)}
    for(let i=0; i<N_test; i++) {
        const num = rr()%4+1
        const tags:Array<any> = []
        for(let n=0; n<num; n++) {
            const kind = rr()%3
            if(kind==0) {
                tags.push({
                    name: [...Array(rr()%10+1).keys()].map(i => {return String.fromCharCode(rr()%26+97)}).join(''),
                    value: [...Array(rr()%10+1).keys()].map(i => {return String.fromCharCode(rr()%26+97)}).join(''),
                    tagType:'string',
                })
            }
            else if(kind==1) {
                tags.push({
                    name: 'INT'+[...Array(rr()%10+1).keys()].map(i => {return String.fromCharCode(rr()%26+97)}).join(''),
                    value: rr(),
                    tagType:'integer',
                })
            }
            else if(kind==2) {
                tags.push({
                    name: 'DATE'+[...Array(rr()%10+1).keys()].map(i => {return String.fromCharCode(rr()%26+97)}).join(''),
                    value: (new Date(`${2000+rr()%25}-${rr()%12+1}-${rr()%30+1}`)).getTime(),
                    tagType:'date',
                })
            }
        }
        dataList.push({id:`data-${i}`,name:`data-${i}`,tags})
    }
    //console.log('dataList', dataList)




    const response = await db.bulkDocs(dataList)
    console.log('Document added:', response.length);

    // データの取得
    let rawDocs = await db.find({
      selector: {
        tags: {
            $elemMatch: {
                tagType: {
                  $eq: 'date',
                },
                value: {
                    $gt: (new Date()).getTime(),
                }
            }
        }
      }
    });
    doc = rawDocs.docs
    console.log('Retrieved document:', doc.length);
    console.log('document:', doc);

  } catch(err) {
    console.error('Error:', err);
  } finally {
    // データベースのクローズ
    if (db) {
      db.close();
      console.log('PouchDB file database closed.');
    }
  }

  return doc
}











const createWindow = () => {
  const path_preload = path.resolve(__dirname, "..", "dist", "preload.js")
  console.log(path_preload)
  const mainWindow = new BrowserWindow({
    webPreferences: {
      preload: path_preload,
    },
  });

  mainWindow.loadFile("dist/index.html");
  //mainWindow.webContents.openDevTools({ mode: "detach" });
};

app.whenReady().then(() => {
  console.log('main ready')
  ipcMain.handle('createDB', createDB)
  ipcMain.handle('runDB', runDB)
  createWindow();
});

app.once("window-all-closed", () => app.quit());
