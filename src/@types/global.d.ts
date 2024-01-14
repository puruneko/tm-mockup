declare global {
  interface Window {
    electron: IElectronContent;
}
}
export interface IElectronContent {
  api: {
    createDB: () => any,
    runDB: () => any,
  }
  requires: {
    electron: any,
  },
  sample: {
    sample: boolean
  }
}