const DB_NAME = "cricketDB";
const DB_VERSION = 3;

let db;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject("DB error");

    request.onupgradeneeded = (event) => {
      db = event.target.result;

      if (!db.objectStoreNames.contains("players")) {
        db.createObjectStore("players", {
          keyPath: "id",
          autoIncrement: true
        });
      }

      if (!db.objectStoreNames.contains("matches")) {
        db.createObjectStore("matches", {
          keyPath: "id",
          autoIncrement: true
        });
      }

      if (!db.objectStoreNames.contains("invites")) {
        const inviteStore = db.createObjectStore("invites", {
          keyPath: "id",
          autoIncrement: true
        });
        inviteStore.createIndex("matchId", "matchId", { unique: false });
        inviteStore.createIndex("playerId", "playerId", { unique: false });
      }
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
  });
}
function getPlayerHistory(playerId, callback) {
  const tx = db.transaction("invites", "readonly");
  const store = tx.objectStore("invites");
  const index = store.index("playerId");
  const request = index.getAll(IDBKeyRange.only(playerId));

  request.onsuccess = e => {
    const invites = e.target.result;
    const stats = { Y: 0, N: 0, A: 0, total: invites.length };
    invites.forEach(i => {
      if (i.status === "Y") stats.Y++;
      else if (i.status === "N") stats.N++;
      else if (i.status === "A") stats.A++;
    });
    callback(stats);
  };
}