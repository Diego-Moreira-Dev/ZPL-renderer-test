<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { init, zplToBase64Async, ZPL_RENDERER_VERSION, ZEBRASH_VERSION } from 'zpl-renderer-js/external';
import wasmUrl from 'zpl-renderer-js/wasm?url';

const DPMM = 8;
const DEFAULT_WIDTH_MM = 101.6;
const DEFAULT_HEIGHT_MM = 203.2;

const EXAMPLE_ZPL = `^XA
^PW812
^LL609

^FO50,40
^A0N,40,40
^FDTeste ZPL Renderer^FS

^FO50,100
^A0N,30,30
^FDProduto: Tinta Azul^FS

^FO50,150
^A0N,30,30
^FDLote: 123456^FS

^FO400,100
^BQN,2,5
^FDLA,https://example.com^FS

^XZ`;

const zpl = ref(EXAMPLE_ZPL);
const imageSrc = ref(''); 
const error = ref<{ title: string; message: string } | null>(null);
const isRendererReady = ref(false); 
const isRendering = ref(false);
const renderInfo = ref('');
const imageSize = ref(''); 
const widthDots = computed<number>({
  get: () => dimensionInDots(zpl.value, 'PW', DEFAULT_WIDTH_MM),
  set: (value) => updateDimensionCommand('PW', value),
});
const heightDots = computed<number>({
  get: () => dimensionInDots(zpl.value, 'LL', DEFAULT_HEIGHT_MM),
  set: (value) => updateDimensionCommand('LL', value),
});

async function renderZpl(): Promise<void> {
  if (!isRendererReady.value) return;

  error.value = null;
  const zplCode = zpl.value.trim();
  if (!zplCode) {
    clearPreview();
    showError('Erro ao renderizar ZPL', 'O ZPL está vazio. Digite um ZPL ou clique em "Carregar exemplo".');
    return;
  }

  isRendering.value = true;
  const startedAt = performance.now();
  try {
    const { widthMm, heightMm } = labelSizeInMm(zplCode);

    const base64Png = await zplToBase64Async(zplCode, widthMm, heightMm, DPMM);

    imageSrc.value = `data:image/png;base64,${base64Png}`;

    const ms = Math.round(performance.now() - startedAt);
    renderInfo.value = `${widthMm} × ${heightMm} mm @ ${DPMM} dpmm · ${ms} ms`;
  } catch (err) {
    clearPreview();
    const hint = String(err).includes('No labels parsed')
      ? 'Dica: o ZPL precisa ter pelo menos uma etiqueta entre ^XA e ^XZ.'
      : '';
    showError('Erro ao renderizar ZPL', err, hint);
  } finally {
    isRendering.value = false;
  }
}
function labelSizeInMm(zplCode: string): { widthMm: number; heightMm: number } {
  const pwDots = Number(/\^PW(\d+)/.exec(zplCode)?.[1] ?? 0);
  const llDots = Number(/\^LL(\d+)/.exec(zplCode)?.[1] ?? 0);
  return {
    widthMm: pwDots > 0 ? pwDots / DPMM : DEFAULT_WIDTH_MM,
    heightMm: llDots > 0 ? llDots / DPMM : DEFAULT_HEIGHT_MM,
  };
}

function dimensionInDots(zplCode: string, command: 'PW' | 'LL', fallbackMm: number): number {
  const dots = Number(new RegExp(`\\^${command}(\\d+)`).exec(zplCode)?.[1] ?? 0);
  return dots > 0 ? dots : Math.round(fallbackMm * DPMM);
}

function updateDimensionCommand(command: 'PW' | 'LL', dots: number): void {
  if (!Number.isInteger(dots) || dots < 1) return;

  const commandPattern = new RegExp(`\\^${command}\\d+`);
  if (commandPattern.test(zpl.value)) {
    zpl.value = zpl.value.replace(commandPattern, `^${command}${dots}`);
    return;
  }

  const startCommand = /\^XA/i;
  zpl.value = startCommand.test(zpl.value)
    ? zpl.value.replace(startCommand, (start) => `${start}\n^${command}${dots}`)
    : `^${command}${dots}\n${zpl.value}`;
}

onMounted(async () => {
  try {
    await init({ wasmUrl });
    isRendererReady.value = true;
  } catch (err) {
    showError('Erro ao inicializar o ZPL Renderer JS', err, 'Verifique o console (F12) e recarregue a página.');
    return;
  }
  await renderZpl(); 
});
function loadExample(): void {
  zpl.value = EXAMPLE_ZPL;
  renderZpl();
}

function clearAll(): void {
  zpl.value = '';
  clearPreview();
  if (isRendererReady.value) error.value = null;
}

function clearPreview(): void {
  imageSrc.value = '';
  imageSize.value = '';
  renderInfo.value = '';
}

function onImageLoad(event: Event): void {
  const img = event.target as HTMLImageElement;
  imageSize.value = `${img.naturalWidth} × ${img.naturalHeight} px`;
}

function showError(title: string, err: unknown, hint = ''): void {
  console.error(`[ZPL Renderer Test] ${title}:`, err);
  const message = err instanceof Error ? err.message : String(err);
  error.value = { title, message: hint ? `${message}\n${hint}` : message };
}
</script>

<template>
  <main class="playground">
    <section class="panel">
      <h2>ZPL editor</h2>
      <textarea
        v-model="zpl"
        class="zpl-editor"
        spellcheck="false"
        placeholder="Digite ou cole um ZPL aqui (^XA ... ^XZ)"
        @keydown.ctrl.enter.prevent="renderZpl"
      ></textarea>

      <div class="actions">
        <button class="primary" :disabled="!isRendererReady || isRendering" @click="renderZpl">
          {{ isRendering ? 'Renderizando...' : 'Renderizar ZPL' }}
        </button>
        <button @click="loadExample">Carregar exemplo</button>
        <button @click="clearAll">Limpar</button>
        <span class="hint">Ctrl + Enter também renderiza</span>
      </div>

      <h2>Dimensões da etiqueta</h2>
      <div class="dimensions">
        <label>Largura (^PW, dots) <input v-model.number="widthDots" type="number" min="1" step="1" /></label>
        <label>Altura (^LL, dots) <input v-model.number="heightDots" type="number" min="1" step="1" /></label>
      </div>
    </section>
    <section class="panel">
      <h2>Preview</h2>

      <div v-if="error" class="error" role="alert">
        <strong>{{ error.title }}:</strong>
        <pre>{{ error.message }}</pre>
      </div>

      <div class="preview">
        <img v-if="imageSrc" :src="imageSrc" alt="Etiqueta renderizada" @load="onImageLoad" />
        <p v-else-if="!isRendererReady && !error" class="muted">Carregando o motor WASM do renderer...</p>
        <p v-else class="muted">Nenhuma etiqueta renderizada.</p>
      </div>

      <p v-if="imageSrc" class="info">
        PNG {{ imageSize }} · enviado ao renderer: {{ renderInfo }} ·
        <a :href="imageSrc" download="etiqueta.png">Baixar PNG</a>
      </p>
      <p class="info">zpl-renderer-js {{ ZPL_RENDERER_VERSION }} · Zebrash {{ ZEBRASH_VERSION }}</p>
    </section>
  </main>
</template>
