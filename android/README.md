# Mi Día — app Android con widget

App nativa que abre https://mi-dia-kawaii.vercel.app en pantalla completa y añade un
**widget** con tu horario de hoy en la pantalla de inicio.

## Instalar el APK

1. Pasa `dist/mi-dia-kawaii.apk` al móvil (Drive, Telegram, cable USB…).
2. Ábrelo desde el móvil. Android pedirá permiso para **instalar apps desconocidas**
   desde esa app (Archivos, Chrome, Drive…): actívalo en *Ajustes → Aplicaciones →
   Acceso especial → Instalar aplicaciones desconocidas*.
3. Pulsa **Instalar**. Si Play Protect avisa, elige *Instalar de todos modos*.
4. Abre **Mi Día** e inicia sesión una vez: así el widget recibe tus datos.

## Añadir el widget

Mantén pulsado un hueco de la pantalla de inicio → **Widgets** → busca **Mi Día** →
arrástralo a la pantalla. Puedes redimensionarlo (mínimo 2×2). Tocarlo abre la app.

El widget se actualiza cada vez que la app guarda cambios, cada 30 min y justo después
de medianoche (cambia solo al día nuevo).

## Recompilar

Requisitos: JDK 17+ y Android SDK (platform 35, build-tools 35).

```bash
cd android
echo "sdk.dir=/ruta/a/android-sdk" > local.properties
./gradlew testReleaseUnitTest assembleRelease
cp app/build/outputs/apk/release/app-release.apk dist/mi-dia-kawaii.apk
```

La firma usa `keystore/midiakawaii.jks` y `keystore/keystore.properties` (no se suben a git).
**Guarda una copia del keystore**: sin él no podrás publicar actualizaciones que se
instalen encima de la versión actual.
