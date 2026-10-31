# 🚣 SPM Tracker — Herramienta de Ritmo de Remada

🌍 **[English](README.md) · [Español](README.es.md)**

> Aplicación web simple y precisa para medir SPM (remadas por minuto) en remo en tiempo real, pensada para entrenadores que siguen botes desde una lancha.

🔗 **Demo en vivo:** https://rodri1923.github.io/rowing-spm-app/

## 📋 Descripción
Herramienta de uso en campo: el entrenador tapea la pantalla en cada remada y la app convierte el intervalo entre taps en SPM, evaluando además la estabilidad del ritmo. Pensada para funcionar de forma confiable al aire libre, con una sola mano, en una lancha en movimiento y con alta luminosidad.

## 🚀 Funcionalidades
- **Entreno:** SPM en tiempo real a partir de taps, con clasificación del ritmo (Midiendo → Ajustando → Inestable → Estable) y gráfico de los últimos 60 s
- **Cronómetro:** vueltas con parcial y SPM promedio por vuelta; el entreno se guarda solo al terminar
- **Pasadas con handicap:** salida escalonada sugerida por tipo de bote, categoría y rama, editable a mano; cuenta regresiva con pitido, vibración y destello de color; botón único de LLEGADA y asignación posterior de cada bote; resultados y "ajustar ventajas y repetir"
- **Categorías del Circuito Nacional (FUR):** Sub 11 a Master, Peso Ligero y Novicios, con rama Masculino / Femenino / Mixto; cada bote se elige por pasos (remo corto o largo → bote → rama → categoría) y muestra su código como en el programa de regata (`[1x]-SUB19-M`)
- **Tabla de handicap editable:** tiempos de referencia por bote y % por categoría y rama, desde Ajustes
- **SPM por bote:** con una pasada en curso, se mide en Entreno y un toque le anota el SPM a cada bote; aparece en los resultados
- **Historial:** entrenos y pasadas guardados en el celular, con gráfico y parciales; nombre de trabajo opcional por pasada ("3×500 a 28"); seleccionar para borrar o compartir varias sesiones, y borrar todo desde Ajustes
- **Compartir:** cada día, sesión o resultado se manda por WhatsApp como mensaje, como imagen con el logo del club o como planilla `.xlsx` (Excel / Google Sheets), todo armado sin conexión
- UI de alto contraste estilo iOS (pestañas, hojas), tema claro/oscuro, pensada para usar en el agua
- Link al Instagram del club siempre visible en la barra superior
- Funciona 100% offline (Service Worker + localStorage, sin backend)

## 🧱 Stack técnico
- HTML5 / CSS3
- JavaScript (Vanilla)
- SVG (gráficos) · Web Audio (pitidos de largada)
- Canvas (imagen para compartir) · Web Share API
- Service Worker (offline / cache)
- GitHub Pages (deploy)

## 📁 Estructura del proyecto
```
index.html
styles.css
app.js        → arranque y pestañas
core.js       → utilidades compartidas (guardado, hojas, sonido, gráficos)
entreno.js    → contador de SPM + cronómetro
pasadas.js    → pasadas con handicap
handicap.js   → tabla de categorías y cálculo de ventajas
historial.js  → historial de entrenos y pasadas
compartir.js  → mensaje de WhatsApp, imagen y planilla
ajustes.js    → ajustes y guía de uso
sw.js         → cache offline
assets/
```

## ▶️ Cómo ejecutar
Usa módulos ES, así que hay que servirla (no abre con doble clic en `index.html`):
```bash
npx http-server .
```

## ⚠️ Limitaciones
- La precisión depende de qué tan exacto tapea el usuario
- No reemplaza sensores físicos
- Los datos viven solo en el celular donde se usan (sin sincronización entre dispositivos)
- Las ventajas sugeridas por categoría son aproximadas: conviene calibrarlas con las propias pasadas
- En iPhone no hay vibración, y los pitidos no suenan con el interruptor de silencio activado

## 👤 Autor
**Rodrigo Navone**
[GitHub](https://github.com/Rodri1923) · [LinkedIn](https://www.linkedin.com/in/rodrigonavone)
