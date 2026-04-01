# 🚀 Amrita Compiler Studio

[![Version](https://img.shields.io/badge/version-1.0.4--alpha-B91D1D.svg?style=flat-square)](file:///d:/Sem%206/Projects/automata/atdc/index.html)
[![Status](https://img.shields.io/badge/system-optimal-10B981.svg?style=flat-square)](file:///d:/Sem%206/Projects/automata/atdc/compiler.html)
[![License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](file:///d:/Sem%206/Projects/automata/atdc/README.md)

**Amrita Compiler Studio** is a premium, web-based interactive ecosystem designed to demystify the inner workings of compiler construction. From lexical analysis and semantic type-checking to Three-Address Code generation and Control-Flow Graph visualization, this studio provides a real-time, side-by-side view of every compilation phase—all wrapped in a state-of-the-art developer interface.

---

## ✨ Key Features

- 🛠️ **Real-time Compilation**: Instant feedback as you type C-like source code.
- 🌳 **AST Visualization**: Interactive, high-fidelity SVG tree rendering with cubic-bézier paths.
- 📋 **TAC Generation**: Automatic lowering of hierarchical ASTs into linear Three-Address Code (TAC).
- 🧭 **CFG Flow Mapping**: Visual mapping of execution paths, basic blocks, and loop detection.
- 💎 **Premium UI**: Modern glassmorphism aesthetic with theme-aware persistence (Light/Dark mode).
- 📜 **Full-Featured Editor**: Powered by **Monaco Editor** (the engine behind VS Code).

---

## 🏗️ Architecture & Phases

1.  **Lexical Analysis**: Live tokenization recognizing identifiers, datatypes, and control-flow keywords.
2.  **AST Generation**: Recursive-descent parsing with syntactic validation.
3.  **Semantic Analysis**: Robust symbol-table mapping with post-order traversal and type-safety checks.
4.  **Intermediate Representation (IR)**: Flattening logic into temporary variables and explicit jumps.
5.  **Control-Flow Graph (CFG)**: Splitting TAC into basic blocks and calculating directed execution edges.

---

## 🛠️ Technology Stack

- **Frontend**: HTML5, Vanilla JavaScript, CSS3
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) (Modern layout & spacing)
- **Editor**: [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- **Visuals**: SVG (Scalable Vector Graphics) for high-performance canvas-less rendering.
- **Animations**: Custom CSS Keyframes (Dancing cards, smooth floats).

---

## 🚀 Getting Started

1.  Clone the repository:
    ```bash
    git clone https://github.com/sainivedhh/CFGGenerator.git
    ```
2.  Open `index.html` in any modern web browser.
3.  Navigate to **Showcase** to start coding!

> [!TIP]
> **Pro Tip**: Use the **Watch it Flow** button in the studio to see your code transform across all phases simultaneously.

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

## 🤝 Acknowledgments

- **Amrita Vishwa Vidyapeetham** — For the architectural inspiration.
- **Monaco Editor Team** — For the world-class editing experience.
- **Tailwind CSS** — For the sleek design tokens.

---
© 2026 Sai's Studio. Defining the new standard for developer toolkits.
