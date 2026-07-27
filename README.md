# Escena IA: clasificador de escenas naturales

Aplicación web que clasifica fotografías de escenas naturales y urbanas con el
modelo EfficientNetV2B0. La inferencia se ejecuta en el navegador: las imágenes
seleccionadas no se envían a un servidor.

## Funcionalidades

- Clasifica `buildings`, `forest`, `glacier`, `mountain`, `sea` y `street`.
- Muestra la clase principal, el porcentaje de confianza y tres alternativas.
- Acepta imágenes JPG, PNG o WebP de hasta 10 MB.
- Permite seleccionar archivos, arrastrarlos a la página o usar la cámara en
  dispositivos compatibles.

## Modelo

El modelo obtuvo **94.63% de exactitud** en el conjunto de prueba. Para la
aplicación se exportó sin las capas de aumento de datos y se convirtió a un
grafo TensorFlow.js cuantizado en `float16`.

La entrada esperada es una imagen RGB de `224 x 224` píxeles. Los archivos del
modelo necesarios para ejecutar la inferencia están versionados en
`public/model/` y deben conservarse al clonar el repositorio.

## Requisitos

- Node.js 22.13 o superior.
- npm (incluido con Node.js).

## Instalación y ejecución local

1. Clone el repositorio y entre a la carpeta del proyecto:

   ```bash
   git clone https://github.com/Kalf-cmd/Clasificador-de-escenas-naturales-IA.git
   cd Clasificador-de-escenas-naturales-IA
   ```

2. Instale las dependencias:

   ```bash
   npm install
   ```

3. Inicie el servidor de desarrollo:

   ```bash
   npm run dev
   ```

4. Abra la dirección que aparezca en la terminal, normalmente
   `http://localhost:3000`.

## Verificación y producción

```bash
# Revisar el estilo del código
npm run lint

# Crear una compilación de producción
npm run build

# Ejecutar las pruebas automatizadas
npm test

# Ejecutar la aplicación compilada
npm run start
```

`npm test` comprueba el contenido renderizado, la disponibilidad de las seis
clases y una inferencia completa del modelo convertido.

## Seguridad y archivos excluidos

No incluya archivos `.env`, claves, certificados, carpetas de dependencias ni
resultados de compilación. Consulte `.gitignore` antes de añadir nuevos recursos
o credenciales al proyecto.
