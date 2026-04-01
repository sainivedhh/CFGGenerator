// ── LEXER ──────────────────────────────────────────────
const KEYWORDS = ['int', 'float', 'char', 'void', 'if', 'else', 'while', 'for', 'do', 'return', 'break', 'continue', 'struct', 'typedef', 'sizeof'];
const TYPES = ['int', 'float', 'char', 'double', 'long', 'short', 'void', 'unsigned', 'signed'];

function tokenize(src) {
  const tokens = [];
  const errors = [];
  let i = 0, line = 1;
  while (i < src.length) {
    if (src[i] === '\n') { line++; i++; continue; }
    if (/\s/.test(src[i])) { i++; continue; }
    if (src[i] === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (src[i] === '/' && src[i + 1] === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    if (src[i] === '#') { let j = i; while (j < src.length && src[j] !== '\n') j++; tokens.push({ type: 'DIRECTIVE', value: src.slice(i, j), line }); i = j; continue; }
    if (src[i] === '"') { let j = i + 1, s = '"'; while (j < src.length && src[j] !== '"') { s += src[j]; if (src[j] === '\\') j++; j++; } s += '"'; tokens.push({ type: 'STRING', value: s, line }); i = j + 1; continue; }
    if (src[i] === "'") { let j = i + 1, s = "'"; while (j < src.length && src[j] !== "'") { s += src[j]; j++; } s += "'"; tokens.push({ type: 'CHAR_LIT', value: s, line }); i = j + 1; continue; }
    if (/[0-9]/.test(src[i]) || (src[i] === '.' && /[0-9]/.test(src[i + 1]))) { let j = i; while (j < src.length && /[0-9.]/.test(src[j])) j++; tokens.push({ type: 'NUMBER', value: src.slice(i, j), line }); i = j; continue; }
    if (/[a-zA-Z_]/.test(src[i])) { let j = i; while (j < src.length && /\w/.test(src[j])) j++; const v = src.slice(i, j); let type = KEYWORDS.includes(v) ? 'KEYWORD' : 'IDENTIFIER'; tokens.push({ type, value: v, line }); i = j; continue; }
    const ops2 = ['==', '!=', '<=', '>=', '&&', '||', '++', '--', '+=', '-=', '*=', '/=', '->'];
    const op2 = src.slice(i, i + 2);
    if (ops2.includes(op2)) { tokens.push({ type: 'OPERATOR', value: op2, line }); i += 2; continue; }
    if ('+-*/%=<>!&|^~'.includes(src[i])) { tokens.push({ type: 'OPERATOR', value: src[i], line }); i++; continue; }
    if ('(){};,[]'.includes(src[i])) { tokens.push({ type: 'SEPARATOR', value: src[i], line }); i++; continue; }
    
    // Illegal Character Error
    errors.push(`Illegal character '${src[i]}' at line ${line}`);
    i++;
  }
  return { tokens, errors };
}

// ── PARSER (AST) ───────────────────────────────────────
function parseAST(tokens) {
  const nodes = [];
  const errors = [];
  let i = 0;
  function peek(off = 0) { return tokens[i + off]; }
  function eat() { return tokens[i++]; }
  function match(v) { 
    if (peek() && peek().value === v) { eat(); return true; } 
    const p = peek();
    errors.push(`Expected '${v}' but found '${p ? p.value : 'EOF'}' at line ${p ? p.line : 'EOF'}`);
    return false; 
  }
  
  function parseExpr(depth = 0) {
    let left = parsePrimary(depth);
    while (peek() && peek().type === 'OPERATOR' && '+-*/%<>==!=<=>=&&||'.includes(peek().value)) {
      const op = eat();
      const right = parsePrimary(depth);
      left = { type: 'BinaryExpr', op: op.value, left, right };
    }
    return left;
  }
  
  function parsePrimary(depth) {
    const t = peek();
    if (!t) return { type: 'Empty' };
    if (t.type === 'NUMBER') { eat(); return { type: 'Literal', value: t.value, dataType: 'int' }; }
    if (t.type === 'STRING') { eat(); return { type: 'StringLit', value: t.value }; }
    if (t.type === 'IDENTIFIER') {
      eat();
      if (peek() && peek().value === '(') {
        eat(); // (
        const args = [];
        while (peek() && peek().value !== ')') {
          args.push(parseExpr(depth + 1));
          if (peek() && peek().value === ',') eat();
          else if (peek() && peek().value !== ')') { /* error or continue */ }
        }
        match(')');
        return { type: 'FuncCall', name: t.value, args };
      }
      return { type: 'Identifier', name: t.value };
    }
    if (t.value === '(') { eat(); const e = parseExpr(depth + 1); match(')'); return e; }
    
    const errTok = eat();
    errors.push(`Unexpected token '${errTok.value}' during expression parsing at line ${errTok.line}`);
    return { type: 'Unknown', value: errTok.value };
  }
  
  function parseStmt() {
    const t = peek();
    if (!t) return null;
    
    // function definition
    if (t.type === 'KEYWORD' && TYPES.includes(t.value) && peek(1) && peek(1).type === 'IDENTIFIER' && peek(2) && peek(2).value === '(') {
      const retType = eat().value;
      const name = eat().value;
      eat(); // (
      const params = [];
      while (peek() && peek().value !== ')') {
        if (peek() && peek().type === 'KEYWORD') { const pt = eat().value; const pn = eat(); params.push({ type: pt, name: pn?.value || '' }); }
        else { 
          const errP = eat();
          errors.push(`Invalid parameter definition '${errP.value}' at line ${errP.line}`);
        }
        if (peek() && peek().value === ',') eat();
      }
      match(')');
      const body = parseBlock();
      return { type: 'FuncDef', retType, name, params, body };
    }
    
    // declaration
    if (t.type === 'KEYWORD' && TYPES.includes(t.value)) {
      const dtype = eat().value;
      const decls = [];
      while (true) {
        const name = eat();
        if (!name || name.type !== 'IDENTIFIER') {
          errors.push(`Expected identifier in declaration at line ${t.line}`);
          break;
        }
        let init = null;
        if (peek() && peek().value === '=') { eat(); init = parseExpr(); }
        decls.push({ name: name.value, init });
        if (peek() && peek().value === ',') { eat(); continue; }
        match(';'); break;
      }
      return { type: 'Declaration', dataType: dtype, decls };
    }
    
    // if
    if (t.value === 'if') {
      eat(); match('(');
      const cond = parseExpr(); match(')');
      const then = parseBlock();
      let els = null;
      if (peek() && peek().value === 'else') { eat(); els = parseBlock(); }
      return { type: 'If', cond, then, else: els };
    }
    
    // while
    if (t.value === 'while') {
      eat(); match('(');
      const cond = parseExpr(); match(')');
      const body = parseBlock();
      return { type: 'While', cond, body };
    }
    
    // for
    if (t.value === 'for') {
      eat(); match('(');
      const init = parseStmt();
      const cond = parseExpr(); match(';');
      const update = parseExpr(); match(')');
      const body = parseBlock();
      return { type: 'For', init, cond, update, body };
    }
    
    // return
    if (t.value === 'return') {
      eat();
      const val = peek() && peek().value !== ';' ? parseExpr() : null;
      match(';');
      return { type: 'Return', value: val };
    }
    
    // break/continue
    if (t.value === 'break' || t.value === 'continue') { const k = eat().value; match(';'); return { type: k.charAt(0).toUpperCase() + k.slice(1) }; }
    
    // block
    if (t.value === '{') return parseBlock();
    
    // expr or assignment
    if (t.type === 'IDENTIFIER' || t.type === 'KEYWORD') {
      const expr = parseExpr();
      if (peek() && peek().value === '=') {
        eat(); const rhs = parseExpr(); match(';');
        return { type: 'Assign', target: expr, value: rhs };
      }
      match(';');
      return { type: 'ExprStmt', expr };
    }
    
    const errTok = eat();
    errors.push(`Unexpected token '${errTok.value}' at line ${errTok.line}`);
    return null;
  }
  
  function parseBlock() {
    const stmts = [];
    if (peek() && peek().value === '{') {
      eat();
      while (peek() && peek().value !== '}') {
        const s = parseStmt();
        if (s) stmts.push(s);
      }
      match('}');
    } else {
      const s = parseStmt();
      if (s) stmts.push(s);
    }
    return { type: 'Block', stmts };
  }
  
  while (i < tokens.length) {
    const t = peek();
    if (!t) break;
    if (t.type === 'DIRECTIVE') { eat(); nodes.push({ type: 'Directive', value: t.value }); continue; }
    const s = parseStmt();
    if (s) nodes.push(s);
  }
  
  return { type: 'Program', body: nodes, errors };
}

// ── SEMANTIC ANALYSIS ──────────────────────────────────
function semanticAnalysis(ast, tokens) {
  const symTable = {};
  const globalErrors = [...(ast.errors || [])];
  const errors = [];
  const warnings = [];
  
  function walkAST(node, scope = {}) {
    if (!node) return;
    if (Array.isArray(node)) { node.forEach(n => walkAST(n, scope)); return; }

    if (node.type === 'FuncDef') {
      symTable[node.name] = { kind: 'function', retType: node.retType, params: node.params, line: '–' };
      const localScope = { ...scope };
      node.params.forEach(p => { localScope[p.name] = { type: p.type, kind: 'param' }; });
      walkAST(node.body, localScope);
      return;
    }
    
    if (node.type === 'Declaration') {
      node.decls.forEach(d => {
        if (scope[d.name]) warnings.push(`Variable '${d.name}' re-declared in same scope`);
        scope[d.name] = { type: node.dataType, kind: 'variable' };
        symTable[d.name] = { kind: 'variable', dataType: node.dataType, line: '–' };
        if (d.init) {
          walkAST(d.init, scope);
          if (d.init.evalType && d.init.evalType !== 'unknown' && node.dataType !== d.init.evalType) {
            if ((node.dataType === 'int' && d.init.evalType === 'char*') ||
              (node.dataType === 'char*' && d.init.evalType === 'int')) {
              warnings.push(`Type mismatch initializing '${d.name}': expected '${node.dataType}', got '${d.init.evalType}'`);
            }
          }
        }
      });
      return;
    }

    ['body', 'stmts', 'then', 'else', 'left', 'right', 'cond', 'init', 'update', 'expr', 'value', 'args'].forEach(k => {
      if (node[k]) {
        if (Array.isArray(node[k])) node[k].forEach(n => walkAST(n, scope));
        else if (typeof node[k] === 'object') walkAST(node[k], scope);
      }
    });

    if (node.type === 'Empty' || node.type === 'Unknown') {
      errors.push(`Syntax error or missing operand near '${node.value || '?'}'`);
      node.evalType = 'unknown';
      return;
    }
    if (node.type === 'Assign') {
      const name = node.target?.name;
      if (name && !scope[name] && !symTable[name]) {
        errors.push(`Undeclared variable '${name}' used in assignment`);
      } else if (name && node.value?.evalType) {
        const targetType = scope[name]?.type || symTable[name]?.dataType;
        if (targetType && targetType !== 'unknown' && node.value.evalType !== 'unknown') {
          if ((targetType === 'int' && node.value.evalType === 'char*') ||
            (targetType === 'char*' && node.value.evalType === 'int')) {
            warnings.push(`Type mismatch in assignment to '${name}': expected '${targetType}', got '${node.value.evalType}'`);
          }
        }
      }
      return;
    }
    if (node.type === 'FuncCall') {
      if (!symTable[node.name] && node.name !== 'printf' && node.name !== 'scanf' && node.name !== 'main')
        warnings.push(`Call to undeclared function '${node.name}'`);
      node.evalType = symTable[node.name]?.retType || 'int';
      return;
    }
    if (node.type === 'Identifier') {
      if (!scope[node.name] && !symTable[node.name] && node.name !== 'printf' && node.name !== 'scanf' && node.name !== 'main') {
        errors.push(`Undeclared identifier '${node.name}'`);
        node.evalType = 'unknown';
      } else {
        node.evalType = scope[node.name]?.type || symTable[node.name]?.dataType || 'int';
      }
      return;
    }
    if (node.type === 'Literal') {
      node.evalType = node.dataType || 'int';
      return;
    }
    if (node.type === 'StringLit') {
      node.evalType = 'char*';
      return;
    }
    if (node.type === 'BinaryExpr') {
      if (node.left?.evalType && node.right?.evalType) {
        node.evalType = node.left.evalType;
        if (node.left.evalType !== node.right.evalType && node.left.evalType !== 'unknown' && node.right.evalType !== 'unknown') {
          warnings.push(`Type mismatch in binary expression: '${node.left.evalType}' and '${node.right.evalType}'`);
        }
      } else {
        node.evalType = 'unknown';
      }
      return;
    }
  }
  
  walkAST(ast, {});
  return { symTable, errors: [...new Set(globalErrors.concat(errors))], warnings: [...new Set(warnings)] };
}

// ── TAC GENERATION ─────────────────────────────────────
function generateTAC(ast) {
  const instrs = [];
  let tmpCnt = 0, lblCnt = 0;
  
  function newTmp() { return 't' + (++tmpCnt); }
  function newLbl() { return 'L' + (++lblCnt); }
  function emit(instr) { instrs.push(instr); }
  
  function exprTAC(node) {
    if (!node) return '0';
    if (node.type === 'Literal') return node.value;
    if (node.type === 'StringLit') return node.value;
    if (node.type === 'Identifier') return node.name;
    if (node.type === 'BinaryExpr') {
      const l = exprTAC(node.left);
      const r = exprTAC(node.right);
      const t = newTmp();
      emit(`${t} = ${l} ${node.op} ${r}`);
      return t;
    }
    if (node.type === 'FuncCall') {
      const args = node.args.map(a => exprTAC(a));
      const t = newTmp();
      emit(`param ${args.join(', ')}`);
      emit(`${t} = call ${node.name}`);
      return t;
    }
    return '?';
  }
  
  function stmtTAC(node) {
    if (!node) return;
    if (node.type === 'Directive') return;
    if (node.type === 'Declaration') {
      node.decls.forEach(d => {
        if (d.init) { const v = exprTAC(d.init); emit(`${d.name} = ${v}`); }
      });
    }
    if (node.type === 'Assign') { const v = exprTAC(node.value); emit(`${node.target.name || '?'} = ${v}`); }
    if (node.type === 'ExprStmt') { exprTAC(node.expr); }
    if (node.type === 'FuncDef') {
      emit(`func_begin ${node.name}`);
      stmtTAC(node.body);
      emit(`func_end ${node.name}`);
    }
    if (node.type === 'Block') { node.stmts.forEach(stmtTAC); }
    if (node.type === 'If') {
      const Ltrue = newLbl(), Lfalse = newLbl(), Lend = newLbl();
      const cond = exprTAC(node.cond);
      emit(`if ${cond} goto ${Ltrue}`);
      emit(`goto ${Lfalse}`);
      emit(`${Ltrue}:`);
      stmtTAC(node.then);
      if (node.else) { emit(`goto ${Lend}`); emit(`${Lfalse}:`); stmtTAC(node.else); emit(`${Lend}:`); }
      else { emit(`${Lfalse}:`); }
    }
    if (node.type === 'While') {
      const Lstart = newLbl(), Lbody = newLbl(), Lend = newLbl();
      emit(`${Lstart}:`);
      const cond = exprTAC(node.cond);
      emit(`if ${cond} goto ${Lbody}`);
      emit(`goto ${Lend}`);
      emit(`${Lbody}:`);
      stmtTAC(node.body);
      emit(`goto ${Lstart}`);
      emit(`${Lend}:`);
    }
    if (node.type === 'Return') { const v = node.value ? exprTAC(node.value) : ''; emit(`return ${v}`); }
    if (node.type === 'Break') { emit('goto BREAK_TARGET'); }
  }
  
  ast.body.forEach(stmtTAC);
  return instrs;
}

// ── BASIC BLOCKS ───────────────────────────────────────
function identifyBasicBlocks(tac) {
  if (tac.length === 0) return [];
  const leaders = new Set([0]);
  tac.forEach((instr, i) => {
    const isLabel = instr.match(/^[A-Za-z_]\w*:$/);
    const isGoto = instr.match(/^goto\s+/);
    const isIfGoto = instr.match(/^if\s+.+\s+goto\s+/);
    const isReturn = instr.trim().startsWith('return');
    if (isLabel) leaders.add(i);
    if ((isGoto || isIfGoto || isReturn) && i + 1 < tac.length) leaders.add(i + 1);
  });
  const leaderArr = [...leaders].sort((a, b) => a - b);
  return leaderArr.map((start, idx) => {
    const end = leaderArr[idx + 1] ?? tac.length;
    return { id: 'B' + (idx + 1), instrs: tac.slice(start, end), start, end: end - 1 };
  });
}

// ── CFG EDGES ──────────────────────────────────────────
function buildCFG(blocks) {
  const edges = [];
  const labelMap = {};
  blocks.forEach(b => {
    b.instrs.forEach((instr, i) => {
      const m = instr.match(/^([A-Za-z_]\w*):$/);
      if (m) labelMap[m[1]] = b.id;
    });
  });
  
  blocks.forEach((b, i) => {
    const last = b.instrs[b.instrs.length - 1] || '';
    const ifm = last.match(/^if\s+(.+)\s+goto\s+(\w+)$/);
    const gm = last.match(/^goto\s+(\w+)$/);
    const ret = last.trim().startsWith('return');
    
    if (ifm) {
      const trueBlock = labelMap[ifm[2]];
      if (trueBlock) edges.push({ from: b.id, to: trueBlock, type: 'true' });
      if (i + 1 < blocks.length) edges.push({ from: b.id, to: blocks[i + 1].id, type: 'false' });
    } else if (gm) {
      const tgt = labelMap[gm[1]];
      if (tgt) edges.push({ from: b.id, to: tgt, type: 'unconditional' });
    } else if (!ret && i + 1 < blocks.length) {
      edges.push({ from: b.id, to: blocks[i + 1].id, type: 'fall-through' });
    } else if (ret) {
      for (let j = i + 1; j < blocks.length; j++) {
        if (blocks[j].instrs.some(ins => ins.trim().startsWith('func_end'))) {
          edges.push({ from: b.id, to: blocks[j].id, type: 'unconditional' });
          break;
        }
      }
    }
    
    // detect back edges
    edges.forEach(e => {
      const fromNum = parseInt(e.from.substring(1));
      const toNum = parseInt(e.to.substring(1));
      if (fromNum > toNum && e.type === 'unconditional') e.type = 'back-edge';
    });
  });
  return edges;
}

// ── CODE GEN ───────────────────────────────────────────
function generateCode(tac, symTable) {
  const asm = [];
  asm.push('; ── Assembly Output (x86-like pseudo-asm) ──');
  asm.push('section .data');
  Object.entries(symTable).forEach(([k, v]) => {
    if (v.kind === 'variable') asm.push(`    ${k} dd 0  ; ${v.dataType}`);
  });
  asm.push('');
  asm.push('section .text');
  asm.push('global main');
  tac.forEach(instr => {
    const isLabel = instr.match(/^([A-Za-z_]\w*):$/);
    const assignM = instr.match(/^(\w+)\s*=\s*(.+)$/);
    const ifm = instr.match(/^if\s+(\S+)\s+goto\s+(\w+)$/);
    const gm = instr.match(/^goto\s+(\w+)$/);
    const retm = instr.match(/^return\s*(.*)/);
    const funcBegin = instr.match(/^func_begin\s+(\w+)/);
    const funcEnd = instr.match(/^func_end\s+(\w+)/);
    if (isLabel) { asm.push(`${isLabel[1]}:`); }
    else if (funcBegin) { asm.push(`${funcBegin[1]}:`); asm.push('    push ebp'); asm.push('    mov ebp, esp'); }
    else if (funcEnd) { asm.push('    pop ebp'); asm.push('    ret'); }
    else if (ifm) { asm.push(`    cmp ${ifm[1]}, 0`); asm.push(`    jne ${ifm[2]}`); }
    else if (gm) { asm.push(`    jmp ${gm[1]}`); }
    else if (retm) { if (retm[1]) asm.push(`    mov eax, ${retm[1]}`); asm.push('    pop ebp'); asm.push('    ret'); }
    else if (assignM) {
      const lhs = assignM[1];
      const rhs = assignM[2].trim();
      const binM = rhs.match(/^(\S+)\s*([+\-*\/<>=!]+)\s*(\S+)$/);
      if (binM) {
        asm.push(`    mov eax, ${binM[1]}`);
        const op = { '+': 'add', '-': 'sub', '*': 'imul', '/': 'idiv', '<': 'cmp', '>': 'cmp', '<=': 'cmp', '>=': 'cmp', '==': 'cmp', '!=': 'cmp' }[binM[2]] || 'op';
        asm.push(`    ${op} eax, ${binM[3]}`);
        asm.push(`    mov ${lhs}, eax`);
      } else {
        asm.push(`    mov eax, ${rhs}`);
        asm.push(`    mov ${lhs}, eax`);
      }
    } else { asm.push(`    ; ${instr}`); }
  });
  return asm;
}
