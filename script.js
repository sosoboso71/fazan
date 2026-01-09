 /******************************
 *  FAZAN BATTLE — Sorin (themask)
 *  Versiune completă, stabilă
 ******************************/

const socket = new WebSocket("ws://localhost:21213/");

socket.onopen = () => console.log("Conectat la TikFinity WebSocket");

socket.onmessage = (event) => {
    try {
        const json = JSON.parse(event.data);

        if (json.event === "chat") {
            const message = json.data.comment || "";
            const username = json.data.nickname || json.data.uniqueId || "Anonim";

            console.log("CHAT:", username, message);
            onChatMessage(username, message);
        }
    } catch (e) {
        console.log("Eroare JSON:", e);
    }
};

// -----------------------------
// 1. Dicționar + starturi valide
// -----------------------------
let dictionary = [];
let validStarts = [];

function buildValidStarts() {
    const set = new Set();

    dictionary.forEach(word => {
        if (word.length >= 2) {
            const start = word.substring(0, 2).toUpperCase();
            set.add(start);
        }
    });

    validStarts = Array.from(set);
    console.log("Starturi valide generate:", validStarts.length);
}

fetch("https://raw.githubusercontent.com/kamilmielnik/romanian-dictionary/master/loc5.txt")
    .then(res => res.text())
    .then(text => {
        dictionary = text
            .split("\n")
            .map(w => w.trim().toLowerCase())
            .filter(w => w.length > 1);

        console.log("Dicționar încărcat:", dictionary.length, "cuvinte");

        buildValidStarts();
        loadScores();
        checkMidnightReset();
        startRound();
    });

// -----------------------------
// 2. Filtru obscenități
// -----------------------------
const bannedRoots = [
    "piz","pzd","pula","pul","fut","futu","muie","mui",
    "curv","drac","mortii","plm","sugi","suge","sugator",
    "coi","coaie","boule","handic","retard","javra"
];

function isCleanWord(word) {
    word = word.toLowerCase();
    return !bannedRoots.some(root => word.includes(root));
}

// -----------------------------
// 3. Structura jocului
// -----------------------------
const game = {
    letters: null,
    usedWords: [],
    roundActive: false,
    timer: null,
    timeLeft: 60,
    lastValidWord: null,
    lastValidUser: null
};

// -----------------------------
// 4. Timer
// -----------------------------
function startTimer() {
    stopTimer();
    game.timeLeft = 60;
    updateTimerUI(game.timeLeft);

    game.timer = setInterval(() => {
        game.timeLeft--;
        updateTimerUI(game.timeLeft);

        if (game.timeLeft <= 0) {
            stopTimer();
            endRound();
        }
    }, 1000);
}

function stopTimer() {
    if (game.timer) clearInterval(game.timer);
    game.timer = null;
}

// -----------------------------
// 5. Start runda
// -----------------------------
function generateRandomLetters() {
    return validStarts[Math.floor(Math.random() * validStarts.length)];
}

function startRound() {
    game.roundActive = true;
    game.usedWords = [];
    game.lastValidWord = null;
    game.lastValidUser = null;

    game.letters = generateRandomLetters();
    updateLettersUI(game.letters);

    setStatus("Runda nouă! Scrieți cuvinte care încep cu: " + game.letters, true);
    startTimer();
}

// -----------------------------
// 6. Validare cuvânt
// -----------------------------
function validateWord(word) {
    word = word.toLowerCase();

    if (!isCleanWord(word))
        return { valid: false, reason: "Cuvânt interzis." };

    if (!dictionary.includes(word))
        return { valid: false, reason: "Nu există în dicționar." };

    if (!word.startsWith(game.letters.toLowerCase()))
        return { valid: false, reason: "Nu începe cu literele cerute." };

    if (game.usedWords.includes(word))
        return { valid: false, reason: "Cuvânt deja folosit." };

    return { valid: true };
}

// -----------------------------
// 7. Sistem scoruri
// -----------------------------
let leaderboardDay = {};
let leaderboardGlobal = {};

function saveScores() {
    localStorage.setItem("fazanDay", JSON.stringify(leaderboardDay));
    localStorage.setItem("fazanGlobal", JSON.stringify(leaderboardGlobal));
}

function loadScores() {
    leaderboardDay = JSON.parse(localStorage.getItem("fazanDay") || "{}");
    leaderboardGlobal = JSON.parse(localStorage.getItem("fazanGlobal") || "{}");
}

function givePoints(username, points) {
    if (!leaderboardDay[username]) leaderboardDay[username] = 0;
    leaderboardDay[username] += points;

    if (!leaderboardGlobal[username]) leaderboardGlobal[username] = 0;
    leaderboardGlobal[username] += points;

    saveScores();
    updateScoreUI(username);
}

// -----------------------------
// 8. Resetare la ora 00:00
// -----------------------------
function checkMidnightReset() {
    setInterval(() => {
        const now = new Date();
        if (now.getHours() === 0 && now.getMinutes() === 0) {
            leaderboardDay = {};
            saveScores();
            setStatus("Top Day resetat automat!", true);
        }
    }, 60000);
}

// -----------------------------
// 9. Procesare cuvânt
// -----------------------------
function processPlayerWord(username, word) {
    if (!game.roundActive) return;

    const result = validateWord(word);

    if (!result.valid) {
        setStatus(`${username}: ${result.reason}`, true);
        return;
    }

    game.usedWords.push(word);
    game.lastValidWord = word;
    game.lastValidUser = username;

    updateWordUI(word, username);
    setStatus(`${username} a dat un cuvânt valid!`, true);

    givePoints(username, 1);

    const nextStart = word.slice(-2).toUpperCase();
    game.letters = nextStart;
    updateLettersUI(nextStart);

    const canContinue = dictionary.some(w =>
        w.startsWith(nextStart.toLowerCase()) &&
        !game.usedWords.includes(w)
    );

    if (!canContinue) {
        setStatus(`${username} a închis runda cu '${word}'!`, true);
        stopTimer();
        setTimeout(startRound, 3000);
        return;
    }

    startTimer();
}

// -----------------------------
// 10. Final runda
// -----------------------------
function endRound() {
    game.roundActive = false;

    if (!game.lastValidWord) {
        setStatus("Nimeni nu a dat niciun cuvânt. Runda moartă.", true);
        setTimeout(startRound, 3000);
        return;
    }

    setStatus("Timpul a expirat! Runda se reia.", true);
    setTimeout(startRound, 3000);
}

// -----------------------------
// 11. Comenzi chat
// -----------------------------
function handleCommand(username, message) {

    if (message === ".top") {
        const top = Object.entries(leaderboardDay)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        if (top.length === 0) {
            setStatus("TOP ZI: gol.", true);
            return;
        }

        let msg = "TOP ZI:\n";
        top.forEach(([user, score], i) => {
            msg += `${i+1}. ${user} - ${score}p\n`;
        });

        setStatus(msg, true);
        return;
    }

    if (message === ".global") {
        const top = Object.entries(leaderboardGlobal)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        if (top.length === 0) {
            setStatus("TOP GLOBAL: gol.", true);
            return;
        }

        let msg = "TOP GLOBAL:\n";
        top.forEach(([user, score], i) => {
            msg += `${i+1}. ${user} - ${score}p\n`;
        });

        setStatus(msg, true);
        return;
    }

    if (message === ".scor") {
        const d = leaderboardDay[username] || 0;
        const g = leaderboardGlobal[username] || 0;

        setStatus(`${username}: ZI ${d}p | GLOBAL ${g}p`, true);
        return;
    }
}

// -----------------------------
// 12. Chat handler
// -----------------------------
function onChatMessage(username, message) {
    const clean = message.trim();

    if (clean.startsWith(".")) {
        handleCommand(username, clean);
        return;
    }

    if (clean.startsWith("#")) {
        const word = clean.substring(1).trim().toLowerCase();
        processPlayerWord(username, word);
        return;
    }
}

// -----------------------------
// 13. UI Hooks
// -----------------------------
function setStatus(msg) {
    const el = document.getElementById("fazan-status");
    if (el) el.textContent = msg;
}

function updateLettersUI(letters) {
    const el = document.getElementById("fazan-letters");
    if (el) el.textContent = letters;
}

function updateWordUI(word, username) {
    const el = document.getElementById("fazan-word");
    if (el) el.textContent = `${word} (${username})`;
}

function updateTimerUI(seconds) {
    const el = document.getElementById("fazan-timer");
    if (el) el.textContent = seconds;
}

function updateScoreUI(username) {
    const el = document.getElementById("fazan-score");
    if (!el) return;

    const d = leaderboardDay[username] || 0;
    const g = leaderboardGlobal[username] || 0;

    el.textContent = `${username}: ZI ${d}p | GLOBAL ${g}p`;
}