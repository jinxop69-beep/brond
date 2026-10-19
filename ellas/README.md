# 🌸 Ellas · Cada día

App rosa que cada día publica una lectura nueva sobre mujeres: un **poema** de una autora clásica,
un **artículo** sobre una mujer que cambió la historia o una pequeña **reflexión**.

## Qué tiene
- **Hoy**: la lectura del día, una frase de una mujer célebre y la **Mujer del día**, que se carga en directo de Wikipedia (con su foto).
  Puedes volver a días anteriores, guardarla en favoritas, compartirla, escucharla en voz alta y cambiar el tamaño de la letra.
- **Archivo**: todo lo publicado hasta hoy, con filtros (poemas, mujeres, reflexiones).
- **Favoritas**: lo que has marcado con 💗.
- **Mis poemas**: guarda tus poemas favoritos (por ejemplo, de Gloria Fuertes); te sale uno distinto cada día en «Hoy».
- Racha de días leyendo, modo noche rosa y funciona sin conexión (PWA instalable).

## Contenido
- Poemas de dominio público de Sor Juana Inés de la Cruz, Rosalía de Castro, Alfonsina Storni, Delmira Agustini,
  Carolina Coronado y Gertrudis Gómez de Avellaneda (textos de es.wikisource.org) → `poemas.js`.
- Artículos, reflexiones y frases → `articulos.js`. Para añadir más, copia una entrada y cambia el `id`.

Todo se guarda solo en el dispositivo (`localStorage`).
