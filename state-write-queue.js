/**
 * Serialize IndexedDB state snapshots so older asynchronous writes cannot
 * finish after and overwrite a newer application state.
 */
export function createSerializedStateWriter(write){
  if(typeof write!=='function')throw new TypeError('write must be a function');
  let pending=Promise.resolve();
  return function writeSnapshot(value){
    const snapshot=JSON.parse(JSON.stringify(value));
    const current=pending.catch(()=>undefined).then(()=>write(snapshot));
    pending=current;
    return current;
  };
}
