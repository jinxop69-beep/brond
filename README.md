# 🎀 Mi Día Kawaii

App rosa y kawaii para organizar el día a día y **tachar** lo que vas haciendo.

## Qué hace
- **Mi día**: lista de tareas del día con check para tacharlas, barra de progreso y corazoncitos al completar. Navega a días anteriores o siguientes.
- **Semana**: resumen de lunes a domingo con avisos de *“¡Tienes médico esta semana!”* y cuántas sesiones de ejercicio tienes (y cuántas llevas hechas).
- **Añadir**: crea tareas con categoría (🎀 General, 💪 Ejercicio, 🩺 Médico, 📚 Estudio, 💼 Trabajo, 🛍️ Compras, 🧺 Casa, 🧴 Autocuidado, 🧁 Planes), hora opcional y repetición:
  - un solo día,
  - todos los días,
  - algunos días de la semana (p. ej. Pilates L · X · V),
  - días elegidos en un calendario (turnos de trabajo, citas sueltas…).
- **Mes**: calendario con el icono y el color de cada categoría en los días que la tienes. Toca una categoría para resaltar sus días y abajo verás la lista de qué días tienes cada cosa.
- Todas las tareas se pueden editar con ✏️.

Los datos se guardan primero en el dispositivo (`localStorage`) y, si inicias sesión con el botón ☁️,
se copian a Supabase (tabla `kawaii_state`, una fila por usuaria y protegida con RLS). Así no se pierden
si se borra el navegador y se ven igual en el móvil y en el ordenador.

## Pantallas
- Móvil: una columna con pestañas.
- Móvil plegable abierto o tablet (≥ 600 px): dos columnas (Mi día + Semana/Añadir).
- Escritorio (≥ 1100 px): tres columnas, todo a la vista.

## Cómo usarla
Abre `index.html` en el navegador (móvil u ordenador). No necesita instalar nada.
Para tenerla en el móvil, publícala con GitHub Pages y usa “Añadir a pantalla de inicio”.
