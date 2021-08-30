# jupyterlab_filetree

[![Status](https://img.shields.io/badge/-Deprecated-red)]()

Due to various circumstances, I have decided to no longer maintain this project. 
Thank you to all the contributors and users for providing feedback. Building and maintaining this project has been a great learning experience.
For a similar project with additional features, consider using [jupyter-fs](https://github.com/jpmorganchase/jupyter-fs).


File Tree View as side bar tool

[![Build Status](https://github.com/youngthejames/jupyterlab_filetree/workflows/Build%20Status/badge.svg?branch=main)](https://github.com/youngthejames/jupyterlab_filetree/actions?query=workflow%3A%22Build+Status%22)

[![npm](https://img.shields.io/npm/v/jupyterlab_filetree.svg)](https://www.npmjs.com/package/jupyterlab_filetree)

![Screenshot](https://github.com/youngthejames/jupyterlab_filetree/blob/master/images/screenshot.png "File Tree Screenshot")

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

