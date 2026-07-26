"use client";

import {
  ChangeEvent,
  DragEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

type TensorLike = {
  data: () => Promise<Float32Array>;
  dispose: () => void;
  expandDims: (axis?: number) => TensorLike;
  toFloat: () => TensorLike;
};

type InferenceOutput =
  | TensorLike
  | TensorLike[]
  | Record<string, TensorLike>;

type InferenceModel = {
  predict: (input: TensorLike) => InferenceOutput;
};

type TfRuntime = {
  browser: {
    fromPixels: (source: HTMLImageElement, channels?: number) => TensorLike;
  };
  image: {
    resizeBilinear: (
      tensor: TensorLike,
      size: [number, number],
      alignCorners?: boolean,
    ) => TensorLike;
  };
  loadGraphModel: (
    url: string,
    options?: { onProgress?: (fraction: number) => void },
  ) => Promise<InferenceModel>;
  ready: () => Promise<void>;
  softmax: (tensor: TensorLike) => TensorLike;
};

declare global {
  interface Window {
    tf?: TfRuntime;
  }
}

type SceneDefinition = {
  key: string;
  label: string;
  description: string;
  icon: string;
  color: string;
};

type Prediction = SceneDefinition & {
  probability: number;
};

const SCENES: SceneDefinition[] = [
  {
    key: "buildings",
    label: "Edificios",
    description: "Arquitectura y construcciones",
    icon: "▦",
    color: "#d85b36",
  },
  {
    key: "forest",
    label: "Bosque",
    description: "Árboles y vegetación densa",
    icon: "♠",
    color: "#2b6b4f",
  },
  {
    key: "glacier",
    label: "Glaciar",
    description: "Hielo, nieve y formaciones glaciares",
    icon: "✦",
    color: "#4f87a5",
  },
  {
    key: "mountain",
    label: "Montaña",
    description: "Relieve montañoso y cumbres",
    icon: "▲",
    color: "#816c55",
  },
  {
    key: "sea",
    label: "Mar",
    description: "Océano, costa y superficies de agua",
    icon: "≈",
    color: "#287d8d",
  },
  {
    key: "street",
    label: "Calle",
    description: "Vías urbanas y espacios públicos",
    icon: "↟",
    color: "#bf7c34",
  },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;
let sharedModelPromise: Promise<InferenceModel> | null = null;

async function waitForTensorFlow(): Promise<TfRuntime> {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (window.tf) {
      await window.tf.ready();
      return window.tf;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }
  throw new Error("No se pudo iniciar el motor de clasificación.");
}

async function getModel(
  onProgress: (fraction: number) => void,
): Promise<InferenceModel> {
  if (!sharedModelPromise) {
    sharedModelPromise = waitForTensorFlow().then((tf) =>
      tf.loadGraphModel("/model/model.json", { onProgress }),
    );
  }
  return sharedModelPromise;
}

function confidenceMessage(top: Prediction, second: Prediction) {
  const margin = top.probability - second.probability;

  if (top.probability >= 0.75 && margin >= 0.15) {
    return {
      label: "Confianza alta",
      message: "La escena coincide claramente con esta categoría.",
      tone: "high",
    };
  }

  if (top.probability >= 0.5 && margin >= 0.08) {
    return {
      label: "Confianza media",
      message: "La predicción es útil, aunque existen rasgos de otra categoría.",
      tone: "medium",
    };
  }

  return {
    label: "Resultado ambiguo",
    message:
      "La imagen no coincide con claridad. Prueba con una foto más nítida o centrada.",
    tone: "low",
  };
}

export default function Home() {
  const [modelStatus, setModelStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [modelProgress, setModelProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isPredicting, setIsPredicting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const currentUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    getModel((fraction) => {
      if (active) {
        setModelProgress(Math.round(fraction * 100));
      }
    })
      .then(() => {
        if (active) {
          setModelProgress(100);
          setModelStatus("ready");
        }
      })
      .catch(() => {
        if (active) {
          setModelStatus("error");
          setError(
            "No se pudo cargar el modelo. Comprueba tu conexión y recarga la página.",
          );
        }
      });

    return () => {
      active = false;
      if (currentUrlRef.current) {
        URL.revokeObjectURL(currentUrlRef.current);
      }
    };
  }, []);

  async function classify(file: File) {
    setError("");
    setPredictions([]);

    if (!file.type.startsWith("image/")) {
      setError("Selecciona un archivo de imagen válido.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("La imagen supera el límite de 10 MB.");
      return;
    }

    if (currentUrlRef.current) {
      URL.revokeObjectURL(currentUrlRef.current);
    }

    const objectUrl = URL.createObjectURL(file);
    currentUrlRef.current = objectUrl;
    setPreviewUrl(objectUrl);
    setFileName(file.name);
    setIsPredicting(true);

    const inputImage = new Image();
    inputImage.src = objectUrl;

    try {
      await inputImage.decode();
      const tf = await waitForTensorFlow();
      const model = await getModel(setModelProgress);

      const pixelTensor = tf.browser.fromPixels(inputImage, 3);
      const resizedTensor = tf.image.resizeBilinear(
        pixelTensor,
        [224, 224],
        false,
      );
      const floatTensor = resizedTensor.toFloat();
      const batchedTensor = floatTensor.expandDims(0);
      const rawOutput = model.predict(batchedTensor);
      const logits = Array.isArray(rawOutput)
        ? rawOutput[0]
        : "data" in rawOutput
          ? rawOutput
          : Object.values(rawOutput)[0];
      if (!logits) {
        throw new Error("El modelo no devolvió una predicción.");
      }
      const probabilityTensor = tf.softmax(logits);
      const values = Array.from(await probabilityTensor.data());

      const ranked = SCENES.map((scene, index) => ({
        ...scene,
        probability: values[index] ?? 0,
      })).sort((a, b) => b.probability - a.probability);

      pixelTensor.dispose();
      resizedTensor.dispose();
      floatTensor.dispose();
      batchedTensor.dispose();
      logits.dispose();
      probabilityTensor.dispose();

      setPredictions(ranked);
    } catch {
      setError(
        "No fue posible analizar esta imagen. Prueba con un archivo JPG, PNG o WebP.",
      );
    } finally {
      setIsPredicting(false);
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      void classify(file);
    }
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      void classify(file);
    }
  }

  function onDropzoneKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      galleryInputRef.current?.click();
    }
  }

  function reset() {
    if (currentUrlRef.current) {
      URL.revokeObjectURL(currentUrlRef.current);
      currentUrlRef.current = null;
    }
    setPreviewUrl(null);
    setFileName("");
    setPredictions([]);
    setError("");
  }

  const primary = predictions[0];
  const secondary = predictions[1];
  const confidence =
    primary && secondary ? confidenceMessage(primary, secondary) : null;

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="Escena IA, inicio">
          <span className="brand-mark" aria-hidden="true">
            E
          </span>
          <span>Escena IA</span>
        </a>
        <div className={`model-pill model-pill--${modelStatus}`}>
          <span className="status-dot" aria-hidden="true" />
          {modelStatus === "ready"
            ? "Modelo listo"
            : modelStatus === "error"
              ? "Modelo no disponible"
              : `Preparando modelo · ${modelProgress}%`}
        </div>
      </header>

      <section className="hero" id="inicio">
        <div className="hero-copy">
          <p className="eyebrow">
            Clasificación de escenas con inteligencia artificial
          </p>
          <h1>
            ¿Qué escena
            <span> estás viendo?</span>
          </h1>
          <p className="hero-intro">
            Sube una fotografía y obtén una clasificación entre seis tipos de
            escenas. El análisis ocurre en tu navegador: la imagen no se envía
            a ningún servidor.
          </p>
          <div className="model-facts" aria-label="Características del modelo">
            <div>
              <strong>94.63%</strong>
              <span>accuracy de prueba</span>
            </div>
            <div>
              <strong>6</strong>
              <span>categorías reconocidas</span>
            </div>
            <div>
              <strong>Local</strong>
              <span>privacidad por diseño</span>
            </div>
          </div>
        </div>

        <div className="workspace-card">
          {!previewUrl ? (
            <div
              className={`dropzone ${isDragging ? "dropzone--active" : ""}`}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onKeyDown={onDropzoneKeyDown}
              role="button"
              tabIndex={0}
              aria-label="Seleccionar o arrastrar una imagen"
              data-testid="dropzone"
            >
              <span className="upload-symbol" aria-hidden="true">
                +
              </span>
              <h2>Selecciona una fotografía</h2>
              <p>Arrastra una imagen aquí o elige una opción</p>
              <div className="upload-actions">
                <button
                  className="primary-button"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    galleryInputRef.current?.click();
                  }}
                >
                  Elegir imagen
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    cameraInputRef.current?.click();
                  }}
                >
                  Usar cámara
                </button>
              </div>
              <small>JPG, PNG o WebP · máximo 10 MB</small>
            </div>
          ) : (
            <div className="analysis-view">
              <div className="image-panel">
                {/* The source is a short-lived local object URL selected by the user. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="Imagen seleccionada para clasificar" />
                <div className="image-caption">
                  <span>{fileName}</span>
                  <button type="button" onClick={reset}>
                    Cambiar imagen
                  </button>
                </div>
              </div>

              <div className="result-panel" aria-live="polite">
                {isPredicting ? (
                  <div className="predicting-state" role="status">
                    <span className="analysis-pulse" aria-hidden="true" />
                    <strong>Analizando la escena…</strong>
                    <p>El modelo está comparando sus rasgos visuales.</p>
                  </div>
                ) : primary && confidence ? (
                  <>
                    <p className="result-kicker">Resultado principal</p>
                    <div className="result-title-row">
                      <span
                        className="scene-icon scene-icon--large"
                        style={{ backgroundColor: primary.color }}
                        aria-hidden="true"
                      >
                        {primary.icon}
                      </span>
                      <div>
                        <h2>{primary.label}</h2>
                        <p>{primary.description}</p>
                      </div>
                    </div>
                    <div className="confidence-score">
                      <strong>{Math.round(primary.probability * 100)}%</strong>
                      <span>confianza del modelo</span>
                    </div>
                    <div
                      className={`confidence-note confidence-note--${confidence.tone}`}
                    >
                      <strong>{confidence.label}</strong>
                      <span>{confidence.message}</span>
                    </div>
                    <div className="alternatives">
                      <p>Otras posibilidades</p>
                      {predictions.slice(1, 4).map((prediction) => (
                        <div className="alternative-row" key={prediction.key}>
                          <span>{prediction.label}</span>
                          <div className="probability-track">
                            <span
                              style={{
                                width: `${Math.max(
                                  prediction.probability * 100,
                                  2,
                                )}%`,
                                backgroundColor: prediction.color,
                              }}
                            />
                          </div>
                          <strong>
                            {Math.round(prediction.probability * 100)}%
                          </strong>
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          )}

          {error ? (
            <p className="error-message" role="alert">
              {error}
            </p>
          ) : null}

          <input
            ref={galleryInputRef}
            className="visually-hidden"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onFileChange}
            aria-label="Elegir una imagen del dispositivo"
          />
          <input
            ref={cameraInputRef}
            className="visually-hidden"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFileChange}
            aria-label="Tomar una fotografía con la cámara"
          />
        </div>
      </section>

      <section className="categories-section" aria-labelledby="categorias">
        <div className="section-heading">
          <p className="eyebrow">Lo que el modelo reconoce</p>
          <h2 id="categorias">Seis escenas, una clasificación clara</h2>
          <p>
            El modelo fue entrenado exclusivamente con estas categorías. Una
            foto fuera de este conjunto puede producir un resultado ambiguo.
          </p>
        </div>
        <div className="category-grid">
          {SCENES.map((scene) => (
            <article className="category-card" key={scene.key}>
              <span
                className="scene-icon"
                style={{ backgroundColor: scene.color }}
                aria-hidden="true"
              >
                {scene.icon}
              </span>
              <div>
                <h3>{scene.label}</h3>
                <p>{scene.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="how-section" aria-labelledby="como-funciona">
        <div className="section-heading section-heading--light">
          <p className="eyebrow">Cómo funciona</p>
          <h2 id="como-funciona">De la fotografía al resultado</h2>
        </div>
        <ol className="steps-list">
          <li>
            <span>01</span>
            <div>
              <h3>Selecciona</h3>
              <p>Elige una fotografía nítida de una escena exterior.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Analiza</h3>
              <p>EfficientNetV2B0 procesa la imagen dentro del navegador.</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Interpreta</h3>
              <p>Recibe la categoría principal, confianza y alternativas.</p>
            </div>
          </li>
        </ol>
      </section>

      <footer>
        <div>
          <a className="brand brand--footer" href="#inicio">
            <span className="brand-mark" aria-hidden="true">
              E
            </span>
            <span>Escena IA</span>
          </a>
          <p>
            Clasificador académico de escenas naturales basado en
            EfficientNetV2B0.
          </p>
        </div>
        <p className="footer-note">
          Las predicciones son orientativas y pueden fallar en imágenes
          borrosas, interiores o escenas no contempladas.
        </p>
      </footer>
    </main>
  );
}
