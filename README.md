# jupyterlab_filetree

File Tree View as side bar tool

![npm](https://img.shields.io/npm/v/jupyterlab_filetree.svg)](https://www.npmjs.com/package/jupyterlab_filetree)

![alt text](https://github.com/youngthejames/jupyterlab_filetree/blob/master/images/screenshot.png "File Tree Screenshot")

## Prerequisites

* JupyterLab

## Installation

```bash
jupyter labextension install jupyterlab_filetree
```

## Development

For a development install (requires npm version 4 or later), do the following in the repository directory:

```bash
npm install
npm run build
jupyter labextension link .
```

To rebuild the package and the JupyterLab app:

```bash
npm run build
jupyter lab build
```

