import {
  JupyterLab, JupyterLabPlugin, ILayoutRestorer
} from '@jupyterlab/application';

import {
  Widget
} from '@phosphor/widgets';

import '../style/index.css';

var FILES = {'jupyter': { 'permissions.hjson': '', 'appdefs': {'core': {'appdef.hjson': ''}}}}

class FileTreeWidget extends Widget {
  constructor() {
    super();

    this.id = 'filetree-jupyterlab';
    this.title.iconClass = 'filetree-icon'
    this.title.caption= 'File Tree';
    this.title.closable = true;
    this.addClass('jp-filetreeWidget');
  }

  readonly div: HTMLDivElement;
}

function buildTableContents(body: any, data: any, level: number) {
  Object.keys(data).forEach(key => {
    let tr = document.createElement('tr');
    let td = document.createElement('td');

    td.appendChild(document.createTextNode(key));
    td.className = 'filetree-item-text';
    td.style.setProperty('--indent', level + 'em');
    tr.appendChild(td);
    tr.className = 'filetree-item';
    body.appendChild(tr);

    if(typeof data[key] !== 'string')
    	buildTableContents(body, data[key], level+1);
  });
}

function buildTable(data: any) {
  let table = document.createElement('table');
  let thead = table.createTHead();
  let tbody = table.createTBody();
  let headRow = document.createElement('tr');
  ['File Name','Version'].forEach(function(el) {
    let th = document.createElement('th');
    th.appendChild(document.createTextNode(el));
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  buildTableContents(tbody, data, 1);
  table.appendChild(tbody);

  return table;
}

function activate(app: JupyterLab, restorer: ILayoutRestorer) {
  console.log('JupyterLab extension jupyterlab_filetree is activated!');
  
  let widget = new FileTreeWidget();
  restorer.add(widget, 'filetree-jupyterlab');

  let header = document.createElement('header');
  header.textContent = 'File Tree';
  widget.node.appendChild(header);

  let table = buildTable(FILES);
  widget.node.appendChild(table);

  app.shell.addToLeftArea(widget);
}

/**
 * Initialization data for the jupyterlab_changeset extension.
 */
const extension: JupyterLabPlugin<void> = {
  id: 'jupyterlab_filetree',
  autoStart: true,
  requires: [ILayoutRestorer],
  activate: activate
};

export default extension;
