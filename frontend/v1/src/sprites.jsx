// frontend/src/sprites.jsx
// Sprites pixel-art (estilo 8/16 bits) — temática corporativa de TI.
// Cada sprite é um array de strings; cada caractere vira um pixel da paleta.
// Mantidos os nomes de export (MAGE/MAGE_PALETTE) para não tocar na lógica.

export function Sprite({ map, palette, scale = 6, className = '', style }) {
  const h = map.length;
  const w = Math.max(...map.map((r) => r.length));
  return (
    <svg
      className={className}
      style={style}
      width={w * scale}
      height={h * scale}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {map.flatMap((row, y) =>
        [...row].map((c, x) =>
          c !== '.' && c !== ' ' && palette[c] ? (
            <rect key={`${x}-${y}`} x={x} y={y} width="1.05" height="1.05" fill={palette[c]} />
          ) : null
        )
      )}
    </svg>
  );
}

// ---- O Analista de TI (seu personagem: headset, moletom e notebook) ----
// As chaves 'h' (headset) e 'r' (moletom) são recoloridas com a cor do
// squad na v2 — por isso mantêm os mesmos nomes de antes.
export const MAGE = [
  '...hhhhhh...',
  '..aaaaaaaa..',
  '.hhaffffahh.',
  '.hhfkffkfhh.',
  '..affffffa..',
  '...ffmmff...',
  '..rrrrrrrr..',
  '.rrrrrrrrrr.',
  '.rr.rrrr.rr.',
  '.rr.llll.rr.',
  '....llll....',
  '...kkkkkk...',
  '...kk..kk...'
];
export const MAGE_PALETTE = {
  h: '#7c3aed', a: '#3f2c1e', f: '#fcd9b8', k: '#0f172a',
  m: '#92400e', r: '#4c1d95', l: '#94a3b8'
};

// ---- Os 12 Chefes do mundo corporativo ----
// 0→400: um chefe a cada 50 pontos | 400→700: a cada 100 | 700→1000: chefe final
export const BOSSES = [
  {
    name: 'O Ticket Sem Descrição', from: 0, to: 50, accent: '#f59e0b',
    palette: { w: '#f1f5f9', d: '#94a3b8', k: '#0f172a', q: '#f59e0b' },
    map: [
      '..wwwwwwd...',
      '..wwwwwwwd..',
      '..wkwwwwkw..',
      '..wwwwwwww..',
      '..ww.qqq.w..',
      '..wwq..qww..',
      '..www..qww..',
      '..www.qwww..',
      '..wwwwwwww..',
      '..www.qwww..',
      '..wwwwwwww..'
    ]
  },
  {
    name: 'O Dev que diz "Na Minha Máquina Funciona"', from: 50, to: 100, accent: '#22c55e',
    palette: { g: '#16a34a', f: '#fcd9b8', k: '#0f172a', m: '#92400e', t: '#334155', l: '#cbd5e1', s: '#ef4444' },
    map: [
      '...gggggg...',
      '..gggggggg..',
      '..ffffffff..',
      '..fkffffkf..',
      '..ffffffff..',
      '...ffmmff...',
      '..tttttttt..',
      '.tttttttttt.',
      '.tt.tttt.tt.',
      '.tt.llll.tt.',
      '....lsll....',
      '...kk..kk...'
    ]
  },
  {
    name: 'A Reunião Que Poderia Ser Um Email', from: 100, to: 150, accent: '#38bdf8',
    palette: { r: '#dc2626', w: '#f8fafc', k: '#94a3b8', c: '#0ea5e9', d: '#0f172a' },
    map: [
      '.rrrrrrrrrr.',
      '.rrrrrrrrrr.',
      '.wwwwwwwwww.',
      '.wkw.wk.wkw.',
      '.wwwwwwwwww.',
      '.wkwccccwkw.',
      '.wwwcddcwww.',
      '.wkwcdccwkw.',
      '.wwwccccwww.',
      '.wwwwwwwwww.'
    ]
  },
  {
    name: 'A Senha de Admin Expirada', from: 150, to: 200, accent: '#f87171',
    palette: { s: '#94a3b8', r: '#dc2626', x: '#fef2f2' },
    map: [
      '....ssss....',
      '...ss..ss...',
      '...ss..ss...',
      '..rrrrrrrr..',
      '..rrrrrrrr..',
      '..rxr..rxr..',
      '..rrxrrxrr..',
      '..rrrxxrrr..',
      '..rrxrrxrr..',
      '..rxr..rxr..',
      '...rrrrrr...'
    ]
  },
  {
    name: 'O Deploy de Sexta-Feira às 17h59', from: 200, to: 250, accent: '#fb923c',
    palette: { b: '#cbd5e1', f: '#dc2626', w: '#38bdf8', o: '#fb923c', y: '#fde047' },
    map: [
      '....bb......',
      '...bbbb.....',
      '...bwwb.....',
      '...bbbb.....',
      '..fbbbbf....',
      '..fbbbbf....',
      '...bbbb.....',
      '...oyyo.....',
      '..oyooyo....',
      '..o.yy.o....',
      '.....y......'
    ]
  },
  {
    name: 'O Monolito Legado de 2004', from: 250, to: 300, accent: '#a8a29e',
    palette: { m: '#57534e', d: '#292524', c: '#1c1917', g: '#22c55e' },
    map: [
      '.mmmmmmmmmm.',
      '.mmmmmmmmmm.',
      '.mm.mmmm.mm.',
      '.mmmmmmmmmm.',
      '.mgmmmmmmgm.',
      '.mmgmmmmgmm.',
      '.mmmmccmmmm.',
      '.mmmcmmcmmm.',
      '.mmmmmmmmmm.',
      '.mmdmmmmdmm.',
      '.mmmmmmmmmm.'
    ]
  },
  {
    name: 'O Comitê de Mudanças (CAB)', from: 300, to: 350, accent: '#f87171',
    palette: { h: '#9ca3af', f: '#fcd9b8', s: '#1f2937', d: '#78350f', x: '#dc2626' },
    map: [
      '.hh..hh..hh.',
      '.ff..ff..ff.',
      '.ff..ff..ff.',
      '.ss..ss..ss.',
      'ssssssssssss',
      'dddddddddddd',
      '.d........d.',
      '.d...xx...d.',
      '.d...xx...d.'
    ]
  },
  {
    name: 'O Devorador de Memória (OOMKilled)', from: 350, to: 400, accent: '#4ade80',
    palette: { g: '#16a34a', r: '#f87171', b: '#0f172a', w: '#f8fafc', k: '#14532d', y: '#fbbf24' },
    map: [
      '.gggggggggg.',
      '.grgggggrgg.',
      '.gggggggggg.',
      '.gbgbgbgbgg.',
      '.gbgbgbgbgg.',
      '.gggggggggg.',
      '.gkkkkkkkkg.',
      '.gwkwkwkwkg.',
      '.gggggggggg.',
      'yyyyyyyyyyyy'
    ]
  },
  {
    name: 'A Auditoria Surpresa de Segurança', from: 400, to: 500, accent: '#c084fc',
    palette: { w: '#f1f5f9', k: '#334155', c: '#64748b', o: '#bae6fd', m: '#b45309' },
    map: [
      '....kkkk....',
      '..wwwwwwww..',
      '..wkkwkkww..',
      '..wwwwwwww..',
      '..wkkwkkww..',
      '..wwwccoww..',
      '..wwcoocww..',
      '..wwwccwww..',
      '..wwwwwmww..',
      '..wwwwwwmw..',
      '..wwwwwwww..'
    ]
  },
  {
    name: 'A Black Friday sem Auto-Scaling', from: 500, to: 600, accent: '#fb923c',
    palette: { o: '#fb923c', y: '#fde047', w: '#cbd5e1', k: '#1c1917', r: '#dc2626' },
    map: [
      'o....oo....o',
      '.o..oyyo..o.',
      '..oyoooyo...',
      '.wwwwwwwww..',
      '.w.w.w.w.w..',
      '.wwwwwwwww..',
      '..w......w..',
      '..kk....kk..',
      '..kk....kk..',
      '.rrrrrrrrrr.',
      '.ryryryryrr.'
    ]
  },
  {
    name: 'A Fatura Surpresa da Nuvem', from: 600, to: 700, accent: '#22c55e',
    palette: { c: '#e2e8f0', k: '#0f172a', g: '#22c55e' },
    map: [
      '....cccc....',
      '..cccccccc..',
      '.cccccccccc.',
      '.cckccckccc.',
      'cccccccccccc',
      '.cccccccccc.',
      '..g..gg..g..',
      '.ggg.gg.ggg.',
      '..g..gg..g..',
      '..gg.gg.gg..',
      '...g.gg..g..'
    ]
  },
  {
    name: 'O CEO que leu sobre IA e Blockchain no avião', from: 700, to: 1000, accent: '#fbbf24',
    palette: { y: '#fbbf24', h: '#9ca3af', f: '#fcd9b8', k: '#0f172a', m: '#92400e', s: '#1e293b', r: '#dc2626' },
    map: [
      '..y...y...y..',
      '..yyyyyyyyy..',
      '..hhhhhhhhh..',
      '..hfffffffh..',
      '..hfkfffkfh..',
      '..hfffffffh..',
      '...fffmfff...',
      '..sssssssss..',
      '.ssssrrssss..',
      '.sss.rr.sss..',
      '.sss.rr.sss..',
      '..ss.rr.ss...',
      '..ss....ss...'
    ]
  }
];

// Chefe atual para uma pontuação (null = todos resolvidos, >= 1000).
export const bossFor = (points) => BOSSES.find((b) => points < b.to) || null;
export const bossIndex = (boss) => BOSSES.indexOf(boss);
