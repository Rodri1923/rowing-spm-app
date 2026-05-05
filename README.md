# 🚣‍♂️ SPM Tracker – Rowing Stroke Rate Tool

Aplicación web simple y precisa para medir **SPM (strokes per minute)** en remo en tiempo real, diseñada específicamente para entrenadores que siguen botes desde una lancha.

---

## 🎯 Propósito

Esta herramienta permite calcular el ritmo de remada de un remero mediante taps en pantalla.

Está optimizada para condiciones reales de uso:

* 📱 Uso con una sola mano
* 🚤 Movimiento constante (lancha)
* ☀️ Alta luminosidad (exterior)
* ⚡ Feedback inmediato y claro

---

## ⚙️ Cómo funciona

1. Tocá la pantalla en cada remada del remero
2. La app calcula el tiempo entre taps
3. Convierte ese intervalo en SPM
4. Evalúa la estabilidad del ritmo

---

## 📊 Estados del sistema

La app clasifica automáticamente el ritmo:

* **Midiendo** → pocos datos
* **Ajustando** → todavía no es estable
* **Inestable** → variaciones grandes
* **Estable** → ritmo consistente dentro de tolerancia

Cada estado se refleja con color y feedback visual.

---

## 📈 Historial

* Gráfico horizontal en tiempo real
* Scrollable
* Colores según estado
* Escala dinámica (mínimo ↔ máximo)

Permite ver tendencia sin sobrecargar la pantalla.

---

## 🎨 UX / Diseño

* Círculo central como zona de interacción
* Número SPM grande y legible
* Logo del club en estado idle
* Animaciones:

  * Pulso en espera
  * Onda expansiva en cada tap
* Alto contraste para uso al aire libre

---

## 🧱 Stack técnico

* HTML5
* CSS3
* JavaScript (Vanilla)
* Canvas API (gráfico)
* Service Worker (modo offline / cache)
* Deploy: GitHub Pages

---

## 📁 Estructura del proyecto

```id="proj-structure"
/
├── index.html
├── styles.css
├── app.js
├── sw.js
└── assets/
    └── logo.png
```

---

## 🌐 Deploy

La app está desplegada en **GitHub Pages**.

⚠️ Nota sobre cache:

* Se utiliza Service Worker
* Si los cambios no se reflejan:

  * Hard refresh (Ctrl + Shift + R)
  * O cambiar `CACHE_NAME` en `sw.js`

---

## 🚀 Uso recomendado

* Posicionarse con buena visibilidad del bote
* Tapear cada remada de un mismo remero
* Mantener ritmo constante de taps
* Leer el estado (estable/inestable) para validar medición

---

## ⚠️ Limitaciones

* Depende de la precisión del usuario al tapear
* No reemplaza sensores físicos
* Optimizada para sesiones cortas y feedback inmediato

---

## 🔧 Desarrollo

Reglas del proyecto:

* Mantener simplicidad
* No agregar features innecesarias
* Priorizar claridad y velocidad de uso
* No romper lógica de estados

---

## 📌 Roadmap (opcional)

* Mejoras en feedback visual
* Ajustes finos de estabilidad
* Optimización del gráfico
* Ajustes UX en condiciones extremas

---

## 👤 Autor

Desarrollado como herramienta práctica para entrenamiento de remo en campo real.

---
