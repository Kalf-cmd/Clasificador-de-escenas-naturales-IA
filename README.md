# Escena IA

Aplicación web para clasificar fotografías de escenas naturales y urbanas con
el modelo de mejor rendimiento del proyecto: **EfficientNetV2B0**.

## Funciones

- Reconoce edificios, bosques, glaciares, montañas, mar y calles.
- Muestra la categoría principal, su confianza y tres alternativas.
- Acepta imágenes JPG, PNG o WebP de hasta 10 MB.
- Ejecuta el modelo dentro del navegador; las fotografías no se envían a un
  servidor.
- Admite selección desde el dispositivo, arrastre de archivos y cámara móvil.

## Modelo

El modelo obtuvo **94.63% de accuracy** en el conjunto de prueba. Para la
aplicación se exportó sin las capas de aumento usadas durante el entrenamiento
y se convirtió a un grafo TensorFlow.js cuantizado en `float16`.

La entrada esperada es RGB de `224 × 224` píxeles y el orden de clases es:

1. `buildings`
2. `forest`
3. `glacier`
4. `mountain`
5. `sea`
6. `street`

## Desarrollo

Requiere Node.js 22.13 o superior.

```bash
npm install
npm run dev
npm run lint
npm run build
npm test
```

`npm test` valida el contenido renderizado, la disponibilidad de las seis
clases y una inferencia completa del modelo convertido.
