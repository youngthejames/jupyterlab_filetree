# jupyterlab_filetree

File Tree View as side bar tool

[![Build Status](https://github.com/youngthejames/jupyterlab_filetree/workflows/Build%20Status/badge.svg?branch=main)](https://github.com/youngthejames/jupyterlab_filetree/actions?query=workflow%3A%22Build+Status%22)

[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/youngthejames/jupyterlab_filetree.git/main?urlpath=lab)

[![npm](https://img.shields.io/npm/v/jupyterlab_filetree.svg)](https://www.npmjs.com/package/jupyterlab_filetree)

![alt text](https://github.com/youngthejames/jupyterlab_filetree/blob/master/images/screenshot.png "File Tree Screenshot")


## Requirements

* JupyterLab

## Install

Starting with JupyterLab 3

```bash
pip install jupyterlab_filetree
```

For older JupyterLab versions,

```bash
jupyter labextension install jupyterlab_filetree
```

### Uninstall

```bash
pip uninstall jupyterlab_filetree
```

For older JupyterLab versions,

```bash
jupyter labextension uninstall jupyterlab_filetree
```

## Contributing

### Development install

Note: You will need NodeJS to build the extension package.

The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `jlpm` below.

```bash
# Clone the repo to your local environment
# Change directory to the jupyterlab_filetree directory
# Install package in development mode
pip install -e .
# Link your development version of the extension with JupyterLab
jupyter labextension develop . --overwrite
# Rebuild extension Typescript source after making changes
jlpm run build
```

You can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the extension.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
jlpm run watch
# Run JupyterLab in another terminal
jupyter lab
```

With the watch command running, every saved change will immediately be built locally and available in your running JupyterLab. Refresh JupyterLab to load the change in your browser (you may need to wait several seconds for the extension to be rebuilt).

By default, the `jlpm run build` command generates the source maps for this extension to make it easier to debug using the browser dev tools. To also generate source maps for the JupyterLab core extensions, you can run the following command:

```bash
jupyter lab build --minimize=False
```
