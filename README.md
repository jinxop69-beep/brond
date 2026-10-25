# 🎀 Mi Día Kawaii

App rosa y kawaii para organizar el día a día y **tachar** lo que vas haciendo.

## Qué hace
- **Mi día**: el día dividido en cuadraditos (🧺 Casa, 📚 Estudios, 💪 Deporte, 🧁 Vida social y otros); en cada uno añades lo que toca ese día y lo tachas, barra de progreso y corazoncitos al completar. Navega a días anteriores o siguientes.
- **📖 Lectura**: marca cada día que lees y qué has leído; lleva la racha de días seguidos.
- **🥦 Fruta y verdura**: marca los días que comes fruta y/o verdura; en **Mes** ves cuántos días llevas.
- **🌙 Mi ciclo**: diario de la regla. Marca el día 1 y cada día apunta cómo te sientes, cuánta regla, síntomas y una nota. En **Mes** ves el resumen y la próxima regla aproximada. Lectura y ciclo se pueden ocultar.
- **Semana**: resumen de lunes a domingo con avisos de *“¡Tienes médico esta semana!”* y cuántas sesiones de ejercicio tienes (y cuántas llevas hechas).
- **Añadir**: crea tareas con categoría (🎀 General, 💪 Ejercicio, 🩺 Médico, 📚 Estudio, 💼 Trabajo, 🛍️ Compras, 🧺 Casa, 🧴 Autocuidado, 🧁 Planes), hora opcional y repetición:
  - un solo día,
  - todos los días,
  - algunos días de la semana (p. ej. Pilates L · X · V),
  - días elegidos en un calendario (turnos de trabajo, citas sueltas…).
- **Mes**: calendario con el icono y el color de cada categoría en los días que la tienes. Toca una categoría para resaltar sus días y abajo verás la lista de qué días tienes cada cosa.
- Todas las tareas se pueden editar con ✏️.
- **🐶 Mi teckel** (`teckel.html`, botón 🐶 de la cabecera): un tamagotchi con un perro salchicha. Eliges su color y su nombre
  y tienes que darle de comer, jugar a la pelota, pasearle, bañarle, dejarle dormir, recoger sus cacas y curarle si se pone malito.
  Su tiempo corre aunque cierres la app (hasta 48 h) y va creciendo: cachorro → joven → adulto → abuelito (¡cada vez más largo!).
  Se guarda solo en el dispositivo.

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

## 🪄 Escríbelo y lo coloco yo
En **Añadir** puedes escribir en texto normal lo que tienes ("Pilates L, X y V a las 18. Trabajo el 3, 4 y 10…")
y Claude lo convierte en tareas. Antes de guardar se muestra una vista previa para confirmar.

- Funciona con la función de Supabase `supabase/functions/kawaii-parse` (necesita sesión iniciada).
- Secretos en Supabase → Edge Functions → Secrets:
  - `ANTHROPIC_API_KEY`: la clave de la API de Claude (obligatoria).
  - `ANTHROPIC_WORKSPACE_ID` (solo si la clave es de organización y no de un workspace): el ID `wrkspc_…`.
  - `CLAUDE_MODEL` (opcional): por defecto `claude-haiku-5-5` (barato y suficiente); `claude-opus-5-5` si hace falta más precisión.
