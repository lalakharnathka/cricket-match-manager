// ==========================
// GLOBAL
// ==========================
let content = document.getElementById("content");

// ==========================
// INIT
// ==========================
openDB().then(() => {
  renderPlayerList();
});

// ==========================
// PLAYER MANAGEMENT
// ==========================
document.getElementById("addPlayerBtn").onclick = () => {
  showAddPlayerForm();
};

function showAddPlayerForm() {
  content.innerHTML = `
    <h2>Add Player</h2>

    <input id="name" placeholder="Player Name" /><br><br>
    <input id="phone" placeholder="WhatsApp Number (91XXXXXXXXXX)" /><br><br>

    <button onclick="savePlayer()">Save</button>
    <button onclick="renderPlayerList()">Cancel</button>
  `;
}

function savePlayer() {
  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();

  if (!name || !phone) {
    alert("Enter name and phone");
    return;
  }

  const tx = db.transaction("players", "readwrite");
  const store = tx.objectStore("players");

  store.add({
    name,
    phone,
    createdAt: new Date()
  });

  tx.oncomplete = () => {
    renderPlayerList();
  };
}

function renderPlayerList(matchId = null) {
  const tx = db.transaction(["players", "invites"], "readonly");
  const playerStore = tx.objectStore("players");
  const inviteStore = tx.objectStore("invites");

  playerStore.getAll().onsuccess = e => {
    const players = e.target.result;

    // Top buttons + player list
    content.innerHTML = `
  <h2>Players</h2>
  <button onclick="renderMatches()">📅 Matches</button>
  <ul id='playersList'></ul>
`;

    const ul = document.getElementById("playersList");
    players.forEach(pl => {
      const li = document.createElement("li");
      li.innerHTML = `
        <strong>${pl.name}</strong>
        <button onclick="editPlayer(${pl.id})">✏️ </button>
        <button onclick="deletePlayer(${pl.id})">🗑️ </button>
      `;
      ul.appendChild(li);
    });

    // Invite section only if matchId is provided
    if (matchId !== null) {
      // Create containers
      content.innerHTML += `
        <div id="recommendedContainer">
          <h3>Recommended Players</h3>
          <ul id="recommendedList"></ul>
        </div>
        <div id="inviteMoreContainer">
          <h3>Invite More Players</h3>
          <ul id="inviteMoreList"></ul>
        </div>
      `;
      const recommendedUl = document.getElementById("recommendedList");
      const inviteMoreUl = document.getElementById("inviteMoreList");

      inviteStore.index("matchId").getAll(matchId).onsuccess = e2 => {
        const invites = e2.target.result;
        const invitedPlayerIds = invites.map(i => i.playerId);
        const playersToInvite = players.filter(pl => !invitedPlayerIds.includes(pl.id));

        // Get historical stats asynchronously
        const statsPromises = playersToInvite.map(pl =>
          new Promise(resolve => {
            getPlayerHistory(pl.id, stats => {
              pl.stats = stats;
              // Compute Yes%
              pl.yesPercent = stats.total > 0 ? (stats.Y / stats.total) * 100 : 0;
              resolve();
            });
          })
        );

        Promise.all(statsPromises).then(() => {
          // Sort by Yes% descending
          playersToInvite.sort((a, b) => b.yesPercent - a.yesPercent);

          // Recommended players: Yes% ≥ 70 OR new players (total=0)
          const recommended = playersToInvite.filter(pl => pl.yesPercent >= 70 || pl.stats.total === 0);
          const regular = playersToInvite.filter(pl => !recommended.includes(pl));

          // Render recommended
          recommended.forEach(pl => {
            const yesPercent = Math.round(pl.yesPercent);
            const li = document.createElement("li");
            li.setAttribute("style", "border:2px solid green; padding:4px; border-radius:4px; margin-bottom:4px;");
            li.innerHTML = `
              <strong>${pl.name}</strong>
              (✅ ${pl.stats.Y} | ❌ ${pl.stats.N} | ⏳ ${pl.stats.A} | Yes%: ${yesPercent}%)
              <button onclick="invitePlayer(${matchId}, ${pl.id})">Invite</button>
            `;
            recommendedUl.appendChild(li);
          });

          // Render regular
          regular.forEach(pl => {
            const yesPercent = Math.round(pl.yesPercent);
            const li = document.createElement("li");
            li.setAttribute("style", "margin-bottom:4px;");
            li.innerHTML = `
              <strong>${pl.name}</strong>
              (✅ ${pl.stats.Y} | ❌ ${pl.stats.N} | ⏳ ${pl.stats.A} | Yes%: ${yesPercent}%)
              <button onclick="invitePlayer(${matchId}, ${pl.id})">Invite</button>
            `;
            inviteMoreUl.appendChild(li);
          });
        });
      };
    }
  };
}





// ==========================
// MATCH MANAGEMENT
// ==========================
document.getElementById("createMatchBtn").onclick = () => {
  showCreateMatchForm();
};

function showCreateMatchForm() {
  content.innerHTML = `
  <h2>Create Match</h2>

  <input id="date" type="date"><br><br>

  <label>From:</label><br>
  <input id="startTime" type="time"><br><br>

  <label>To:</label><br>
  <input id="endTime" type="time"><br><br>

  <input id="location" placeholder="Location"><br><br>

  <button onclick="saveMatch()">Save Match</button>
  <button onclick="renderPlayerList()">Cancel</button>
`;

}

function saveMatch() {
  const date = document.getElementById("date").value;
  const startTime = document.getElementById("startTime").value;
  const endTime = document.getElementById("endTime").value;
  const location = document.getElementById("location").value;

  if (!date || !startTime || !endTime || !location) {
    alert("All fields required");
    return;
  }

  const tx = db.transaction("matches", "readwrite");
  const store = tx.objectStore("matches");

  store.add({
    date,
    startTime,
    endTime,
    location
  });

  tx.oncomplete = () => {
    renderMatches();
  };
}


function renderMatches() {
  const tx = db.transaction("matches", "readonly");
  const store = tx.objectStore("matches");

  store.getAll().onsuccess = e => {
    const matches = e.target.result;

    content.innerHTML = `
      <h2>Matches</h2>

      <button onclick="renderPlayerList()">← Back to Players</button>
      <br><br>

      <ul>
        ${matches.map(m => `
          <li>
            <strong>${m.date}</strong><br>
            ⏰ ${m.startTime} – ${m.endTime}<br>
            📍 ${m.location}<br>

            <button onclick="openMatch(${m.id})">Open</button>
            <button onclick="editMatch(${m.id})">✏️ Edit</button>
            <button onclick="deleteMatch(${m.id})">❌ Delete</button>
          </li>
        `).join("")}
      </ul>
    `;
  };
}


function openMatch(matchId) {
  const tx = db.transaction(["invites", "players", "matches"], "readonly");
  const inviteStore = tx.objectStore("invites");
  const playerStore = tx.objectStore("players");
  const matchStore = tx.objectStore("matches");

  // Get match info
  matchStore.get(matchId).onsuccess = (eMatch) => {
    const m = eMatch.target.result;

    // Get invites for this match
    inviteStore.index("matchId").getAll(matchId).onsuccess = (eInv) => {
      const invites = eInv.target.result;

      // Get all players
      playerStore.getAll().onsuccess = (ePlayers) => {
        const players = ePlayers.target.result;

        const invitedPlayerIds = invites.map((i) => i.playerId);

        const counts = { Y: 0, N: 0, A: 0 };
        invites.forEach((i) => {
          counts[i.status] = (counts[i.status] || 0) + 1;
        });

        // Prepare WhatsApp-to-All link (message only; user selects recipients)
        const invitedNames = invites
          .map((i) => {
            const pl = players.find((p) => p.id === i.playerId);
            return pl ? pl.name : "";
          })
          .filter(Boolean)
          .join(", ");

        const waAllMessage = encodeURIComponent(
          `🏏 Cricket Match Alert!\nPlayers invited: ${invitedNames}\nWe are playing on ${m.date} from ${m.startTime} to ${m.endTime} at ${m.location}.\nAre you in? Reply Y/N.`
        );

        const waAllLink = `https://wa.me/?text=${waAllMessage}`;

        // Render base match view + placeholders for recommended & invite more
        content.innerHTML = `
          <h2>Match</h2>

          <p>
            📅 ${m.date} ⏰ ${m.startTime} – ${m.endTime} <br>
            📍 ${m.location}
          </p>

          <p>
            ✅ Yes: ${counts.Y || 0} |
            ❌ No: ${counts.N || 0} |
            ⏳ Awaiting: ${counts.A || 0}
          </p>

          <!-- WhatsApp to all invited players -->
          <a href="${waAllLink}" target="_blank"
            style="display:inline-block;background-color:#25D366;color:white;padding:6px 10px;margin-bottom:15px;border-radius:4px;text-decoration:none;font-weight:bold;">
            📩 Send WhatsApp to All
          </a>

          <h3>Invited Players</h3>
          <ul>
            ${invites
              .map((i) => {
                const pl = players.find((p) => p.id === i.playerId);
                if (!pl) return "";

                const statusColor =
                  i.status === "Y" ? "green" : i.status === "N" ? "red" : "orange";

                const waMessage = encodeURIComponent(
                  `Hi ${pl.name}! 🏏\nWe are playing on ${m.date} from ${m.startTime} to ${m.endTime} at ${m.location}.\nAre you in? Reply Y/N.`
                );

                const yBtnColor = i.status === "Y" ? "green" : "#eee";
                const nBtnColor = i.status === "N" ? "red" : "#eee";
                const aBtnColor = i.status === "A" ? "orange" : "#eee";

                return `
                  <li style="margin-bottom:6px;">
                    <strong>${pl.name}</strong>
                    <span style="color:${statusColor}; font-weight:bold;">(${i.status})</span>
                    <br>
                    <button onclick="updateStatus(${i.id}, 'Y')"
                      style="background-color:${yBtnColor};color:${
                  i.status === "Y" ? "white" : "black"
                };padding:4px 8px;margin:2px;border:none;border-radius:4px">
                      Y
                    </button>
                    <button onclick="updateStatus(${i.id}, 'N')"
                      style="background-color:${nBtnColor};color:${
                  i.status === "N" ? "white" : "black"
                };padding:4px 8px;margin:2px;border:none;border-radius:4px">
                      N
                    </button>
                    <button onclick="updateStatus(${i.id}, 'A')"
                      style="background-color:${aBtnColor};color:${
                  i.status === "A" ? "white" : "black"
                };padding:4px 8px;margin:2px;border:none;border-radius:4px">
                      A
                    </button>
                    <a href="https://wa.me/${pl.phone}?text=${waMessage}" target="_blank"
                      style="margin-left:6px;">📩 WhatsApp</a>
                    <button onclick="removePlayerFromMatch(${i.id})"
                      style="background-color:#ccc;color:black;padding:4px 8px;margin-left:6px;border:none;border-radius:4px">
                      ❌ Remove
                    </button>
                  </li>
                `;
              })
              .join("")}
          </ul>

          <h3>Recommended Players</h3>
          <ul id="recommendedList"></ul>

          <h3>Invite More Players</h3>
          <ul id="inviteMoreList"></ul>

          <button onclick="renderMatches()">← Back to Matches</button>
        `;

        // Now populate recommended + invite more with history stats
        const recommendedUl = document.getElementById("recommendedList");
        const inviteMoreUl = document.getElementById("inviteMoreList");

        const playersToInvite = players.filter((pl) => !invitedPlayerIds.includes(pl.id));

        if (playersToInvite.length === 0) {
          const li1 = document.createElement("li");
          li1.textContent = "No players left to invite.";
          recommendedUl.appendChild(li1);
          return;
        }

        const statsPromises = playersToInvite.map(
          (pl) =>
            new Promise((resolve) => {
              getPlayerHistory(pl.id, (stats) => {
                pl.stats = stats;
                pl.yesPercent = stats.total > 0 ? (stats.Y / stats.total) * 100 : 0;
                resolve();
              });
            })
        );

        Promise.all(statsPromises).then(() => {
          // Sort by Yes% descending
          playersToInvite.sort((a, b) => (b.yesPercent || 0) - (a.yesPercent || 0));

          // Recommended: Yes% >= 70 OR new players (total=0)
          const recommended = playersToInvite.filter(
            (pl) => pl.yesPercent >= 70 || (pl.stats && pl.stats.total === 0)
          );
          const regular = playersToInvite.filter((pl) => !recommended.includes(pl));

          const renderRow = (pl, isRecommended) => {
            const yesPercent = Math.round(pl.yesPercent || 0);
            const li = document.createElement("li");
            li.style.marginBottom = "6px";
            if (isRecommended) {
              li.style.border = "2px solid green";
              li.style.padding = "6px";
              li.style.borderRadius = "6px";
            }

            const s = pl.stats || { Y: 0, N: 0, A: 0, total: 0 };

            li.innerHTML = `
              <strong>${pl.name}</strong>
              (✅ ${s.Y} | ❌ ${s.N} | ⏳ ${s.A} | Yes%: ${yesPercent}%)
              <button onclick="invitePlayer(${matchId}, ${pl.id})">Invite</button>
            `;
            return li;
          };

          recommendedUl.innerHTML = "";
          inviteMoreUl.innerHTML = "";

          if (recommended.length === 0) {
            const li = document.createElement("li");
            li.textContent = "No strong recommendations yet — invite from the list below.";
            recommendedUl.appendChild(li);
          } else {
            recommended.forEach((pl) => recommendedUl.appendChild(renderRow(pl, true)));
          }

          regular.forEach((pl) => inviteMoreUl.appendChild(renderRow(pl, false)));
        });
      };
    };
  };
}

function invitePlayer(matchId, playerId) {
  const tx = db.transaction("invites", "readwrite");
  const store = tx.objectStore("invites");

  store.add({
    matchId,
    playerId,
    status: "A",
    invitedAt: new Date()
  });

  tx.oncomplete = () => openMatch(matchId);
}

function updateStatus(inviteId, status) {
  const tx = db.transaction("invites", "readwrite");
  const store = tx.objectStore("invites");

  store.get(inviteId).onsuccess = e => {
    const invite = e.target.result;
    invite.status = status;
    store.put(invite);

    tx.oncomplete = () => {
      // Refresh the same match view
      openMatch(invite.matchId);
    };
  };
}


function deletePlayer(playerId) {
  if (!confirm("Delete this player and all their invites?")) return;

  const tx = db.transaction(["players", "invites"], "readwrite");

  // Delete player
  tx.objectStore("players").delete(playerId);

  // Delete related invites
  const inviteStore = tx.objectStore("invites");
  inviteStore.index("playerId").getAll(playerId).onsuccess = e => {
    e.target.result.forEach(invite => {
      inviteStore.delete(invite.id);
    });
  };

  tx.oncomplete = () => {
    renderPlayerList();
  };
}
function deleteMatch(matchId) {
  if (!confirm("Delete this match and all invites?")) return;

  const tx = db.transaction(["matches", "invites"], "readwrite");

  // Delete match
  tx.objectStore("matches").delete(matchId);

  // Delete related invites
  const inviteStore = tx.objectStore("invites");
  inviteStore.index("matchId").getAll(matchId).onsuccess = e => {
    e.target.result.forEach(invite => {
      inviteStore.delete(invite.id);
    });
  };

  tx.oncomplete = () => {
    renderMatches();
  };
}
function editMatch(matchId) {
  const tx = db.transaction("matches", "readonly");
  const store = tx.objectStore("matches");

  store.get(matchId).onsuccess = e => {
    const match = e.target.result;

    content.innerHTML = `
      <h2>Edit Match</h2>

      <input id="date" type="date" value="${match.date}"><br><br>

      <label>From:</label><br>
      <input id="startTime" type="time" value="${match.startTime}"><br><br>

      <label>To:</label><br>
      <input id="endTime" type="time" value="${match.endTime}"><br><br>

      <input id="location" value="${match.location}"><br><br>

      <button onclick="saveMatchEdit(${matchId})">💾 Save</button>
      <button onclick="renderMatches()">Cancel</button>
    `;
  };
}

function saveMatchEdit(matchId) {
  const date = document.getElementById("date").value;
  const startTime = document.getElementById("startTime").value;
  const endTime = document.getElementById("endTime").value;
  const location = document.getElementById("location").value;

  if (!date || !startTime || !endTime || !location) {
    alert("All fields required");
    return;
  }

  const tx = db.transaction("matches", "readwrite");
  const store = tx.objectStore("matches");

  store.put({
    id: matchId,
    date,
    startTime,
    endTime,
    location
  });

  tx.oncomplete = () => {
    renderMatches();
  };
}
function sendWhatsAppAll(matchId) {
  const tx = db.transaction(["invites", "players", "matches"], "readonly");
  const inviteStore = tx.objectStore("invites");
  const playerStore = tx.objectStore("players");

  inviteStore.index("matchId").getAll(matchId).onsuccess = e => {
    const invites = e.target.result;

    if(invites.length === 0){
      alert("No players invited yet!");
      return;
    }

    // Get all invited players
    const playerIds = invites.map(i => i.playerId);

    playerStore.getAll().onsuccess = ePlayers => {
      const players = ePlayers.target.result.filter(pl => playerIds.includes(pl.id));

      // Get match info
      const txMatch = db.transaction("matches", "readonly");
      txMatch.objectStore("matches").get(matchId).onsuccess = em => {
        const m = em.target.result;

        // Pre-filled message
        const names = players.map(pl => pl.name).join(', ');
        const message = encodeURIComponent(
          `🏏 Cricket Match Alert!\nPlayers invited: ${names}\nWe are playing on ${m.date} from ${m.startTime} to ${m.endTime} at ${m.location}.\nAre you in? Reply Y/N.`
        );

        // Open WhatsApp — now just pre-filled message, you manually select recipients
        window.open(`https://wa.me/?text=${message}`, "_blank");
      };
    };
  };
}

function removePlayerFromMatch(inviteId) {
  if (!confirm("Remove this player from the match?")) return;

  const tx = db.transaction("invites", "readwrite");
  const store = tx.objectStore("invites");

  store.get(inviteId).onsuccess = e => {
    const invite = e.target.result;
    const matchId = invite.matchId;

    store.delete(inviteId);

    tx.oncomplete = () => {
      // Refresh the match screen
      openMatch(matchId);
    };
  };
}
function getPlayerHistory(playerId, callback) {
  const tx = db.transaction("invites", "readonly");
  const store = tx.objectStore("invites");

  const index = store.index("playerId"); // Assuming you have an index on playerId
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

function editPlayer(playerId) {
  const tx = db.transaction("players", "readonly");
  const store = tx.objectStore("players");

  store.get(playerId).onsuccess = (e) => {
    const pl = e.target.result;
    if (!pl) {
      alert("Player not found");
      return;
    }

    content.innerHTML = `
      <h2>Edit Player</h2>

      <input id="editName" placeholder="Player Name" value="${pl.name || ""}" /><br><br>
      <input id="editPhone" placeholder="WhatsApp Number (91XXXXXXXXXX)" value="${pl.phone || ""}" /><br><br>

      <button onclick="savePlayerEdit(${pl.id})">💾 Save</button>
      <button onclick="renderPlayerList()">Cancel</button>
    `;
  };
}

function savePlayerEdit(playerId) {
  const name = document.getElementById("editName").value.trim();
  const phone = document.getElementById("editPhone").value.trim();

  if (!name || !phone) {
    alert("Enter name and phone");
    return;
  }

  const tx = db.transaction("players", "readwrite");
  const store = tx.objectStore("players");

  // keep existing createdAt if present
  store.get(playerId).onsuccess = (e) => {
    const existing = e.target.result;

    store.put({
      id: playerId,
      name,
      phone,
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date()
    });

    tx.oncomplete = () => {
      renderPlayerList();
    };
  };
}
