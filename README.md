# 🚣 SPM Tracker — Rowing Stroke Rate Tool

🌍 **[English](README.md) · [Español](README.es.md)**

> Simple, precise web app to measure strokes per minute (SPM) in rowing in real time, built for coaches following boats from a launch.

🔗 **Live demo:** https://rodri1923.github.io/rowing-spm-app/

## 📋 Overview
A field-use tool: the coach taps the screen on every stroke, and the app converts the interval between taps into SPM and evaluates how stable the rhythm is. Built to work reliably outdoors, one-handed, on a moving boat, in full sunlight.

## 🚀 Features
- **Training:** real-time SPM from taps, rhythm classification (Measuring → Adjusting → Unstable → Stable) and a 60 s chart
- **Stopwatch:** laps with split and average SPM per lap; the session is saved automatically when finished
- **Handicap pieces:** staggered starts suggested by boat class, category and gender, editable by hand; countdown with beep, vibration and color flash; a single FINISH button with boat assignment afterwards; results and "adjust handicaps and repeat"
- **Uruguayan National Circuit categories (FUR):** U11 to Masters, Lightweight and Novice, with Men / Women / Mixed; each boat is picked step by step (sculling or sweep → boat → gender → category) and shows its event code as in the regatta program (`[1x]-SUB19-M`)
- **Editable handicap table:** reference times per boat class and % per category and gender, from Settings
- **SPM per boat:** while a piece is running, measure in Training and one tap logs the SPM to a boat; it shows in the results
- **History:** saved sessions and pieces on the device, with chart and splits; optional workout name per piece ("3×500 at 28"); select to delete or share several sessions, and delete everything from Settings
- **Sharing:** any day, session or result can be sent via WhatsApp as a message, as an image with the club logo or as an `.xlsx` spreadsheet (Excel / Google Sheets), all generated offline
- High-contrast iOS-style UI (tabs, sheets), light/dark theme, built for use on the water
- Club Instagram link always visible in the top bar
- Fully offline (Service Worker + localStorage, no backend)

## 🧱 Tech Stack
- HTML5 / CSS3
- Vanilla JavaScript
- SVG (charts) · Web Audio (start beeps)
- Canvas (share image) · Web Share API
- Service Worker (offline / caching)
- GitHub Pages (deploy)

## 📁 Project Structure
```
index.html
styles.css
app.js        → boot and tabs
core.js       → shared utilities (storage, sheets, sound, charts)
entreno.js    → SPM counter + stopwatch
pasadas.js    → handicap pieces
handicap.js   → category table and start offsets
historial.js  → session and piece history
compartir.js  → WhatsApp message, image and spreadsheet
ajustes.js    → settings and how-to guide
sw.js         → offline cache
assets/
```

## ▶️ Getting Started
It uses ES modules, so it must be served (double-clicking `index.html` won't work):
```bash
npx http-server .
```

## ⚠️ Limitations
- Accuracy depends on how precisely the user taps
- Not a replacement for physical sensors
- Data lives only on the device where it's used (no cross-device sync)
- Category-based handicaps are approximate: calibrate them with your own pieces
- iPhone has no vibration, and beeps are muted when the silent switch is on

## 👤 Author
**Rodrigo Navone**
[GitHub](https://github.com/Rodri1923) · [LinkedIn](https://www.linkedin.com/in/rodrigonavone)
