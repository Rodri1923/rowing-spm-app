# 🚣 SPM Tracker — Rowing Stroke Rate Tool

🌍 **[English](README.md) · [Español](README.es.md)**

> Simple, precise web app to measure strokes per minute (SPM) in rowing in real time, built for coaches following boats from a launch.

🔗 **Live demo:** https://rodri1923.github.io/rowing-spm-app/

## 📋 Overview
A field-use tool: the coach taps the screen on every stroke, and the app converts the interval between taps into SPM and evaluates how stable the rhythm is. Built to work reliably outdoors, one-handed, on a moving boat, in full sunlight.

## 🚀 Features
- Real-time SPM calculation from screen taps
- Automatic rhythm classification: Measuring → Adjusting → Unstable → Stable
- Scrollable, real-time history chart with dynamic scale
- High-contrast UI designed for outdoor visibility
- Offline support via Service Worker

## 🧱 Tech Stack
- HTML5 / CSS3
- Vanilla JavaScript
- Canvas API (chart rendering)
- Service Worker (offline / caching)
- GitHub Pages (deploy)

## 📁 Project Structure
```
index.html
styles.css
app.js
sw.js
assets/
  logo.png
```

## ▶️ Getting Started
Open `index.html` in a browser, or serve it locally:
```bash
npx http-server .
```

## ⚠️ Limitations
- Accuracy depends on how precisely the user taps
- Not a replacement for physical sensors
- Optimized for short sessions with immediate feedback, not long-term data logging

## 👤 Author
**Rodrigo Navone**
[GitHub](https://github.com/Rodri1923) · [LinkedIn](https://www.linkedin.com/in/rodrigonavone)
