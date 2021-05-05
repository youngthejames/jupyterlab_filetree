import {
  ILayoutRestorer,
  IRouter,
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
} from "@jupyterlab/application";

import { ISettingRegistry } from '@jupyterlab/settingregistry';

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
  settings: ISettingRegistry,
) {
  // eslint-disable-next-line no-console
  console.log("JupyterLab extension jupyterlab_filetree is activated!");
  constructFileTreeWidget(
    app,
    "",
    "@youngthejames:jupyterlab_filetree",
    "left",
    paths,
    resolver,
    restorer,
    manager,
    router,
    settings,
  );
}

const extension: JupyterFrontEndPlugin<void> = {
  activate,
  autoStart: true,
  id: "@youngthejames:jupyterlab_filetree",
  requires: [
    JupyterFrontEnd.IPaths,
    IWindowResolver,
    ILayoutRestorer,
    IDocumentManager,
    IRouter,
    ISettingRegistry,
  ],
};

export default extension;
