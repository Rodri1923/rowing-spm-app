# 🚣 SPM Tracker — Herramienta de Ritmo de Remada

🌍 **[English](README.md) · [Español](README.es.md)**

> Aplicación web simple y precisa para medir SPM (remadas por minuto) en remo en tiempo real, pensada para entrenadores que siguen botes desde una lancha.

🔗 **Demo en vivo:** https://rodri1923.github.io/rowing-spm-app/

## 📋 Descripción
Herramienta de uso en campo: el entrenador tapea la pantalla en cada remada y la app convierte el intervalo entre taps en SPM, evaluando además la estabilidad del ritmo. Pensada para funcionar de forma confiable al aire libre, con una sola mano, en una lancha en movimiento y con alta luminosidad.

## 🚀 Funcionalidades
- Cálculo de SPM en tiempo real a partir de taps en pantalla
- Clasificación automática del ritmo: Midiendo → Ajustando → Inestable → Estable
- Gráfico de historial en tiempo real, scrollable y con escala dinámica
- UI de alto contraste pensada para visibilidad al aire libre
- Funcionamiento offline mediante Service Worker

## 🧱 Stack técnico
- HTML5 / CSS3
- JavaScript (Vanilla)
- Canvas API (gráfico)
- Service Worker (offline / cache)
- GitHub Pages (deploy)

## 📁 Estructura del proyecto
```
index.html
styles.css
app.js
sw.js
assets/
  logo.png
```

## ▶️ Cómo ejecutar
Abrí `index.html` en el navegador, o servilo localmente:
```bash
npx http-server .
```

## ⚠️ Limitaciones
- La precisión depende de qué tan exacto tapea el usuario
- No reemplaza sensores físicos
- Optimizada para sesiones cortas con feedback inmediato, no para registro de datos de largo plazo

## 👤 Autor
**Rodrigo Navone**
[GitHub](https://github.com/Rodri1923) · [LinkedIn](https://www.linkedin.com/in/rodrigonavone)
