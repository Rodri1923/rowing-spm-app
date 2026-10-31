# 🚣 SPM Tracker — Rowing Stroke Rate Tool

🌍 **[English](README.md) · [Español](README.es.md)**

> Simple, precise web app to measure strokes per minute (SPM) in rowing in real time, built for coaches following boats from a launch.

🔗 **Live demo:** https://rodri1923.github.io/rowing-spm-app/

## 📋 Overview
A field-use tool: the coach taps the screen on every stroke, and the app converts the interval between taps into SPM and evaluates how stable the rhythm is. Built to work reliably outdoors, one-handed, on a moving boat, in full sunlight.

## 🚀 Features
- **Training:** real-time SPM from taps, rhythm classification (Measuring → Adjusting → Unstable → Stable) and a 60 s chart
- **Stopwatch:** laps with split and average SPM per lap; the session is saved automatically when finished
- **Handicap pieces:** staggered starts suggested by boat class and category (Uruguayan federation), editable by hand; countdown with beep, vibration and color flash; a single FINISH button with boat assignment afterwards; results and "adjust handicaps and repeat"
- **History:** saved sessions and pieces on the device, with chart and splits
- High-contrast UI, light/dark theme, built for use on the water
- Fully offline (Service Worker + localStorage, no backend)

## 🧱 Tech Stack
- HTML5 / CSS3
- Vanilla JavaScript
- SVG (charts) · Web Audio (start beeps)
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
