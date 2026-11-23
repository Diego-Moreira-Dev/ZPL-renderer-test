# ZPL Renderer Test

Playground local, pequeno e didático, para testar a biblioteca **ZPL Renderer JS**
([`zpl-renderer-js`](https://github.com/Fabrizz/zpl-renderer-js)) com **Vue 3 + TypeScript + Vite**.

Você escreve, ou gera a partir de dados Vue, uma string ZPL. A biblioteca transforma essa string
em uma imagem PNG e o Vue mostra a etiqueta no navegador.

> Não é um sistema de impressão: não conversa com impressoras e não tem backend nem banco de dados.
> Tudo roda no navegador.

```bash
npm install
npm run dev     # http://localhost:5173
```

---

## O que é ZPL

**ZPL (Zebra Programming Language)** é a linguagem usada para descrever etiquetas para impressoras
Zebra (e compatíveis). Uma etiqueta ZPL é um texto com comandos que começam com `^` (ou `~`),
entre `^XA` (início) e `^XZ` (fim):

```zpl
^XA
^FO50,40^A0N,40,40^FDOlá^FS
^XZ
```

A impressora lê esse texto e desenha textos, linhas, códigos de barras, QR Codes e imagens.
Sem uma impressora não dá para "ver" a etiqueta. É esse o problema que o renderer resolve.

## O que o renderer faz

```text
string ZPL           (texto do editor)
   ↓
ZPL Renderer JS      (motor Zebrash compilado para WebAssembly, rodando no navegador)
   ↓
imagem PNG           (string Base64)
   ↓
Vue                  (data URL em um <img>)
   ↓
Preview
```

O ZPL não é enviado para nenhum servidor.

---

## A biblioteca: ZPL Renderer JS

Informações conferidas no README oficial do pacote, nos arquivos de tipos (`.d.ts`) da versão
instalada e em testes práticos.

|                      |                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| Pacote npm           | [`zpl-renderer-js`](https://www.npmjs.com/package/zpl-renderer-js)                                       |
| GitHub               | https://github.com/Fabrizz/zpl-renderer-js (licença MIT)                                                 |
| Versão usada         | **4.0.0** (a mais recente quando este projeto foi criado)                                                |
| Instalação           | `npm install zpl-renderer-js`                                                                            |
| Motor interno        | [Zebrash](https://github.com/ingridhq/zebrash) v1.38.0: renderizador de ZPL escrito em Go, compilado para WebAssembly |
| Funciona no browser? | Sim. Builds ESM e CJS para bundlers (Vite, webpack…); o WebAssembly roda no navegador                     |
| Formato do resultado | `Promise<string>` com um **PNG em Base64 puro** (sem o prefixo `data:`)                                  |

### Dois jeitos de importar

| Import                     | Onde fica o WASM                                                                  | Observação                                            |
| -------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `zpl-renderer-js`          | embutido no JavaScript (~9 MB de JS)                                              | mais simples, bundle grande                           |
| `zpl-renderer-js/external` | arquivo `zebrash.wasm` separado (~7 MB, ~2,3 MB com gzip), carregado por `init()` | **recomendado pela documentação; é o usado aqui**     |

> A partir da 4.0.0 não existe mais build UMD (`<script>`). Para isso a documentação indica `zpl-renderer-js@3`.

### A API usada neste projeto

```ts
import { init, zplToBase64Async } from 'zpl-renderer-js/external';
import wasmUrl from 'zpl-renderer-js/wasm?url'; // Vite: URL do .wasm que já vem dentro do pacote

await init({ wasmUrl }); // uma vez, antes de qualquer renderização

const base64Png = await zplToBase64Async(zpl, widthMm, heightMm, dpmm);
const imageSrc = `data:image/png;base64,${base64Png}`; // pronto para <img :src="imageSrc">
```

É o uso documentado no README oficial para Vite: o sufixo `?url` faz o Vite servir o arquivo
`.wasm` e devolver a URL dele.

Tudo o que `zpl-renderer-js/external` exporta (v4.0.0):

| Export                                     | Assinatura                                                                  | Para quê                                                                                                         |
| ------------------------------------------ | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `init`                                     | `init(options): Promise<ZplApi>`, com `options`: `{ wasmUrl?, wasmBytes?, wasmModule? }` | Carrega o WASM. **Obrigatório** antes do resto (senão: erro "requires init() before use").                        |
| `zplToBase64Async`                         | `(zpl, widthMm?, heightMm?, dpmm?, options?) => Promise<string>`            | Renderiza a etiqueta → PNG Base64. **É a função usada aqui.** Se o texto tiver várias etiquetas, renderiza só a primeira. |
| `zplToBase64MultipleAsync`                 | mesmos parâmetros `=> Promise<string[]>`                                    | Um PNG para cada `^XA…^XZ` do texto.                                                                             |
| `getApi`                                   | `() => Promise<ZplApi>`                                                     | As mesmas funções, reunidas em um objeto.                                                                        |
| `Render`                                   | `(zpl, widthMm?, heightMm?, dpmm?)`                                         | **Deprecated**: use `zplToBase64Async`.                                                                          |
| `ZPL_RENDERER_VERSION` / `ZEBRASH_VERSION` | `string`                                                                    | `"4.0.0"` / `"v1.38.0"` (aparecem no rodapé do preview).                                                         |

Parâmetros de renderização:

| Parâmetro  | Padrão        | Significado                                                                                                             |
| ---------- | ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `widthMm`  | 101.6 (4")    | largura da etiqueta em **milímetros**                                                                                   |
| `heightMm` | 203.2 (8")    | altura da etiqueta em **milímetros**                                                                                    |
| `dpmm`     | 8 (≈ 203 dpi) | dots por milímetro (resolução da impressora)                                                                            |
| `options`  | —             | `{ enableInvertedLabels?: boolean; grayscaleOutput?: boolean }`: respeitar `^POI`; PNG em tons de cinza com anti-aliasing |

### Comportamentos confirmados na prática

- O retorno é **Base64 sem prefixo** (`iVBORw0KGgo…`). Basta acrescentar `data:image/png;base64,` para usar no `<img>`.
- **`^PW`/`^LL` não definem o tamanho da imagem.** O tamanho vem de `widthMm × dpmm` por `heightMm × dpmm`.
  Sem esses argumentos, qualquer etiqueta vira um PNG de 813 × 1626 px. Por isso o componente lê `^PW`/`^LL`
  do texto e converte dots → mm (veja [Dots, milímetros e DPI](#dots-milímetros-e-dpi)).
- Acentos só saem corretos com **`^CI28`** (UTF-8).
- Erros são lançados como `Error` (ex.: `No labels parsed`). Comandos desconhecidos e parâmetros inválidos
  são **ignorados sem erro**.
- Cada renderização leva ~25–75 ms. Para muitas renderizações seguidas, a documentação recomenda rodar a
  biblioteca em um **Web Worker** (não usado aqui, para manter o projeto simples).

### Como o resultado é exibido no Vue

A biblioteca já entrega um PNG, então não há canvas, SVG nem Blob. A data URL vai direto para um `<img>`:

```vue
<img v-if="imageSrc" :src="imageSrc" alt="Etiqueta renderizada" />
```

---

## Principais comandos ZPL

Coordenadas e tamanhos são em **dots** (pontos da cabeça de impressão). A origem `0,0` é o canto
superior esquerdo; `x` cresce para a direita e `y` para baixo.

| Comando | Nome              | O que faz                                                                     | Exemplo           |
| ------- | ----------------- | ----------------------------------------------------------------------------- | ----------------- |
| `^XA`   | Start Format      | Abre a etiqueta                                                               | `^XA`             |
| `^XZ`   | End Format        | Fecha a etiqueta                                                              | `^XZ`             |
| `^PW`   | **Print Width**   | Largura de impressão, em dots                                                 | `^PW600`          |
| `^LL`   | **Label Length**  | Comprimento (altura) da etiqueta, em dots                                     | `^LL300`          |
| `^FO`   | Field Origin      | Posição `x,y` do campo; o ponto é o **canto superior esquerdo** do campo      | `^FO50,40`        |
| `^FT`   | Field Typeset     | Posição `x,y`; em textos, `y` é a **linha de base** (onde as letras "apoiam") | `^FT50,80`        |
| `^A0`   | Fonte 0           | Fonte escalável: `^A0<orientação>,<altura>,<largura>`                         | `^A0N,40,40`      |
| `^FD`   | Field Data        | Conteúdo do campo (texto ou dados do código)                                  | `^FDLote: 123456` |
| `^FS`   | Field Separator   | Fecha o campo                                                                 | `^FS`             |
| `^BQN`  | QR Code           | `^BQ` + orientação `N`                                                        | `^BQN,2,5`        |
| `^CI28` | Change Int. Font  | Interpreta os textos como UTF-8 (acentos)                                     | `^CI28`           |

Orientação (o `N` de `^A0N` e `^BQN`): `N` = normal, `R` = 90°, `I` = 180°, `B` = 270°.

Um campo de texto típico combina quatro comandos:

```text
^FO50,40         ← onde: x = 50, y = 40 dots
^A0N,40,40       ← fonte 0, normal, 40 dots de altura e 40 de largura
^FDTeste^FS      ← o quê: o texto, e o fim do campo
```

### O QR Code: `^BQN,2,5` e `^FDLA,…`

```zpl
^FO400,100
^BQN,2,5
^FDLA,https://example.com^FS
```

| Parte                 | Significado                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `^BQ`                 | Código de barras **QR Code**                                                                                             |
| `N`                   | Orientação normal (único valor aceito para QR)                                                                           |
| `2`                   | Modelo 2 (o recomendado; o modelo 1 é o original, antigo)                                                                |
| `5`                   | Ampliação: cada "quadradinho" (módulo) do QR terá 5 × 5 dots (de 1 a 10)                                                 |
| `L` em `^FDLA,`       | Nível de correção de erro: `L` ≈ 7%, `M` ≈ 15%, `Q` ≈ 25%, `H` ≈ 30% (mais correção = QR mais resistente, porém maior)   |
| `A` em `^FDLA,`       | Modo de entrada automático (a codificação dos dados é escolhida automaticamente)                                         |
| texto após a vírgula  | O conteúdo do QR (`https://example.com`)                                                                                 |

No exemplo com dados dinâmicos, o QR recebe o lote: `^FDLA,${fields.internalBatch}^FS`.

---

## Requisitos

- **Node.js 18+** (testado com Node 20.14.0 e npm 10.7.0)
- Navegador moderno com WebAssembly (testado no Microsoft Edge)

Versões escolhidas:

| Pacote               | Versão  | Por quê                                                                                                   |
| -------------------- | ------- | --------------------------------------------------------------------------------------------------------- |
| `vue`                | ^3.5    | Vue 3 + Composition API                                                                                   |
| `zpl-renderer-js`    | ^4.0.0  | a biblioteca testada                                                                                      |
| `vite`               | ^6.4    | Vite 7/8 exigem Node ≥ 20.19 ou ≥ 22.12; o Vite 6 roda no Node 18/20                                      |
| `@vitejs/plugin-vue` | ^5.2    | versão do plugin compatível com o Vite 6                                                                  |
| `typescript`         | ~6.0    | mesma linha do template oficial do `create-vite` (o TypeScript 7 nativo ainda não é suportado pelo `vue-tsc`) |
| `vue-tsc`            | ^3.3    | checagem de tipos dos arquivos `.vue` no build                                                            |

Com Node ≥ 20.19 (ou ≥ 22.12), dá para atualizar: `npm install -D vite@latest @vitejs/plugin-vue@latest`.

## Como instalar

```bash
cd zpl-renderer-test
npm install
```

## Como executar

```bash
npm run dev       # desenvolvimento → http://localhost:5173
npm run build     # checa os tipos (vue-tsc) e gera dist/
npm run preview   # serve o dist/ → http://localhost:4173
```

- **Porta:** o Vite usa a 5173. Se ela estiver ocupada, usa a próxima livre (5174, 5175…) e mostra a URL
  certa no terminal. Para forçar a 5173, use `server: { port: 5173, strictPort: true }` em `vite.config.ts`.
- No `npm run build`, o arquivo `zebrash-*.wasm` de ~7 MB é o motor do renderer. Esse tamanho é normal.

## Como testar

1. **Abra o navegador** em http://localhost:5173. A etiqueta de exemplo já aparece renderizada.
2. **Altere o ZPL** no editor. Ex.: troque `^FO50,40` por `^FO150,40`, ou `^A0N,40,40` por `^A0N,60,60`.
3. Clique em **Renderizar ZPL** (ou use `Ctrl + Enter` no editor).
4. **Veja o resultado** no preview. Abaixo dele aparecem o tamanho do PNG, os mm/dpmm enviados ao
   renderer, o tempo de renderização e um link **Baixar PNG**.
5. **Altere os dados** em "Dados dinâmicos" (Descrição, Lote, Número, Cor, Width e Height).
6. Clique em **Gerar ZPL pelos dados**. O editor recebe o ZPL gerado por `generateZpl()` e o preview é atualizado.
7. **Compare o ZPL e o preview**: cada `^FD…^FS` vira um texto da etiqueta, `^PW`/`^LL` mudam o tamanho e
   o QR Code contém o lote (aponte a câmera do celular para conferir).

Para ver o tratamento de erros:

| Faça isto                                          | Resultado esperado                              |
| -------------------------------------------------- | ----------------------------------------------- |
| **Limpar** e depois **Renderizar ZPL**             | `O ZPL está vazio…`                             |
| Digite `hello world` e renderize                   | `No labels parsed` + dica sobre `^XA`/`^XZ`     |
| Renderize `^XA^FO50,50^BQN,2,5^FD^FS^XZ`           | `Error rendering: … invalid qr barcode data`    |
| No exemplo, troque `^PW600` por `^PW800`           | preview mais largo (800 × 300 px)               |

---

## Estrutura

```text
zpl-renderer-test/
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── .gitignore
├── README.md
└── src/
    ├── main.ts                  # cria o app Vue
    ├── App.vue                  # título + <ZplPlayground />
    ├── style.css                # todo o CSS (puro)
    └── components/
        └── ZplPlayground.vue    # toda a lógica: estado, generateZpl(), init, render, preview e erros
```

Onde está cada etapa em `src/components/ZplPlayground.vue`:

| Etapa                  | Código                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------- |
| A string ZPL           | `const zpl = ref(EXAMPLE_ZPL)` + `<textarea v-model="zpl">`                             |
| Dados Vue → ZPL        | `generateZpl(fields)` e `generateFromFields()`                                          |
| Inicializar o renderer | `onMounted` → `await init({ wasmUrl })`                                                 |
| ZPL → renderer         | `renderZpl()` → `await zplToBase64Async(zplCode, widthMm, heightMm, DPMM)`              |
| Resultado → preview    | `` imageSrc.value = `data:image/png;base64,${base64Png}` `` + `<img :src="imageSrc">`   |
| Erros                  | `showError()` → caixa vermelha na tela + `console.error`                                |

---

## Dots, milímetros e DPI

- O ZPL trabalha em **dots**. Quantos dots cabem em 1 mm depende da impressora:
  **203 dpi = 8 dots/mm**, **300 dpi = 12 dots/mm**, **600 dpi = 24 dots/mm**.
- `zplToBase64Async` recebe o tamanho em **milímetros** + `dpmm` e não usa `^PW`/`^LL` para dimensionar a
  imagem. Então `renderZpl()` lê `^PW` e `^LL` do próprio texto e converte: **mm = dots ÷ 8**.
  Resultado: **1 pixel por dot** (`^PW600 ^LL300` → PNG 600 × 300).
- Se o ZPL não tiver `^PW`/`^LL`, vale o padrão da biblioteca (101,6 × 203,2 mm → PNG 813 × 1626 px).
- O exemplo (600 × 300 dots) numa impressora de 203 dpi mede 75 × 37,5 mm.
- A constante `DPMM = 8` fica no topo do componente. Ela não altera o desenho do preview (feito em dots);
  muda só os milímetros exibidos abaixo dele.

---

## Tratamento de erros

| Situação                                                                     | Detectado em                                  | Mensagem na tela                                                                  |
| ---------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------- |
| ZPL vazio                                                                    | `renderZpl()`, antes de chamar a biblioteca   | `Erro ao renderizar ZPL: O ZPL está vazio…`                                       |
| Conteúdo inválido: texto sem `^XA…^XZ`, ou etiqueta sem nenhum elemento      | biblioteca                                    | `Erro ao renderizar ZPL: No labels parsed` + dica                                 |
| Erro ao desenhar um elemento (ex.: QR sem dados)                             | biblioteca                                    | `Erro ao renderizar ZPL: Error rendering: failed to draw zpl element: invalid qr barcode data` |
| Falha de inicialização (WASM não carregou: rede, arquivo ausente, navegador sem WebAssembly) | `init()`                      | `Erro ao inicializar o ZPL Renderer JS: …`; o botão "Renderizar ZPL" fica desabilitado |

- Todos os erros também vão para o console: `console.error('[ZPL Renderer Test] …', err)`.
- Depois de uma falha no `init()`, é preciso **recarregar a página**: a biblioteca guarda o resultado da
  primeira tentativa.
- Comandos desconhecidos e parâmetros inválidos **não geram erro**: o renderer simplesmente os ignora.
  Se algo não aparece no preview, revise o comando.

---

## Adaptando para uma etiqueta real

**Teste rápido:** cole o ZPL da sua etiqueta no editor e clique em **Renderizar ZPL**. Nenhum código precisa mudar.

**Com os dados da aplicação:** substitua o corpo de `generateZpl()` em `src/components/ZplPlayground.vue`
pela sua etiqueta, usando os campos de `LabelFields`:

```ts
function generateZpl(fields: LabelFields): string {
  return `^XA
~TA000
~JSN
^LT0
^MNW
^MTT
^PON
^PMN
^LH0,0
^JMA
^PR2,2
~SD22
^JUS
^LRN
^CI28
^PA0,1,1,0
^MMT
^PW1119
^LL224
...
^FD${fields.descriptionFormula}^FS
...
^FD${fields.internalBatch}^FS
...
^FDCor: ${fields.colorInk}^FS
...
^XZ`;
}
```

Os `...` representam os demais comandos da sua etiqueta (`^FT`/`^FO`, fontes, `^GFA` etc.).

Como a etiqueta real tem tamanho fixo, simplifique também a chamada dentro de `generateFromFields()`:

```ts
zpl.value = generateZpl(fields.value);
```

Pronto: o botão **Gerar ZPL pelos dados** passa a gerar a etiqueta real, e o ZPL continua visível no editor.
Os campos Width/Height podem ser removidos do template, se quiser.

### Cuidados (testados com este renderer)

1. **`^CI27` → `^CI28` no preview.** A sua etiqueta usa `^CI27` (Windows-1252). No navegador, o texto chega
   ao renderer em UTF-8; com `^CI27`, "Ação" aparece como "AÃ§Ã£o". No preview, use `^CI28`. Na impressora,
   use a codificação dos bytes que a sua aplicação realmente envia. Se mantiver `^CI27` na impressão, troque
   só para o preview: `zpl.replace('^CI27', '^CI28')`.
2. **Não indente as linhas dentro da template string.** O renderer ignora quebras de linha e tabs, mas **não
   espaços**: os espaços da indentação viram parte do último parâmetro do comando anterior. Exemplo testado:
   `^BQN,2,5` seguido de uma linha indentada (`  ^FDLA,…`) faz o QR Code cair para ampliação 1 e ficar
   minúsculo. Comece cada comando na coluna 0, como em `generateZpl()`.
3. **Nada de comentários dentro da template string.** Tudo entre as crases vai para o renderer (e para a
   impressora), inclusive `// comentários`.
4. **`^` e `~` nos dados.** São caracteres de comando: um `^` dentro de `fields.descriptionFormula` corta o
   texto ali. Evite-os nos dados ou use `^FH` (ex.: `^FH^FD50_25^FS` → "50%"; `_5E` = `^`).
5. **`^FT` não é `^FO`.** O ZPL exportado pelo ZebraDesigner costuma usar `^FT` (`y` = linha de base do texto).
   Ao trocar um pelo outro, ajuste o `y`.
6. **Cabeçalho de configuração.** `~TA`, `~JSN`, `^MNW`, `^MTT`, `^JMA`, `^PR`, `~SD`, `^JUS` e `^MMT`
   configuram a impressora (mídia, velocidade, escurecimento, salvar configuração) e não aparecem no preview.
   `^LH0,0`, `^LT0`, `^PON`, `^PMN` e `^LRN` afetam o layout, mas na sua etiqueta estão com valores neutros.
   O cabeçalho completo renderiza normalmente.

### `^GFA`: imagens dentro do ZPL

`^GFA` (Graphic Field, formato ASCII) embute um **bitmap** (logotipo, ícone, pictograma) dentro do próprio
texto ZPL:

```text
^FO20,20^GFA,<total de bytes>,<bytes do gráfico>,<bytes por linha>,<dados>^FS
```

Os dados costumam ter **milhares de caracteres**. Por isso uma etiqueta real pode ser bem maior e mais
complexa que o exemplo deste projeto, mesmo quando parece simples visualmente.

| Formato dos dados                                                   | Funciona neste renderer?                    |
| ------------------------------------------------------------------- | ------------------------------------------- |
| hexadecimal puro (`FFFF8001…`)                                      | ✅                                          |
| hexadecimal compactado do ZPL (`JF8001:::…`)                        | ✅                                          |
| `:Z64:` (zlib + Base64; comum em ZPL exportado pelo ZebraDesigner)  | ✅                                          |
| `:B64:` (Base64 sem compressão)                                     | ❌ erro `failed to decode hex string`       |
| `~DG` (envia o gráfico) + `^XG` (usa o gráfico) no mesmo texto       | ✅                                          |
| `^XG` de um gráfico que só existe na memória da impressora          | ⚠️ sem erro, mas não aparece nada           |

### Tamanho: `^PW1119` e `^LL224`

Esses valores são **dots**, não milímetros. O tamanho físico depende da densidade (DPI) da impressora:

| Impressora | dots/mm | 1119 × 224 dots ≈ |
| ---------- | ------- | ----------------- |
| 203 dpi    | 8       | 139,9 × 28,0 mm   |
| 300 dpi    | 12      | 93,3 × 18,7 mm    |
| 600 dpi    | 24      | 46,6 × 9,3 mm     |

No preview, a etiqueta vira um PNG de **1119 × 224 px** (1 px por dot) em qualquer caso. Para os
milímetros exibidos baterem com a sua impressora, ajuste `DPMM` no topo do componente (8, 12 ou 24).

---

## Limitações

- O Zebrash emula um **subconjunto** do ZPL. O preview é uma aproximação (as fontes, por exemplo, imitam as
  da impressora). Confirme sempre com uma impressão real.
- O mantenedor original do Zebrash anunciou que deixou o projeto; o repositório continua público (MIT).
- O WASM tem ~7 MB (~2,3 MB com gzip): o primeiro carregamento demora um pouco; depois fica no cache do navegador.
