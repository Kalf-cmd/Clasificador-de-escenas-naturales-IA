import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import worker from "../dist/server/index.js";

const modelDirectory = process.env.MODEL_DIR ?? "public/model";
const require = createRequire(import.meta.url);

async function render(path = "/") {
  const response = await worker.fetch(
    new Request(`https://escena-ia.test${path}`),
    {},
    {},
  );

  return {
    response,
    html: await response.text(),
  };
}

test("renders the end-user classifier and its model facts", async () => {
  const { response, html } = await render();

  assert.equal(response.status, 200);
  assert.match(html, /Escena IA/);
  assert.match(html, /¿Qué escena/);
  assert.match(html, /94\.63%/);
  assert.match(html, /EfficientNetV2B0/);
  assert.match(html, /Elegir imagen/);
  assert.match(html, /Usar cámara/);
  assert.match(html, /\/vendor\/tf\.min\.js/);
  assert.doesNotMatch(html, /react-loading-skeleton|codex-preview/i);
});

test("explains privacy and all supported scene classes", async () => {
  const { html } = await render();

  assert.match(html, /la imagen no se envía/i);
  for (const label of [
    "Edificios",
    "Bosque",
    "Glaciar",
    "Montaña",
    "Mar",
    "Calle",
  ]) {
    assert.match(html, new RegExp(label));
  }
});

test("loads the converted model and returns six normalized probabilities", async () => {
  const runtimeSource = fs.readFileSync("public/vendor/tf.min.js", "utf8");
  const runtimeModule = { exports: {} };
  Function("module", "exports", "require", runtimeSource)(
    runtimeModule,
    runtimeModule.exports,
    require,
  );

  const tf = runtimeModule.exports;
  const modelJson = JSON.parse(
    fs.readFileSync(`${modelDirectory}/model.json`, "utf8"),
  );
  const manifest = modelJson.weightsManifest[0];
  const weightBytes = Buffer.concat(
    manifest.paths.map((path) =>
      fs.readFileSync(`${modelDirectory}/${path}`),
    ),
  );
  const weightData = weightBytes.buffer.slice(
    weightBytes.byteOffset,
    weightBytes.byteOffset + weightBytes.byteLength,
  );

  const model = await tf.loadGraphModel({
    load: async () => ({
      convertedBy: modelJson.convertedBy,
      format: modelJson.format,
      generatedBy: modelJson.generatedBy,
      modelTopology: modelJson.modelTopology,
      weightData,
      weightSpecs: manifest.weights,
    }),
  });

  const input = tf.zeros([1, 224, 224, 3]);
  const rawOutput = model.predict(input);
  const raw = Array.isArray(rawOutput)
    ? rawOutput[0]
    : typeof rawOutput.data === "function"
      ? rawOutput
      : Object.values(rawOutput)[0];
  const probabilities = tf.softmax(raw);
  const values = Array.from(await probabilities.data());

  assert.equal(values.length, 6);
  assert.ok(values.every(Number.isFinite));
  assert.ok(Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) < 1e-5);

  input.dispose();
  raw.dispose();
  probabilities.dispose();
  model.dispose();
});
