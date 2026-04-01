// ── STATE ──────────────────────────────────────────────
let compiledData = null;

// ── UTILS ──────────────────────────────────────────────
function esc(s) {
  if (s === undefined || s === null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function setStatus(type, msg) {
  const dot = document.getElementById('status-dot');
  const txt = document.getElementById('status-txt');
  if (!dot || !txt) return;
  dot.className = '';
  txt.style.color = 'var(--text2)';
  if (type === 'busy') { dot.classList.add('busy'); txt.textContent = msg; }
  else if (type === 'error') { dot.classList.add('error'); txt.textContent = msg; txt.style.color = '#EF4444'; }
  else if (type === 'ok') { dot.classList.add('ok'); txt.textContent = msg; txt.style.color = '#10B981'; }
  else { txt.textContent = msg; }
}

// ── EDITOR OVERLAYS ────────────────────────────────────
function updateLines() {
  const ta = document.getElementById('code-input');
  const ln = document.getElementById('line-nums');
  if (!ta || !ln) return;
  const lines = ta.value.split('\n').length;
  ln.innerHTML = Array.from({ length: lines }, (_, i) => `<div>${i + 1}</div>`).join('');
}

function syncScroll() {
  const ta = document.getElementById('code-input');
  const ln = document.getElementById('line-nums');
  if (ln && ta) ln.scrollTop = ta.scrollTop;
}

// ── PHASE NAVIGATION ───────────────────────────────────
function selectPhase(name) {
  document.querySelectorAll('.out-tab').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.phase-panel').forEach(el => el.classList.remove('active', 'animate-in'));

  const pItem = document.getElementById('ot-' + name);
  if (pItem) pItem.classList.add('active');
  const pp = document.getElementById('p-' + name);
  if (pp) {
    pp.classList.add('active');
    setTimeout(() => pp.classList.add('animate-in'), 10);
  }
}

// ── SVG ANIMATIONS ─────────────────────────────────────
const svgStyle = `
<style>
  .draw-edge { stroke-dasharray: 2000; stroke-dashoffset: 2000; animation: drawLine 1.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
  @keyframes drawLine { to { stroke-dashoffset: 0; } }
  .fade-node { opacity: 0; animation: fadeInNode 0.8s ease-out forwards; animation-delay: 0.5s; }
  @keyframes fadeInNode { to { opacity: 1; } }
</style>
`;

// ── RENDERERS ──
function renderLexical(tokens, errors = []) {
  const chipClass = {
    KEYWORD: 'chip-kw', IDENTIFIER: 'chip-id', NUMBER: 'chip-num', OPERATOR: 'chip-op',
    SEPARATOR: 'chip-sep', STRING: 'chip-str', DIRECTIVE: 'chip-kw', CHAR_LIT: 'chip-str', FUNCTION: 'chip-id'
  };

  const stream = tokens.map(t => `<span class="tok-chip ${chipClass[t.type] || 'chip-sep'}">${esc(t.value)}</span>`).join('');
  const rows = tokens.map(t => `<tr><td>${esc(t.value)}</td><td>${t.type}</td><td>${t.line}</td></tr>`).join('');
  
  const errHTML = errors.map(e => `<div class="msg err">⚠️ ${esc(e)}</div>`).join('');
  const okMsg = errors.length === 0 
    ? `<div class="success-banner"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Lexical scan completed — ${tokens.length} tokens identified.</div>`
    : errHTML;

  document.getElementById('p-lexical').innerHTML = `
    ${okMsg}
    <div class="lex-section-title">Token Stream</div>
    <div class="tok-stream">${stream}</div>

    <div class="lex-section-title">Token Classification</div>
    <div class="table-wrap">
      <table class="tok-table">
        <thead>
          <tr><th>LEXEME</th><th>CATEGORY</th><th>LINE</th></tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>`;
}

function buildParseTreeSvg(ast) {
  let idCnt = 0;
  function buildNode(n) {
    const node = { id: 'N' + (++idCnt), type: n.type, label: n.type, children: [], width: 110, height: 40, x: 0, y: 0 };
    if (n.value !== undefined && typeof n.value !== 'object') node.label += '\\n' + n.value;
    if (n.name) node.label += '\\n' + n.name;
    if (n.op) node.label += '\\n' + n.op;
    if (n.dataType || n.retType) node.label += '\\n' + (n.dataType || n.retType);

    const lines = node.label.split('\\n');
    node.height = 20 + lines.length * 12;

    const childrenKeys = ['body', 'stmts', 'then', 'else', 'decls', 'params', 'args', 'left', 'right', 'init', 'cond', 'update', 'value'];
    childrenKeys.forEach(k => {
      const v = n[k];
      if (!v) return;
      if (Array.isArray(v)) { v.forEach(c => { if (typeof c === 'object' && c) node.children.push(buildNode(c)); }); }
      else if (typeof v === 'object') { node.children.push(buildNode(v)); }
    });
    return node;
  }

  const root = buildNode(ast);
  const GAP_X = 20, GAP_Y = 50;

  function calcWidth(n) {
    if (n.children.length === 0) { n.subW = n.width; }
    else {
      n.children.forEach(calcWidth);
      n.subW = n.children.reduce((acc, c) => acc + c.subW + GAP_X, 0) - GAP_X;
      n.subW = Math.max(n.width, n.subW);
    }
  }
  calcWidth(root);

  let maxX = 0, maxY = 0;
  function assignCoords(n, x, y) {
    n.x = x + n.subW / 2;
    n.y = y;
    maxX = Math.max(maxX, n.x + n.width / 2);
    maxY = Math.max(maxY, n.y + n.height);

    let currX = x;
    n.children.forEach(c => {
      assignCoords(c, currX, y + n.height + GAP_Y);
      currX += c.subW + GAP_X;
    });
  }
  assignCoords(root, 20, 20);

  let svgLinks = '', svgNodes = '';
  function render(n) {
    n.children.forEach(c => {
      svgLinks += `<path class="draw-edge" d="M${n.x},${n.y + n.height} C${n.x},${n.y + n.height + GAP_Y / 2} ${c.x},${c.y - GAP_Y / 2} ${c.x},${c.y}" stroke="var(--border)" stroke-width="2" fill="none"/>`;
      render(c);
    });
    const lines = n.label.split('\\n');
    const textHtml = lines.map((l, i) => `<text x="${n.x}" y="${n.y + 16 + i * 12}" fill="${i === 0 ? 'var(--text)' : 'var(--text2)'}" font-size="${i === 0 ? '11' : '10'}" font-family="'JetBrains Mono',monospace" font-weight="${i === 0 ? 'bold' : 'normal'}" text-anchor="middle">${esc(l)}</text>`).join('');
    const borderCol = n.children.length ? 'var(--accent)' : 'var(--color-str)';
    svgNodes += `
      <g class="fade-node">
        <rect x="${n.x - n.width / 2}" y="${n.y}" width="${n.width}" height="${n.height}" rx="6" fill="var(--bg3)" stroke="${borderCol}" stroke-width="1.5"/>
        ${textHtml}
      </g>
    `;
  }
  render(root);

  const svgW = maxX + 40, svgH = maxY + 40;
  return `
    <div class="table-wrap" style="padding:24px;overflow:auto;margin-bottom:24px;">
      <svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:auto;">
        ${svgStyle}
        ${svgLinks}
        ${svgNodes}
      </svg>
    </div>`;
}

function astToHTML(node, indent = 0) {
  if (!node) return '';
  const pad = '  '.repeat(indent);
  const nodeName = `<span style="color:var(--accent)">${node.type}</span>`;
  const parts = [];
  if (node.value !== undefined && typeof node.value !== 'object') parts.push(`<span style="color:var(--color-num)">${esc(String(node.value))}</span>`);
  if (node.name) parts.push(`name: <span style="color:var(--color-id)">${esc(node.name)}</span>`);
  if (node.op) parts.push(`op: <span style="color:#fff">${esc(node.op)}</span>`);
  if (node.dataType || node.retType) parts.push(`type: <span style="color:var(--color-kw)">${esc(node.dataType || node.retType)}</span>`);
  let html = `${pad}${nodeName}${parts.length ? ' (' + parts.join(', ') + ')' : ''}\n`;
  const children = ['body', 'stmts', 'then', 'else', 'decls', 'params', 'args', 'left', 'right', 'init', 'cond', 'update', 'value'];
  children.forEach(k => {
    const v = node[k];
    if (!v) return;
    if (Array.isArray(v)) { if (v.length) html += `${pad}  ${k}:\n` + v.map(c => typeof c === 'object' && c ? astToHTML(c, indent + 2) : `${'  '.repeat(indent + 2)}<span style="color:var(--text2)">${esc(JSON.stringify(c))}</span>\n`).join(''); }
    else if (typeof v === 'object') { html += `${pad}  ${k}:\n` + astToHTML(v, indent + 2); }
  });
  return html;
}

function renderSyntax(ast) {
  document.getElementById('p-syntax').innerHTML = `
    <div class="lex-section-title">Parse Tree (Visual AST)</div>
    ${buildParseTreeSvg(ast)}
    <div class="lex-section-title">Abstract Syntax Tree (Object Model)</div>
    <div class="table-wrap" style="padding:24px;">
      <pre style="white-space:pre;font-family:'JetBrains Mono',monospace;font-size:12px;line-height:1.7;color:var(--text2)">${astToHTML(ast)}</pre>
    </div>`;
}

function renderSemantic(sem) {
  const errHTML = sem.errors.map(e => `<div class="msg err">⚠️ ${esc(e)}</div>`).join('');
  const warnHTML = sem.warnings.map(w => `<div class="msg warn">⚠️ ${esc(w)}</div>`).join('');
  const okMsg = sem.errors.length === 0 ? `<div class="success-banner"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Semantic analysis passed — completely type safe.</div>` : '';
  const symRows = Object.entries(sem.symTable).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v.kind}</td><td>${v.dataType || v.retType || '–'}</td><td>${v.line || '–'}</td></tr>`).join('');
  document.getElementById('p-semantic').innerHTML = `
    <div class="lex-section-title">Analysis Matrix</div>
    ${okMsg}${errHTML}${warnHTML}
    
    <div class="lex-section-title">Symbol Table Hash Map</div>
    <div class="table-wrap">
      <table class="tok-table">
        <thead><tr><th>NAME</th><th>KIND</th><th>TYPE</th><th>SCOPE DATA</th></tr></thead>
        <tbody>${symRows}</tbody>
      </table>
    </div>`;
}

function renderIR(tac) {
  function colorize(instr) {
    return instr
      .replace(/\b(if|goto|return|param|call|func_begin|func_end)\b/g, '<span style="color:var(--color-kw)">$1</span>')
      .replace(/\b(t\d+)\b/g, '<span style="color:#C084FC">$1</span>')
      .replace(/\b(L\d+)\b/g, '<span style="color:var(--color-kw)">$1</span>')
      .replace(/\b(\d+)\b/g, '<span style="color:var(--color-num)">$1</span>');
  }
  const lines = tac.map((instr, i) => {
    const isLabel = instr.match(/^[A-Za-z_]\w*:$/);
    if (isLabel) return `<div style="display:flex;margin-bottom:4px">
        <span style="width:30px;color:var(--text3)"></span>
        <span style="color:#FCD34D">${esc(instr)}</span>
      </div>`;
    return `<div style="display:flex;margin-bottom:4px">
        <span style="width:30px;color:var(--text3)">${i + 1}</span>
        <span style="color:var(--text)">${colorize(esc(instr))}</span>
      </div>`;
  }).join('');
  document.getElementById('p-ir').innerHTML = `
    <div class="lex-section-title">Three-Address Code (TAC)</div>
    <div class="table-wrap" style="padding:24px;font-family:'JetBrains Mono',monospace;font-size:13px">${lines}</div>`;
}

function renderCodeGen(asm) {
  const html = asm.map(l => {
    if (l.startsWith(';')) return `<div style="color:var(--text3)">${esc(l)}</div>`;
    if (l.match(/^\w+:$/)) return `<div style="color:#FCD34D">${esc(l)}</div>`;
    if (l.trim().startsWith('section')) return `<div style="color:#C084FC">${esc(l)}</div>`;
    if (l.trim().startsWith('global')) return `<div style="color:#38BDF8">${esc(l)}</div>`;
    const parts = l.replace(/^\s+/, '').split(/\s+/);
    const mnemonic = parts[0];
    const mnems = ['mov', 'add', 'sub', 'imul', 'idiv', 'cmp', 'jne', 'jmp', 'jl', 'jg', 'je', 'push', 'pop', 'ret', 'xor', 'and', 'or', 'call', 'dd', 'dw', 'db'];
    if (mnems.includes(mnemonic)) return `<div style="padding-left:20px"><span style="color:#F472B6">${esc(mnemonic)}</span> <span style="color:var(--text)">${esc(parts.slice(1).join(' '))}</span></div>`;
    return `<div style="padding-left:20px;color:var(--text2)">${esc(l)}</div>`;
  }).join('');
  document.getElementById('p-codegen').innerHTML = `
    <div class="lex-section-title">Assembly Generation (x86 Architecture)</div>
    <div class="table-wrap" style="padding:24px;font-family:'JetBrains Mono',monospace;font-size:13px">${html}</div>`;
}

function buildCFGSvg(blocks, edges) {
  const NODE_W = 180; const NODE_PAD = 14; const LINE_H = 15;
  const GAP_Y = 72; const GAP_X = 220; const PAD = 40;

  function nodeHeight(b) {
    const lines = Math.min(b.instrs.length, 6);
    return NODE_PAD * 2 + 18 + lines * LINE_H;
  }

  const positions = {}; let y = PAD;
  const trueOnlyTargets = new Set();
  edges.forEach(e => { if (e.type === 'true') trueOnlyTargets.add(e.to); });
  edges.forEach(e => { if (e.type === 'false' || e.type === 'fall-through') trueOnlyTargets.delete(e.to); });

  blocks.forEach(b => { positions[b.id] = { x: PAD, y }; y += nodeHeight(b) + GAP_Y; });
  trueOnlyTargets.forEach(id => { if (positions[id]) positions[id].x = PAD + GAP_X; });

  const maxX = Math.max(...Object.values(positions).map(p => p.x)) + NODE_W + PAD;
  const maxY = Math.max(...blocks.map(b => positions[b.id].y + nodeHeight(b))) + PAD;

  const edgeMeta = {
    'true': { stroke: '#10B981', label: 'T', lblColor: '#10B981' },
    'false': { stroke: '#EF4444', label: 'F', lblColor: '#EF4444' },
    'fall-through': { stroke: '#3B82F6', label: '↓', lblColor: '#3B82F6' },
    'unconditional': { stroke: '#4B5563', label: '→', lblColor: '#4B5563' },
    'back-edge': { stroke: '#8B5CF6', label: '↺', lblColor: '#8B5CF6' },
  };

  let defs = `<defs>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="115%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="rgba(0,0,0,0.5)"/>
    </filter>`;
  Object.entries(edgeMeta).forEach(([type, m]) => {
    const safe = type.replace(/[^a-z]/g, '');
    defs += `<marker id="arr-${safe}" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="${m.stroke}"/></marker>`;
  });
  defs += '</defs>';

  let svgEdges = '', svgNodes = '';
  edges.forEach(e => {
    const sp = positions[e.from], tp = positions[e.to];
    if (!sp || !tp) return;
    const sh = nodeHeight(blocks.find(b => b.id === e.from) || blocks[0]);
    const th = nodeHeight(blocks.find(b => b.id === e.to) || blocks[0]);
    const sx = sp.x + NODE_W / 2; const sy = sp.y + sh;
    const tx = tp.x + NODE_W / 2; const ty = tp.y;
    const m = edgeMeta[e.type] || edgeMeta['unconditional'];
    const safe = e.type.replace(/[^a-z]/g, '');

    let path;
    if (e.type === 'back-edge') {
      const rx = Math.max(sp.x, tp.x) + NODE_W + 32;
      path = `M${sp.x + NODE_W},${sp.y + sh / 2} C${rx},${sp.y + sh / 2} ${rx},${tp.y + th / 2} ${tp.x + NODE_W},${tp.y + th / 2}`;
      svgEdges += `<path class="draw-edge" d="${path}" fill="none" stroke="${m.stroke}" stroke-width="2" marker-end="url(#arr-${safe})" stroke-dasharray="2000" stroke-dashoffset="2000"/>`;
    } else if (sp.x !== tp.x) {
      const midY = sy + 20; path = `M${sx},${sy} L${sx},${midY} L${tx},${midY} L${tx},${ty}`;
      svgEdges += `<path class="draw-edge" d="${path}" fill="none" stroke="${m.stroke}" stroke-width="2" marker-end="url(#arr-${safe})"/>`;
    } else {
      const cy = (sy + ty) / 2; path = `M${sx},${sy} C${sx},${cy} ${tx},${cy} ${tx},${ty}`;
      svgEdges += `<path class="draw-edge" d="${path}" fill="none" stroke="${m.stroke}" stroke-width="2" marker-end="url(#arr-${safe})"/>`;
    }
  });

  blocks.forEach(b => {
    const { x, y } = positions[b.id];
    const h = nodeHeight(b);
    const lastInstr = b.instrs[b.instrs.length - 1] || '';
    const isEntry = b.id === 'B1';
    const isExit = lastInstr.trim().startsWith('return') || lastInstr.trim().startsWith('func_end');

    const headerFill = isEntry ? 'var(--cfg-hdr-entry-bg)' : isExit ? 'var(--cfg-hdr-exit-bg)' : 'var(--cfg-hdr-def-bg)';
    const headerCol = isEntry ? 'var(--cfg-hdr-entry-fg)' : isExit ? 'var(--cfg-hdr-exit-fg)' : 'var(--cfg-hdr-def-fg)';
    const borderCol = isEntry ? 'var(--cfg-hdr-entry-bg)' : isExit ? 'var(--cfg-hdr-exit-bg)' : 'var(--border-light)';
    const HEADER_H = 26;

    svgNodes += `<g filter="url(#shadow)" class="fade-node">`;
    svgNodes += `<rect x="${x}" y="${y}" width="${NODE_W}" height="${h}" rx="10" fill="var(--bg3)" stroke="${borderCol}" stroke-width="1.5"/>`;
    svgNodes += `<clipPath id="hclip-${b.id}"><rect x="${x}" y="${y}" width="${NODE_W}" height="${HEADER_H}" rx="10"/></clipPath>`;
    svgNodes += `<rect x="${x}" y="${y}" width="${NODE_W}" height="${HEADER_H + 4}" fill="${headerFill}" clip-path="url(#hclip-${b.id})"/>`;
    svgNodes += `<text x="${x + 10}" y="${y + 17}" fill="${headerCol}" font-size="11" font-weight="700">${b.id}${isEntry ? ' ENTRY' : isExit ? ' EXIT' : ''}</text>`;

    const shown = b.instrs.slice(0, 6);
    shown.forEach((instr, i) => {
      const t = instr.length > 24 ? instr.slice(0, 23) + '…' : instr;
      svgNodes += `<text x="${x + 10}" y="${y + HEADER_H + 15 + i * LINE_H}" fill="var(--text)" font-size="10" font-family="'JetBrains Mono',monospace">${esc(t)}</text>`;
    });
    if (b.instrs.length > 6) {
      svgNodes += `<text x="${x + NODE_W / 2}" y="${y + h - 6}" fill="var(--text3)" font-size="9" text-anchor="middle">+${b.instrs.length - 6} more lines</text>`;
    }
    svgNodes += `</g>`;
  });

  const svgW = Math.max(maxX + 40, 420);
  const svgH = Math.max(maxY, 300);
  return `
    <div class="table-wrap" style="padding:24px;overflow:auto;display:flex;justify-content:center;">
      <svg id="cfg-svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" style="display:block;">
        ${svgStyle}
        ${defs}
        ${svgEdges}
        ${svgNodes}
      </svg>
    </div>`;
}

function renderCFG(blocks, edges, tac) {
  if (blocks.length === 0) { document.getElementById('p-cfg').innerHTML = '<div class="msg warn">No basic blocks found.</div>'; return; }
  const svg = buildCFGSvg(blocks, edges);
  const btnStyle = "background: transparent; border: 1px solid var(--border); color: var(--text); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-family: 'JetBrains Mono', monospace; cursor: pointer;";
  document.getElementById('p-cfg').innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
      <div class="lex-section-title" style="margin-bottom:0;">Control-Flow Intelligence</div>
      <div style="display:flex; gap:8px;">
        <button onclick="exportCFG('svg')" style="${btnStyle}" onmouseover="this.style.background='var(--bg3)'" onmouseout="this.style.background='transparent'">.SVG</button>
        <button onclick="exportCFG('json')" style="${btnStyle}" onmouseover="this.style.background='var(--bg3)'" onmouseout="this.style.background='transparent'">.JSON</button>
        <button onclick="exportCFG('dot')" style="${btnStyle}" onmouseover="this.style.background='var(--bg3)'" onmouseout="this.style.background='transparent'">.DOT</button>
      </div>
    </div>
    ${svg}`;
}

// ── EXPORT ENGINE ──
window.exportCFG = function(format) {
  if (!compiledData || !compiledData.blocks) return alert('No compilation data found. Please compile first.');
  const { blocks, edges } = compiledData;
  let dataStr = '', mimeType = '', filename = '';

  if (format === 'svg') {
    const svgNode = document.getElementById('cfg-svg');
    if (!svgNode) return alert('No SVG generated yet.');
    dataStr = svgNode.outerHTML;
    mimeType = 'image/svg+xml';
    filename = 'cfg_intelligence.svg';
  } else if (format === 'json') {
    const exportObj = {
      compiler: "Amrita Studio - V0.9.1",
      blocks: blocks.map(b => ({ id: b.id, instrs: b.instrs })),
      edges: edges.map(e => ({ from: e.from, to: e.to, type: e.type, condition: e.condition }))
    };
    dataStr = JSON.stringify(exportObj, null, 2);
    mimeType = 'application/json';
    filename = 'cfg_data.json';
  } else if (format === 'dot') {
    dataStr = 'digraph CFG {\\n  node [fontname="JetBrains Mono", shape=box, style=filled, fillcolor="#161B22", color="#30363D", fontcolor="#E5E7EB"];\\n  edge [fontname="JetBrains Mono", fontcolor="#9CA3AF"];\\n  bgcolor="#0D1117";\\n\\n';
    blocks.forEach(b => {
      const instrText = b.instrs.join('\\n').replace(/"/g, '\\"');
      const label = b.id + '\\n' + instrText;
      dataStr += `  ${b.id} [label="${label}"];\\n`;
    });
    edges.forEach(e => {
      let color = '#4B5563';
      let label = '';
      if(e.type === 'true') { color = '#10B981'; label = 'T'; }
      else if(e.type === 'false') { color = '#EF4444'; label = 'F'; }
      else if(e.type === 'back-edge') { color = '#8B5CF6'; label = '↺'; }
      dataStr += `  ${e.from} -> ${e.to} [color="${color}", label="${label}"];\\n`;
    });
    dataStr += '}\\n';
    mimeType = 'text/plain';
    filename = 'cfg_graph.dot';
  }

  const blob = new Blob([dataStr], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// ── ORCHESTRATOR ──
function compile() {
  const src = document.getElementById('code-input').value.trim();
  if (!src) { alert('Please write some code first!'); return; }
  setStatus('busy', 'Building system intelligence...');

  document.querySelectorAll('.phase-panel').forEach(p => p.innerHTML = '<div style="padding:120px;text-align:center;color:var(--text3)">Processing logic flows...</div>');

  setTimeout(() => {
    try {
      const { tokens, errors: lexErrors } = tokenize(src);
      renderLexical(tokens, lexErrors);
      
      const ast = parseAST(tokens);
      renderSyntax(ast);
      
      const sem = semanticAnalysis(ast, tokens);
      renderSemantic(sem);

      if (lexErrors.length > 0 || sem.errors.length > 0) {
        setStatus('error', 'Error occurred in code');
        const firstErrPhase = lexErrors.length > 0 ? 'lexical' : 'semantic';
        
        // Update unrendered panels with error message
        document.querySelectorAll('.phase-panel').forEach(p => {
          if (!p.classList.contains('active')) {
            p.innerHTML = '<div style="padding:120px;text-align:center;color:var(--text3)">Error occurred in code</div>';
          }
        });
        
        selectPhase(firstErrPhase);
        return;
      }

      const tac = generateTAC(ast);
      renderIR(tac);
      const asm = generateCode(tac, sem.symTable);
      renderCodeGen(asm);
      const blocks = identifyBasicBlocks(tac);
      const edges = buildCFG(blocks);
      compiledData = { tokens, ast, sem, tac, asm, blocks, edges };
      
      renderCFG(blocks, edges, tac);
      setStatus('ok', 'System deployed successfully.');
      setTimeout(() => { selectPhase('lexical'); }, 300);

    } catch (err) {
      console.error(err);
      setStatus('error', 'Critical Exception: ' + err.message);
    }
  }, 300);
}

// Ensure event listeners are attached
if (document.getElementById('code-input')) {
  document.getElementById('code-input').addEventListener('input', updateLines);
  document.getElementById('code-input').addEventListener('scroll', syncScroll);
  document.getElementById('code-input').addEventListener('keydown', e => {
      if (e.key === 'Tab') { e.preventDefault(); const s = e.target.selectionStart; e.target.value = e.target.value.substring(0, s) + '    ' + e.target.value.substring(e.target.selectionEnd); e.target.selectionStart = e.target.selectionEnd = s + 4; updateLines(); }
  });
  updateLines();
}
