# Bitburner

The scripts are written in plain javascript but are type checked by typescript.
For that to work each function must be [documented accordingly](https://jsdoc.app/).

## Template

A template for a netscript2 is available at 'src/template.js'.

## File hierarchy

The file structure in `src` is kept flat intentionally as `Bitburner` requires
import paths for scripts to be absolute. Keeping the hierarchy flat will make
this simple.

## Typescript definitions

The typescript definitions for the game are located at 'src/typedef/bitburner.t.ts' and
are pulled from the [games github](https://github.com/danielyxie/bitburner/blob/master/src/ScriptEditor/NetscriptDefinitions.d.ts).

## Requirements

- python3 (opt. for serving the files)
- make (opt. for convenient build commands)
- tsc (typescript) (opt. for type checking the scripts)

## Install

1) Open a local server to serve the files.

```bash
make serve
```

2) Run the following in the Bitburner terminal.

```bash
wget http://localhost:8080/init.js init.js
run init.js
```

## Ressources

- Stock script: <https://teddit.net/r/Bitburner/comments/rn7l84/stock_script_to_end_your_financial_problems/>
- Improves hacking scripts: <https://github.com/Hedrauta/bitburner-scripts>
