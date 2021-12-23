# Bitburner

The scripts are written in plain javascript but are type checked by typescript.
For that to work each function must be [documented accordingly](https://jsdoc.app/).

## Template

A template for a netscript2 is available at 'src/template.js'.

## Typescript definitions

The typescript definitions for the game are located at 'src/bitburner.t.ts' and
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
