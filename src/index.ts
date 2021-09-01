import {
  ILabShell,
  ILayoutRestorer,
  IRouter,
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
} from "@jupyterlab/application";

import { IDocumentManager } from "@jupyterlab/docmanager";

import { IWindowResolver } from "@jupyterlab/apputils";

import { constructFileTreeWidget } from "./filetree";

import "../style/index.css";

function activate(
  app: JupyterFrontEnd,
  paths: JupyterFrontEnd.IPaths,
  resolver: IWindowResolver,
  restorer: ILayoutRestorer,
  manager: IDocumentManager,
  router: IRouter,
  labShell: ILabShell,
) {
  // eslint-disable-next-line no-console
  console.log("JupyterLab extension jupyterlab_filetree is activated!");
  constructFileTreeWidget(
    app,
    "",
    "filetree-jupyterlab",
    "left",
    paths,
    resolver,
    restorer,
    manager,
    router,
    labShell,
  );
}

const extension: JupyterFrontEndPlugin<void> = {
  activate,
  autoStart: true,
  id: "jupyterlab_filetree",
  requires: [
    JupyterFrontEnd.IPaths,
    IWindowResolver,
    ILayoutRestorer,
    IDocumentManager,
    IRouter,
    ILabShell,
  ],
};

export default extension;
