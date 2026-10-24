# VavaBoard

Dashboard de partidas de Valorant (HTML + Tailwind CDN + Chart.js CDN + JS).
Lê os JSONs de partida da pasta `data/`, sem backend. Os dados ficam só no navegador.

## Como rodar
Basta abrir o projeto com o Live Server no vscode!

## Estrutura

```
index.html              página e contêineres dos gráficos
assets/
  maps/                 <Mapa>_minimap.jpeg   (também aceita webp/png/jpg)
  characters/           <Agente>_icon.jpeg    (também aceita webp/png/jpg)
data/
  catalog.json          lista de partidas, equipes e jogadores
  <pastas>/*.json       partidas no formato bruto
main.js               estado, renderização, mapa, rounds (ponto de entrada)
data/
  dataLoader.js       lê e normaliza o JSON (único que conhece o formato bruto)
  catalogTools.js     lados Blue/Red das equipes e lista de jogadores
map/
  mapPoints.js        mantém os pontos dentro da área jogável do minimapa
charts/
  chartManager.js     cria/destrói instâncias do Chart.js
  extraCharts.js      gráficos e tabelas extras (economia, equipe, acertos, rounds)
ui/
  dashboardUI.js      abas, sub-abas, ampliar gráfico/mapa
```

A ordem dos `<script>` no `index.html` importa: dados, mapa, gráficos, `main.js`,
`extraCharts.js` e, por último, `dashboardUI.js`.

## Mexer no projeto
- **Novo mapa:** adicione a calibração em `MAP_CAL` (`dataLoader.js`) e a imagem em `assets/maps/`.
- **Nova arma no texto dos abates:** adicione o UUID em `WEAPONS` (`dataLoader.js`).
- **Novo gráfico:** crie um `<canvas id="...">` no `index.html`, escreva a função em
  `extraCharts.js` e registre com `VD.app.registerChart('id', fn)`.
- **Nova tabela/bloco HTML:** use `VD.app.onRender(fn)`.
- **Erros:** abra o console (F12); as mensagens começam com `[VavaBoard]`.

## Observações sobre os dados
- A duração do round é estimada (último evento; +45 s se a spike detonou; 100 s se o tempo acabou).
- Habilidades: o JSON só traz o total por partida; efeitos em inimigos dependem dos campos `*Effects`.
- Créditos ganhos são calculados pelas regras (3000/1900/5000/200/300), não vêm do arquivo.
