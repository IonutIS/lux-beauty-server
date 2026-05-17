import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Servește fișierele statice din folderul "public"
app.use(express.static(path.join(__dirname, "public")));

// ---------- Stocare programări în fișier JSON ----------
const BOOKINGS_FILE = path.join(__dirname, "bookings.json");

function loadBookings() {
    if (!fs.existsSync(BOOKINGS_FILE)) return [];
    const data = fs.readFileSync(BOOKINGS_FILE, "utf8");
    try {
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

function saveBookings(bookings) {
    fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2));
}

// ---------- Rute API pentru programări ----------
// Obține toate programările
app.get("/api/bookings", (req, res) => {
    const bookings = loadBookings();
    res.json(bookings);
});

// Adaugă o programare nouă
app.post("/api/bookings/add", (req, res) => {
    const { booking } = req.body;
    if (!booking || !booking.id || !booking.date || !booking.time) {
        return res.status(400).json({ error: "Date incomplete" });
    }

    const bookings = loadBookings();
    // Verifică dacă slotul este deja ocupat
    const alreadyBooked = bookings.some(
        (b) => b.date === booking.date && b.time === booking.time
    );
    if (alreadyBooked) {
        return res.status(409).json({ error: "Slot already taken" });
    }

    bookings.push(booking);
    saveBookings(bookings);
    res.json({ success: true, booking });
});

// Șterge o programare (după id)
app.post("/api/bookings/delete", (req, res) => {
    const { bookingId } = req.body;
    if (!bookingId) {
        return res.status(400).json({ error: "Missing bookingId" });
    }

    let bookings = loadBookings();
    const newBookings = bookings.filter((b) => b.id !== bookingId);
    if (newBookings.length === bookings.length) {
        return res.status(404).json({ error: "Booking not found" });
    }
    saveBookings(newBookings);
    res.json({ success: true });
});

// ---------- Ruta existentă pentru Telegram ----------
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

app.post("/api/send-message", async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ ok: false, error: "Textul mesajului lipsește." });
        }
        if (!BOT_TOKEN || !CHAT_ID) {
            return res.status(500).json({
                ok: false,
                error: "Variabilele de mediu BOT_TOKEN și CHAT_ID sunt obligatorii."
            });
        }
        const tgResp = await fetch(
            `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: CHAT_ID,
                    text: text,
                    parse_mode: "HTML"
                })
            }
        );
        const data = await tgResp.json();
        if (!data.ok) {
            return res.status(500).json({ ok: false, telegram: data });
        }
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ ok: false, error: String(e) });
    }
});

// ---------- Fallback pentru SPA ----------
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server pornit pe portul ${PORT}`));
