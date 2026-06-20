# SIPREH Manual — LaTeX Setup Guide

This guide covers everything needed to compile `main.tex` on **Linux** and **Windows**.
The project uses **XeLaTeX** (required for the Roboto font via `fontspec`).

---

## 1 · Install a LaTeX Distribution

### Linux (Ubuntu / Debian)

```bash
# Full TeX Live — recommended (includes all packages)
sudo apt-get update
sudo apt-get install texlive-full

# Minimal alternative (installs only what is needed)
sudo apt-get install texlive-xetex texlive-latex-extra \
     texlive-fonts-extra texlive-lang-spanish \
     texlive-science texlive-pictures
```

Verify the installation:
```bash
xelatex --version
```

### Windows

1. Download **MiKTeX** from <https://miktex.org/download> and run the installer.
2. During setup, choose **"Install missing packages on-the-fly → Yes"** so MiKTeX
   downloads any package automatically on first compile.
3. After installation, open **MiKTeX Console** → **Updates** → **Check for updates**
   and install all pending updates.
4. Verify by opening a terminal (PowerShell or CMD):
   ```powershell
   xelatex --version
   ```

---

## 2 · Install the Roboto Font

The project uses `\setmainfont{Roboto}` via `fontspec`. XeLaTeX looks for fonts
installed at the OS level, not in TeX's font directory.

### Linux

```bash
# Option A — package manager
sudo apt-get install fonts-roboto

# Option B — manual (Google Fonts)
# Download from https://fonts.google.com/specimen/Roboto
# Unzip and copy .ttf files to ~/.fonts/  (user) or /usr/share/fonts/ (system)
# Then rebuild the font cache:
fc-cache -fv

# Verify Roboto is found
fc-list | grep -i roboto
```

### Windows

1. Open any browser and go to <https://fonts.google.com/specimen/Roboto>.
2. Click **"Get font"** → **"Download all"** to download the ZIP.
3. Unzip and select all `.ttf` files, right-click → **"Install for all users"**.
4. No restart needed — XeLaTeX should find the font immediately.

---

## 3 · Required LaTeX Packages

All packages below ship with **TeX Live Full** / **MiKTeX** auto-install.
If you used a minimal install, add them manually:

| Package | Purpose |
|---|---|
| `fontspec` | Load system fonts (Roboto) with XeLaTeX |
| `babel` (spanish) | Spanish hyphenation and active characters |
| `tikz` + `pgfplots` | Architecture diagram and flowcharts |
| `tcolorbox` | `definition` / `remark` / `example` coloured boxes |
| `booktabs` | Publication-quality tables |
| `hyperref` | PDF bookmarks and cross-references |
| `fvextra` | Verbatim code blocks |
| `float` | `[H]` float placement for figures |
| `xcolor` | Colour definitions used throughout `bbe.cls` |

Install missing packages on Linux:
```bash
sudo apt-get install texlive-pictures texlive-latex-extra texlive-science
```

On MiKTeX, they are installed automatically on first compile.

---

## 4 · Compile the Project

**XeLaTeX must be run twice** so cross-references (Table of Contents, figure
numbers, `\ref{}`) resolve correctly.

### Terminal (Linux / Windows PowerShell)

```bash
# From inside the SIPREH_manual/ directory:
cd documents/manual/SIPREH_manual

xelatex main.tex
xelatex main.tex        # second pass to resolve references
```

The output is `main.pdf` in the same directory.

### Makefile shortcut (Linux)

```bash
# Run from SIPREH_manual/
make          # runs xelatex twice
make clean    # removes .aux, .log, .toc, .out
```

Create `Makefile` if it doesn't exist:
```makefile
.PHONY: all clean

all:
	xelatex -interaction=nonstopmode main.tex
	xelatex -interaction=nonstopmode main.tex

clean:
	rm -f *.aux *.log *.toc *.out *.synctex.gz *.fls *.fdb_latexmk
```

---

## 5 · VSCode Setup

### 5.1 · Install the LaTeX Workshop Extension

1. Open VSCode → Extensions (Ctrl+Shift+X).
2. Search **"LaTeX Workshop"** by James Yu → **Install**.

### 5.2 · Configure XeLaTeX as the Default Recipe

Open **Settings** (Ctrl+,) → search `latex-workshop.latex.recipes` →
click **"Edit in settings.json"** and add:

```json
"latex-workshop.latex.recipes": [
  {
    "name": "xelatex × 2",
    "tools": ["xelatex", "xelatex"]
  }
],
"latex-workshop.latex.tools": [
  {
    "name": "xelatex",
    "command": "xelatex",
    "args": [
      "-synctex=1",
      "-interaction=nonstopmode",
      "-file-line-error",
      "%DOC%"
    ],
    "env": {}
  }
],
"latex-workshop.latex.autoBuild.run": "onSave"
```

> **Tip:** `"autoBuild.run": "onSave"` recompiles every time you save a `.tex` file.
> Set to `"never"` if you prefer to trigger builds manually with **Ctrl+Alt+B**.

### 5.3 · Useful VSCode Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Alt+B` | Build / compile |
| `Ctrl+Alt+V` | Open PDF preview |
| `Ctrl+Click` (in PDF) | Jump to source line (SyncTeX) |
| `Ctrl+Alt+J` | Jump from source to PDF |

### 5.4 · Recommended Additional Extensions

- **Spell Right** or **LTeX** — spell and grammar check in Spanish.
- **Better Comments** — colour-coded LaTeX comments.

---

## 6 · Troubleshooting

### Font not found: `! Package fontspec Error: The font "Roboto" cannot be found.`

The Roboto font is not installed at the OS level. Follow Section 2 above.

### `Missing character: There is no X in font ...`

A Unicode character is used in a context where the current font lacks it.
- In **math mode**, use `$^{\circ}$` instead of `°`, and `$\to$` instead of `→`.
- In **TikZ nodes**, these characters are safe as long as Roboto is set as the main font.

### TikZ / babel conflict: `Paragraph ended before \pgfkeys@splitter`

This happens when Spanish babel's active `>` character conflicts with TikZ arrow syntax.
The fix is already in `main.tex`:
```latex
\usetikzlibrary{..., babel}
```
Never remove `babel` from the `\usetikzlibrary` list.

### Blank pages between chapters

`book` class starts chapters on odd pages by default. The project already includes
`openany` in the document class:
```latex
\documentclass[12pt,a4paper,violet,openany]{bbe}
```

### Cross-references show `??`

Run `xelatex` **twice**. The first pass writes `.aux` files; the second reads them.

---

## 7 · Project File Structure

```
SIPREH_manual/
├── main.tex          ← entry point, include all chapters
├── bbe.cls           ← custom BBE document class (do not modify)
├── figures.tex       ← reusable pgfplots figure commands
├── chapter1.tex      ← Introducción
├── chapter2.tex      ← Previsualización
├── chapter3.tex      ← Tecnologías
├── chapter4.tex      ← Arquitectura
├── chapter5.tex      ← Principales Funcionalidades
├── chapter6.tex      ← Funcionamiento (flowcharts)
├── chapter7.tex      ← Estructura del Proyecto
├── chapter8.tex      ← Despliegues
└── main.pdf          ← compiled output (generated)
```
